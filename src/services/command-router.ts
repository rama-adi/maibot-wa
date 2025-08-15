import { readdirSync } from "fs";
import { resolve } from "path";
import { Context, Effect, Layer, Array } from "effect";
import type { Command, CommandContext } from "@/types/command";
import type { WhatsAppGatewayPayload } from "@/types/whatsapp-gateway";
import { WhatsAppGatewayService } from "@/types/whatsapp-gateway";
import { RateLimiterService } from "@/services/rate-limiter";
import { CommandExecutor, createCommandExecutor } from "./command-executor";
import { configDatabase } from "@/database/drizzle";
import { admins } from "@/database/schemas/config-schema";

export class CommandRouterService extends Context.Tag("CommandRouterService")<
    CommandRouterService,
    {
        loadCommands: () => Effect.Effect<Command[], Error>;
        handle: (payload: WhatsAppGatewayPayload) => Effect.Effect<void, Error, WhatsAppGatewayService | RateLimiterService>;
    }
>() { }

const commonLoadCommand = (commands: Map<string, Command>) => Effect.gen(function* () {
    const dir = resolve(__dirname, "../commands");
    const loadedCommands: { name: string, file: string }[] = [];

    const files = readdirSync(dir).filter(file => file.match(/\.[tj]s$/));

    for (const file of files) {
        try {
            const mod = yield* Effect.promise(() => import(resolve(dir, file)));
            const cmd: Command = mod.default;

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
        const commands = new Map<string, Command>();
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
        const commands = new Map<string, Command>();

        const loadCommands = () => commonLoadCommand(commands);

        const handle = (payload: WhatsAppGatewayPayload) =>
            // Provide the executor context once for the entire handle operation
            Effect.gen(function* () {
                const executor = yield* CommandExecutor;

                // Get admin IDs
                const adminIds = yield* Effect.promise(() =>
                    configDatabase
                        .select({ id: admins.id })
                        .from(admins)
                ).pipe(Effect.map(rows => rows.map(user => user.id)))


                // Parse command
                const [cmdName = "", ...rest] = payload.message.trim().split(/\s+/);
                const rawArgs = rest.join(" ");

                console.log(`🔍 Processing Effect command: "${cmdName}", args: "${rawArgs}"`);

                const cmd = commands.get(cmdName.toLowerCase());
                if (!cmd) {
                    yield* executor.reply(`Unknown command "${cmdName}". Try "help" to list available commands.`);
                    return;
                }

                const isAdmin = adminIds.includes(payload.number) || payload.number === "INTERNAL_ADMIN";

                // Admin check
                if (cmd.adminOnly && !isAdmin) {
                    yield* executor.reply(`Command "${cmdName}" is only available for administrators.`);
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
            }).pipe(
                // Provide the executor context once for the entire operation
                Effect.provide(createCommandExecutor(payload))
            );

        return {
            loadCommands,
            handle,
        };
    })
); 