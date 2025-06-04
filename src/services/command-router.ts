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

    /** Route an incoming WhatsApp payload and handle sending response */
    public async handle(payload: WhatsAppGatewayPayload) {
        try {
            const result = await this.handleAndGetResult(payload);
            if (result) {
                const isGroup = payload.group;
                const taggedMsg = isGroup ? `${payload.name}, ${result}` : result;
                await this.opts.onSend(
                    payload.sender,
                    taggedMsg
                );
            }
        } catch (err) {
            await this.opts.onError(
                payload.sender,
                err instanceof Error ? err.message : String(err)
            );
        }
    }

    /** Route an incoming WhatsApp payload and return the result */
    public async handleAndGetResult(payload: WhatsAppGatewayPayload): Promise<string | void> {
        // split into [command, ...rest]
        const [cmdName = "", ...rest] = payload.message.trim().split(/\s+/);
        const rawArgs = rest.join(" ");

        const cmd = this.commands.get(cmdName.toLowerCase());
        if (!cmd) {
            // no such command
            return `Unknown command "${cmdName}". Try "help" to list available commands.`;
        }

        if (!cmd.enabled) {
            return `Command "${cmdName} is disabled."`;
        }

        // Check command availability based on context
        const isGroup = payload.group;
        if (cmd.commandAvailableOn === "group" && !isGroup) {
            return `Command "${cmdName}" is only available in groups.`;
        }
        if (cmd.commandAvailableOn === "private" && isGroup) {
            return `Command "${cmdName}" is only available in private messages.`;
        }

        const ctx: CommandContext = {
            rawParams: rawArgs,
            availableCommands: Array.from(this.commands.values()).map(({ execute, ...cmd }) => cmd),
            reply: async (msg: string) => {
                const taggedMsg = isGroup ? `${payload.name}, ${msg}` : msg;
                return this.opts.onSend(payload.sender, taggedMsg);
            }
        };

        return await cmd.execute(ctx);
    }
}