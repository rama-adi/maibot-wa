import { readdirSync } from "fs";
import { resolve } from "path";
import type { Command, CommandContext, CommandRouterOptions } from "@/types/command";
import type { WhatsAppGatewayPayload } from "@/types/whatsapp-gateway";
import { sendToLogger } from "@/services/logger";
import { configDatabase } from "@/database/drizzle";
import { admins } from "@/database/schemas/config-schema";

export class CommandRouter {
    private commands = new Map<string, Command>();
    constructor(private opts: CommandRouterOptions) { }

    /** Scan `src/commands` and dynamically import all handlers */
    public async loadCommands() {
        const dir = resolve(__dirname, "../handlers");
        const loadedCommands: { name: string, file: string }[] = [];
        
        for (const file of readdirSync(dir)) {
            if (!file.match(/\.[tj]s$/)) continue;
            const mod = await import(resolve(dir, file));
            const cmd: Command = mod.default;
            if (cmd?.name) {
                this.commands.set(cmd.name, cmd);
                loadedCommands.push({
                    name: cmd.name,
                    file: file
                });
            }
        }

        console.log(`✅ ${loadedCommands.length} Commands loaded!`);
        console.table(loadedCommands);
    }

    /** Route an incoming WhatsApp payload to its command */
    public async handle(payload: WhatsAppGatewayPayload) {
        const adminIds = (await configDatabase
            .select({ id: admins.id })
            .from(admins))
            .map(row => row.id);

        // Debug logging to track command execution
        sendToLogger(`🔍 Processing message: "${payload.message}" sent by ${payload.sender}`);
        
        // split into [command, ...rest]
        const [cmdName = "", ...rest] = payload.message.trim().split(/\s+/);
        const rawArgs = rest.join(" ");

        sendToLogger(`🔍 Parsed command: "${cmdName}", args: "${rawArgs}"`);

        const cmd = this.commands.get(cmdName.toLowerCase());
        if (!cmd) {
            // no such command
            sendToLogger(`❌ Unknown command: "${cmdName}"`);
            return this.opts.onError(
                payload.sender,
                `Unknown command "${cmdName}". Try "help" to list available commands.`
            );
        }

        const isAdmin = adminIds.includes(payload.number) || payload.number === "INTERNAL_ADMIN";

        if(cmd.adminOnly && !isAdmin) {
            return this.opts.onError(
                payload.sender,
                `Command "${cmdName}" is only available for administrators.`
            );
        }

        sendToLogger(`✅ Executing command: "${cmd.name}"`);

        // Check command availability based on context
        const isGroup = payload.group;
        if (cmd.commandAvailableOn === "group" && !isGroup) {
            return this.opts.onError(
                payload.sender,
                `Command "${cmdName}" is only available in groups.`
            );
        }
        if (cmd.commandAvailableOn === "private" && isGroup) {
            return this.opts.onError(
                payload.sender,
                `Command "${cmdName}" is only available in private messages.`
            );
        }

        const ctx: CommandContext = {
            rawParams: rawArgs,
            isAdmin,
            availableCommands: Array.from(this.commands.values()).map(({ execute, ...cmd }) => cmd),
            reply: async (msg: string) => {
                const taggedMsg = isGroup ? `${payload.name}, ${msg}` : msg;
                return this.opts.onSend(payload.sender, taggedMsg);
            }
        };

        try {
            await cmd.execute(ctx);
            sendToLogger(`✅ Command "${cmd.name}" completed successfully`);
        } catch (err) {
            sendToLogger(`❌ Command "${cmd.name}" failed: ${err}`);
            // bubble to your error reporter
            await this.opts.onError(payload.sender, err);
        }
    }
}