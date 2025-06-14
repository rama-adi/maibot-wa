import type { WhatsAppGatewayPayload } from "./whatsapp-gateway";
import { Effect } from "effect";
import type { CommandExecutor } from "@/services/command-executor";

export interface CommandContext {
    rawParams: string;
    availableCommands: Omit<Command, "execute">[];
    isAdmin: boolean;
    rawPayload: WhatsAppGatewayPayload;
    reply: (msg: string) => Promise<void>;
}

// Effect-based command context
export interface EffectCommandContext {
    rawParams: string;
    availableCommands: Omit<EffectCommand, "execute">[];
    isAdmin: boolean;
    rawPayload: WhatsAppGatewayPayload;
}

export interface Command {
    name: string;
    description: string;
    commandAvailableOn: "group" | "private" | "both";
    usageExample: string;
    enabled: boolean;
    adminOnly: boolean;
    execute: (ctx: CommandContext) => Promise<void>;
}

// Effect-based command interface
export interface EffectCommand {
    name: string;
    description: string;
    commandAvailableOn: "group" | "private" | "both";
    usageExample: string;
    enabled: boolean;
    adminOnly: boolean;
    execute: (ctx: EffectCommandContext) => Effect.Effect<void, Error, CommandExecutor>;
}

export interface CommandRouterOptions {
    onSend: (payload: WhatsAppGatewayPayload, msg: string, ) => Promise<void>;
    onError: (payload: WhatsAppGatewayPayload, err: unknown) => Promise<void>;
}