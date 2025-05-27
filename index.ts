import { CommandRouter } from "@/services/command-router";
import { Fonnte } from "@/services/fonnte";
import { RateLimiter } from "@/services/rate-limiter";

const whatsapp = new Fonnte({
    phoneNumber: process.env.WHATSAPP_PHONE_NUMBER!,
    apiKey: process.env.WHATSAPP_API_KEY!,
});

const rateLimiter = new RateLimiter();

const router = new CommandRouter({
    onSend: async (to, msg) => {
        // Check rate limit before sending
        if (!rateLimiter.canSend(to)) {
            const remaining = rateLimiter.getRemainingMessages(to);
            const isGroup = to.includes('@g.us');
            const limit = isGroup ? 1000 : 100;
            const logMessage = `🚫 Rate limit exceeded for ${to}. Daily limit: ${limit}, Remaining: ${remaining}`;
            console.warn(logMessage);
            return;
        }

        console.log(`✅ Sending message to ${to} with message: ${msg}`);
        await whatsapp.sendMessage(to, msg);
        
        // Record the message after successful send
        rateLimiter.recordMessage(to);
    },
    onError: async (to, err) => {
        const logMessage = `❌ Error for ${to}: ${err}`;
        console.error(logMessage);
    },
});

// Load commands on startup
await router.loadCommands();
const ALLOWED_GROUPS = process.env.ALLOWED_GROUPS?.split(',') || [];

export default {
    async fetch(request: Request): Promise<Response> {
        if (request.method == 'POST') {
            // Check if the request path matches the secret webhook path
            const url = new URL(request.url);
            const expectedPath = process.env.SECRET_PATH;
            const pathLogMessage = `Request path: ${url.pathname}, Expected: ${expectedPath}`;
            console.log(pathLogMessage);
            if (url.pathname !== expectedPath) {
                return new Response('Unauthorized', { status: 401 });
            }
            try {
                const payload = await request.text();
                const result = await whatsapp.handleWebhook(payload);
    
                if (result?.group && !ALLOWED_GROUPS.includes(result.sender)) {
                    const groupUnauthorizedMessage = `Unauthorized group access: ${result.sender}`;
                    console.log(groupUnauthorizedMessage);
                    return new Response('Unauthorized', { status: 401 });
                }
    
                if (result) {
                    await router.handle(result);
                }
                
                return new Response('OK', { status: 200 });
            } catch (error) {
                const errorMessage = `Webhook error: ${error}`;
                console.error(errorMessage);
                
                return new Response('Internal server error', { status: 500 });
            }
        }
        return new Response('MaiBot is running', { status: 200 });
        
    }
};
