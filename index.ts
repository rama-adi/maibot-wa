import { CommandRouter } from "@/services/command-router";
import { Fonnte } from "@/services/fonnte";

const whatsapp = new Fonnte({
    phoneNumber: process.env.WHATSAPP_PHONE_NUMBER!,
    apiKey: process.env.WHATSAPP_API_KEY!,
});

const router = new CommandRouter({
    onSend: async (to, msg) => {
        console.log("✅ Sending message to", to, "with message:", msg);
        await whatsapp.sendMessage(to, msg);
    },
    onError: async (to, err) => {
        console.error(`❌ Error for ${to}:`, err);
    },
});

// Load commands on startup
await router.loadCommands();
const ALLOWED_GROUPS = process.env.ALLOWED_GROUPS?.split(',') || [];

export default {
    async fetch(request: Request): Promise<Response> {
        if (request.method == 'POST') {
            // only allow 103.52.212.50
            const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
            console.log("IP:", ip);
            if (ip !== '103.52.212.50') {
                return new Response('Unauthorized', { status: 401 });
            }
            try {
                const payload = await request.text();
                const result = await whatsapp.handleWebhook(payload);
    
                if (result?.group && !ALLOWED_GROUPS.includes(result.sender)) {
                    return new Response('Unauthorized', { status: 401 });
                }
    
                if (result) {
                    await router.handle(result);
                }
                return new Response('OK', { status: 200 });
            } catch (error) {
                console.error('Webhook error:', error);
                return new Response('Internal server error', { status: 500 });
            }
        }

        return new Response('MaiBot is running', { status: 200 });
        
    }
};
