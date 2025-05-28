import type { WhatsAppGateway, WhatsAppGatewayPayload } from "@/types/whatsapp-gateway";
type FonnteWebhookPayload = {
    quick: boolean
    device: string
    pesan: string
    pengirim: string
    member: string
    message: string
    text: string
    sender: string
    name: string
    location: string
    url: string
    type: string
    extension: string
    filename: string
    pollname: string
    choices: Array<any>
    inboxid: number
    isgroup: boolean
    isforwarded: boolean
}
export class Fonnte implements WhatsAppGateway {
    private phoneNumber: string;
    private apiKey: string;

    constructor(params: { phoneNumber: string, apiKey: string }) {
        this.phoneNumber = params.phoneNumber;
        this.apiKey = params.apiKey;
    }

    async handleWebhook(data: string): Promise<WhatsAppGatewayPayload | null> {
        const payload = JSON.parse(data) as FonnteWebhookPayload;
        const messageParts = payload.message.split(" ");

        if (payload.isgroup) {
            if (
                !messageParts[0] ||
                !messageParts[0].toLowerCase().includes(`@${this.phoneNumber}`)
            ) {
                return null;
            }
        }

        const message = payload.message.replace(`@${this.phoneNumber}`, "").trim();
        console.log("➡️ Sender Number:", payload.sender, "Message:", message);

        if (payload.isgroup) {
            return {
                sender: payload.sender,
                message: message,
                group: payload.isgroup,
                number: payload.member,
                name: payload.name
            }
        }

        return {
            sender: payload.sender,
            message: message,
            group: false,
            number: payload.sender,
            name: payload.name
        }
    }

    async sendMessage(to: string, message: string): Promise<void> {
        const url = `https://api.fonnte.com/send`;
        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify({
              target: to,
              message: message
            }),
            headers: {
                "Authorization": `${this.apiKey}`,
                "Content-Type": "application/json"
            }
        })
        if (!response.ok) {
            throw new Error("Failed to send message")
        }
    }
}