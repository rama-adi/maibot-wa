import { configDatabase } from "./database/drizzle";
import { allowedGroups } from "./database/schemas/config-schema";
import { CommandRouter } from "./services/command-router";
import { Fonnte } from "./services/fonnte";
import { sendToLogger } from "./services/logger";
import { RateLimiter } from "./services/rate-limiter";

export const whatsapp = new Fonnte({
    phoneNumber: process.env.WHATSAPP_PHONE_NUMBER!,
    apiKey: process.env.WHATSAPP_API_KEY!,
});

export const rateLimiter = new RateLimiter();

export const commandRouter = new CommandRouter({
    onSend: async (to, msg) => {
        // Check rate limit before sending
        if (!rateLimiter.canSend(to)) {
            const remaining = rateLimiter.getRemainingMessages(to);
            const isGroup = to.includes('@g.us');
            const limit = isGroup ? 1000 : 100;
            sendToLogger(`🚫 Rate limit exceeded for ${to}. Daily limit: ${limit}, Remaining: ${remaining}`)
            return;
        }

        await whatsapp.sendMessage(to, msg);

        // Record the message after successful send
        rateLimiter.recordMessage(to);
    },
    onError: async (to, err) => {
        sendToLogger(`❌ Error for ${to}: ${err}`)
    },
});