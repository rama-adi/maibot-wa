import type { WhatsAppGatewayPayload } from "@/contracts/whatsapp-gateway";
import { Effect } from "effect";
import type { CommandExecutor } from "@/contracts/command-executor";

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
    execute: (ctx: CommandContext) => Effect.Effect<void, Error, CommandExecutor>;
}