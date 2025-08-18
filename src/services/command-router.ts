import { readdirSync } from "fs";
import { resolve } from "path";
import { Context, Effect, Layer, Array } from "effect";
import type { BotCommand, CommandContext } from "@/contracts/bot-command";
import type { WhatsAppGatewayPayload } from "@/contracts/whatsapp-gateway";
import { WhatsAppGatewayService } from "@/contracts/whatsapp-gateway";
import { CommandExecutor } from "@/contracts/command-executor";

export class CommandRouterService extends Context.Tag("CommandRouterService")<
    CommandRouterService,
    {
        loadCommands: () => Effect.Effect<BotCommand[], Error>;
        handle: (payload: WhatsAppGatewayPayload) => Effect.Effect<void, Error, CommandExecutor>;
    }
>() { }

const commonLoadCommand = (commands: Map<string, BotCommand>) => Effect.gen(function* () {
    const dir = resolve(__dirname, "../bot-commands");
    const loadedCommands: { name: string, file: string }[] = [];

    const files = readdirSync(dir).filter(file => file.match(/\.[tj]s$/));

    for (const file of files) {
        try {
            const mod = yield* Effect.promise(() => import(resolve(dir, file)));
            const cmd: BotCommand = mod.default;

            if (cmd?.name) {
                commands.set(cmd.name, cmd);
                loadedCommands.push({
                    name: cmd.name,
                    file: file
                });
            }
        } catch (error) {
            yield* Effect.fail(new Error(`Failed to load command from ${file}: ${error}`));
        }
    }
    return commands.values().toArray();
});

export const NullCommandRouterService = Layer.effect(CommandRouterService)(
    Effect.gen(function* () {
        const commands = new Map<string, BotCommand>();
        const loadCommands = () => commonLoadCommand(commands);

        const handle = (_: WhatsAppGatewayPayload) => Effect.gen(function* () {
            return yield* Effect.void;
        })

        return {
            loadCommands,
            handle,
        };
    })
);

export const CommandRouterServiceLive = Layer.effect(CommandRouterService)(
    Effect.gen(function* () {
        const commands = new Map<string, BotCommand>();

        const loadCommands = () => commonLoadCommand(commands);

        const handle = (payload: WhatsAppGatewayPayload) =>
            // Provide the executor context once for the entire handle operation
            Effect.gen(function* () {
                const executor = yield* CommandExecutor;

                // Parse command
                const [cmdName = "", ...rest] = payload.message.trim().split(/\s+/);
                const rawArgs = rest.join(" ");

                console.log(`🔍 Processing Effect command: "${cmdName}", args: "${rawArgs}"`);

                const cmd = commands.get(cmdName.toLowerCase());
                if (!cmd) {
                    yield* executor.reply(`Unknown command "${cmdName}". Try "help" to list available commands.`);
                    return;
                }

                // For MVP: Hide admin commands by treating all commands as non-admin
                const isAdmin = false;

                // Admin check
                if (cmd.adminOnly && !isAdmin) {
                    yield* executor.reply(`Unknown command "${cmdName}". Try "help" to list available commands.`);
                    return;
                }

                // Context availability check
                const isGroup = payload.group;
                if (cmd.commandAvailableOn === "group" && !isGroup) {
                    yield* executor.reply(`Command "${cmdName}" is only available in groups.`);
                    return;
                }
                if (cmd.commandAvailableOn === "private" && isGroup) {
                    yield* executor.reply(`Command "${cmdName}" is only available in private messages.`);
                    return;
                }

                // Build command context
                const ctx: CommandContext = {
                    rawParams: rawArgs,
                    isAdmin,
                    availableCommands: Array.fromIterable(commands.values()).map(({ execute, ...cmd }) => cmd),
                    rawPayload: payload,
                };

                // Execute command
                console.log(`✅ Executing Effect command: "${cmd.name}"`);
                yield* cmd.execute(ctx);
            });

        return {
            loadCommands,
            handle,
        };
    })
); 