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

