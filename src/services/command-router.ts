import { readdirSync } from "fs";
import { resolve } from "path";
import type { Command, CommandContext, CommandRouterOptions } from "@/types/command";
import type { WhatsAppGatewayPayload } from "@/types/whatsapp-gateway";

export class CommandRouter {
    private commands = new Map<string, Command>();
    constructor(private opts: CommandRouterOptions) { }

    /** Scan `src/commands` and dynamically import all handlers */
    public async loadCommands() {
        const dir = resolve(__dirname, "../handlers");
        for (const file of readdirSync(dir)) {
            if (!file.match(/\.[tj]s$/)) continue;
            const mod = await import(resolve(dir, file));
            const cmd: Command = mod.default;
            if (cmd?.name) this.commands.set(cmd.name, cmd);
        }
    }

    /** Route an incoming WhatsApp payload to its command */
    public async handle(payload: WhatsAppGatewayPayload) {
        // split into [command, ...rest]
        const [cmdName = "", ...rest] = payload.message.trim().split(/\s+/);
        const rawArgs = rest.join(" ");

        const cmd = this.commands.get(cmdName.toLowerCase());
        if (!cmd) {
            // no such command
            return this.opts.onError(
                payload.sender,
                `Unknown command "${cmdName}". Try "help" to list available commands.`
            );
        }

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
            availableCommands: Array.from(this.commands.values()).map(({ execute, ...cmd }) => cmd),
            reply: async (msg: string) => {
                const taggedMsg = isGroup ? `${payload.name}, ${msg}` : msg;
                return this.opts.onSend(payload.sender, taggedMsg);
            }
        };

        try {
            await cmd.execute(ctx);
        } catch (err) {
            // bubble to your error reporter
            await this.opts.onError(payload.sender, err);
        }
    }
}