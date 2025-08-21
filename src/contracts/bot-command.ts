import type { WhatsAppGatewayPayload } from "@/contracts/whatsapp-gateway";
import { Context, Effect } from "effect";
import { CommandExecutor } from "@/contracts/command-executor";
import { MaiSongData } from "./maisong-data";
import type { MaiAi } from "./mai-ai";


export interface CommandDeps {
    maiAi: typeof MaiAi.Service,
    executor: typeof CommandExecutor.Service;
    maiSongData: typeof MaiSongData.Service; // add more later: logger, kv, config, clock, etc. 
}

export const CommandDepsLive = Effect.gen(function* () {
    const executor = yield* CommandExecutor;
    const maiSongData = yield* MaiSongData;

    // (optional) add `satisfies` for extra type safety:
    return { executor, maiSongData };
});

export interface CommandContext {
    rawParams: string;
    availableCommands: Omit<BotCommand, "execute">[];
    isAdmin: boolean;
    rawPayload: WhatsAppGatewayPayload;
}

export interface BotCommand {
    name: string;
    description: string;
    commandAvailableOn: "group" | "private" | "both";
    usageExample: string;
    enabled: boolean;
    adminOnly: boolean;
    // R = never (env-free once built)
    execute: (ctx: CommandContext) => Effect.Effect<void, Error>;
}

export type CommandBuilder = (deps: CommandDeps) => BotCommand;
export const defineCommand = (build: CommandBuilder) => build;
