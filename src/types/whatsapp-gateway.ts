import { Context, Effect } from "effect";


export type WhatsAppGatewayPayload = {
    sender: string;
    message: string;
    group: boolean;
    number: string;
    name: string;
}

export interface WhatsAppGateway {
    handleWebhook(data: string): Promise<WhatsAppGatewayPayload | null>
    sendMessage(to: string, sender: string, message: string): void | Promise<void>
}

// Retrofit for now
export class WhatsAppGatewayService extends Context.Tag("WhatsappGatewayService")<
    WhatsAppGatewayService,
    {
        readonly handleWebhook: (data: string) => Effect.Effect<WhatsAppGatewayPayload | void, Error>,
        readonly sendMessage: (data: {to: string, message: string}) => Effect.Effect<string, Error>
    }
>() { };