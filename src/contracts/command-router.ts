import { Context, type Effect } from "effect";
import type { BotCommand, CommandDeps } from "./bot-command";
import type { WhatsAppGatewayPayload } from "./whatsapp-gateway";

export class CommandRouterService extends Context.Tag("CommandRouterService")<
    CommandRouterService,
    {
        // Build commands using deps from context (prod)
        loadCommands: () => Effect.Effect<BotCommand[], Error>;
        // Alternative: build using explicit deps (tRPC/tests)
        loadCommandsWithDeps: (deps: CommandDeps) => Effect.Effect<BotCommand[], Error>;
        // Handle using preloaded commands; prod resolves executor for errors/unknowns
        handle: (payload: WhatsAppGatewayPayload) => Effect.Effect<void, Error>;
        // Handle with explicit deps (simple for tRPC)
        handleWithDeps: (payload: WhatsAppGatewayPayload, deps: CommandDeps) => Effect.Effect<void, Error>;
    }
>() { }