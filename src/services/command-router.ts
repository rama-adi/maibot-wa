// services/command-router.ts
import { readdirSync } from "fs";
import { resolve } from "path";
import { Context, Effect, Layer, Array as Arr } from "effect";
import { type BotCommand, type CommandBuilder, type CommandContext, type CommandDeps } from "@/contracts/bot-command";
import type { WhatsAppGatewayPayload } from "@/contracts/whatsapp-gateway";
import { CommandExecutor } from "@/contracts/command-executor";
import { CommandRouterService } from "@/contracts/command-router";
import { MaiSongData } from "@/contracts/maisong-data";
import { MaiAi } from "@/contracts/mai-ai";

const buildAll = (dir: string, deps: CommandDeps) =>
    Effect.gen(function* () {
        const files = readdirSync(dir).filter((f) => f.match(/\.[tj]s$/));
        const map = new Map<string, BotCommand>();
        for (const f of files) {
            const mod = (yield* Effect.promise(() => import(resolve(dir, f)))).default as CommandBuilder;
            const cmd = mod(deps); // deps captured now
            if (cmd?.name) map.set(cmd.name.toLowerCase(), cmd);
        }
        return map;
    });

export const CommandRouterServiceLive = Layer.effect(CommandRouterService)(
    Effect.gen(function* () {
        const commands = new Map<string, BotCommand>();
        const dir = resolve(__dirname, "../bot-commands");

        // Capture deps at layer creation so service APIs are env-free
        const executor = yield* CommandExecutor;
        const maiSongData = yield* MaiSongData;
        const maiAi = yield* MaiAi;
        const capturedDeps: CommandDeps = { executor, maiSongData, maiAi };

        const loadCommandsWithDeps = (deps: CommandDeps) => Effect.map(buildAll(dir, deps), (m) => {
            commands.clear();
            for (const [k, v] of m) commands.set(k, v);
            return Arr.fromIterable(commands.values());
        });

        const loadCommands = () => loadCommandsWithDeps(capturedDeps);

        const run = (payload: WhatsAppGatewayPayload, deps: CommandDeps) =>
            Effect.gen(function* () {
                const [cmdName = "", ...rest] = payload.message.trim().split(/\s+/);
                const rawArgs = rest.join(" ");
                const cmd = commands.get(cmdName.toLowerCase());

                const reply = (m: string) => deps.executor.reply(m);

                if (!cmd) {
                    yield* reply(`Unknown command "${cmdName}". Try "help" to list available commands.`);
                    return;
                }

                const isAdmin = false;
                const isGroup = payload.group;
                if (cmd.commandAvailableOn === "group" && !isGroup) {
                    yield* reply(`Command "${cmdName}" hanya untuk grup.`);
                    return;
                }
                if (cmd.commandAvailableOn === "private" && isGroup) {
                    yield* reply(`Command "${cmdName}" hanya untuk chat pribadi.`);
                    return;
                }

                const ctx: CommandContext = {
                    rawParams: rawArgs,
                    isAdmin,
                    availableCommands: Arr
                        .fromIterable(commands.values())
                        .filter((c) => !c.adminOnly)
                        .map(({ execute, ...c }) => c),
                    rawPayload: payload,
                };

                yield* cmd.execute(ctx); // already env-free
            });

        const handleWithDeps = (payload: WhatsAppGatewayPayload, deps: CommandDeps) => run(payload, deps);

        const handle = (payload: WhatsAppGatewayPayload) => run(payload, capturedDeps);

        return { loadCommands, loadCommandsWithDeps, handle, handleWithDeps };
    })
);
