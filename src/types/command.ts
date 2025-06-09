import type { WhatsAppGatewayPayload } from "./whatsapp-gateway";

export interface CommandContext {
    rawParams: string;
    availableCommands: Omit<Command, "execute">[];
    isAdmin: boolean;
    rawPayload: WhatsAppGatewayPayload;
    reply: (msg: string) => Promise<void>;
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

export interface CommandRouterOptions {
    onSend: (payload: WhatsAppGatewayPayload, msg: string, ) => Promise<void>;
    onError: (payload: WhatsAppGatewayPayload, err: unknown) => Promise<void>;
}