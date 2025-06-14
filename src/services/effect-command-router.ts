import { readdirSync } from "fs";
import { resolve } from "path";
import { Context, Effect, Layer, Array, pipe } from "effect";
import type { EffectCommand, EffectCommandContext } from "@/types/command";
import type { WhatsAppGatewayPayload } from "@/types/whatsapp-gateway";
import { WhatsAppGatewayService } from "@/types/whatsapp-gateway";
import { RateLimiterService } from "@/services/rate-limiter";
import { CommandExecutor, createCommandExecutor } from "./command-executor";
import { configDatabase } from "@/database/drizzle";
import { admins } from "@/database/schemas/config-schema";

export class CommandRouterService extends Context.Tag("CommandRouterService")<
    CommandRouterService,
    {
        loadCommands: () => Effect.Effect<void, Error>;
        handle: (payload: WhatsAppGatewayPayload) => Effect.Effect<void, Error, WhatsAppGatewayService | RateLimiterService>;
    }
>() { }

export const CommandRouterServiceLive = Layer.effect(CommandRouterService)(
    Effect.gen(function* () {
        const commands = new Map<string, EffectCommand>();

        const loadCommands = () =>
            Effect.gen(function* () {
                const dir = resolve(__dirname, "../commands");
                const loadedCommands: { name: string, file: string }[] = [];

                const files = readdirSync(dir).filter(file => file.match(/\.[tj]s$/));

                for (const file of files) {
                    try {
                        const mod = yield* Effect.promise(() => import(resolve(dir, file)));
                        const cmd: EffectCommand = mod.default;

                        if (cmd?.name) {
                            commands.set(cmd.name, cmd);
                            loadedCommands.push({
                                name: cmd.name,
                                file: file
                            });
                        }
                    } catch (error) {
                        console.error(`Failed to load command from ${file}:`, error);
                        yield* Effect.fail(new Error(`Failed to load command from ${file}: ${error}`));
                    }
                }

                console.log(`✅ ${loadedCommands.length} Effect Commands loaded!`);
                console.table(loadedCommands);
            });

        const handle = (payload: WhatsAppGatewayPayload) =>
            Effect.gen(function* () {
                // Get admin IDs
                const adminRows = yield* Effect.promise(() =>
                    configDatabase
                        .select({ id: admins.id })
                        .from(admins)
                );

                const adminIds = adminRows.map(row => row.id);

                // Parse command
                const [cmdName = "", ...rest] = payload.message.trim().split(/\s+/);
                const rawArgs = rest.join(" ");

                console.log(`🔍 Processing Effect command: "${cmdName}", args: "${rawArgs}"`);

                const cmd = commands.get(cmdName.toLowerCase());
                if (!cmd) {
                    // Create executor for this payload and send error
                    yield* Effect.gen(function* () {
                        const executor = yield* CommandExecutor;
                        yield* executor.reply(`Unknown command "${cmdName}". Try "help" to list available commands.`);
                    }).pipe(Effect.provide(createCommandExecutor(payload)));
                    return;
                }

                const isAdmin = adminIds.includes(payload.number) || payload.number === "INTERNAL_ADMIN";

                // Admin check
                if (cmd.adminOnly && !isAdmin) {
                    yield* Effect.gen(function* () {
                        const executor = yield* CommandExecutor;
                        yield* executor.reply(`Command "${cmdName}" is only available for administrators.`);
                    }).pipe(Effect.provide(createCommandExecutor(payload)));
                    return;
                }

                // Context availability check
                const isGroup = payload.group;
                if (cmd.commandAvailableOn === "group" && !isGroup) {
                    yield* Effect.gen(function* () {
                        const executor = yield* CommandExecutor;
                        yield* executor.reply(`Command "${cmdName}" is only available in groups.`);
                    }).pipe(Effect.provide(createCommandExecutor(payload)));
                    return;
                }
                
                if (cmd.commandAvailableOn === "private" && isGroup) {
                    yield* Effect.gen(function* () {
                        const executor = yield* CommandExecutor;
                        yield* executor.reply(`Command "${cmdName}" is only available in private messages.`);
                    }).pipe(Effect.provide(createCommandExecutor(payload)));
                    return;
                }

                // Build command context
                const ctx: EffectCommandContext = {
                    rawParams: rawArgs,
                    isAdmin,
                    availableCommands: Array.fromIterable(commands.values()).map(({ execute, ...cmd }) => cmd),
                    rawPayload: payload,
                };

                // Execute command with payload-specific executor
                console.log(`✅ Executing Effect command: "${cmd.name}"`);
                yield* cmd.execute(ctx).pipe(Effect.provide(createCommandExecutor(payload)));
                console.log(`✅ Effect command "${cmd.name}" completed successfully`);
            });

        return {
            loadCommands,
            handle,
        };
    })
); 