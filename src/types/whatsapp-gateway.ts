import { Context, Data, Effect } from "effect";

const WhatsappGatewayCapabilities = [
    "sendAttachment", // Ability to send attachment
    "sendContextualReply", // Ability to attach reply to command
    "sendMessage" // Ability to send message
] as const;

export type WhatsAppGatewayCapability = typeof WhatsappGatewayCapabilities[number];

export type WhatsAppGatewayPayload = {
    sender: string;
    messageId: string | null;
    message: string;
    group: boolean;
    number: string;
    name: string;
}

export class WhatsappGatewayCapabilityInvalid extends Data.TaggedError("WhatsappGatewayCapabilityInvalid")<{
    capability: WhatsAppGatewayCapability
}> { }

export interface WhatsAppGateway {
    handleWebhook(data: string): Promise<WhatsAppGatewayPayload | null>
    sendMessage(to: string, sender: string, message: string): void | Promise<void>
}

// Retrofit for now
export class WhatsAppGatewayService extends Context.Tag("WhatsappGatewayService")<
    WhatsAppGatewayService,
    {
        readonly capabilities: WhatsAppGatewayCapability[],
        readonly handleWebhook: (
            data: string,
            headers: Headers
        ) => Effect.Effect<WhatsAppGatewayPayload | void, Error>,
        readonly sendMessage: (data: {
            to: string,
            message: string
        }) => Effect.Effect<string, Error>
        readonly sendReply: (data: {
            to: string,
            messageId: string,
            message: string
        }) => Effect.Effect<string, Error>
    }
>() { };