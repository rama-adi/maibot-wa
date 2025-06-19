import type { WhatsAppGatewayPayload } from "./whatsapp-gateway";
import { Effect } from "effect";
import type { CommandExecutor } from "@/services/command-executor";

export interface CommandContext {
    rawParams: string;
    availableCommands: Omit<Command, "execute">[];
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
    execute: (ctx: CommandContext) => Effect.Effect<void, Error, CommandExecutor>;
}