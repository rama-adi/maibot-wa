import { configDatabase } from "./database/drizzle";
import { findUserByPhone } from "./database/queries/user-query";
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

export async function createDummyUser() {
    const fakeUser = await findUserByPhone({
        sender: "INTERNAL_ADMIN",
        message: "test",
        group: false,
        number: "INTERNAL_ADMIN",
        name: "Tester Admin Account",
    });

    console.log("Fake user loaded", fakeUser.name, fakeUser.phoneNumberHash)

}

export const commandRouter = new CommandRouter({
    onSend: async (payload, msg) => {
        const isGroup = payload.sender.includes('@g.us');

        // Check rate limit before sending
        if (!(await rateLimiter.canSend(payload.sender))) {
            const remaining = rateLimiter.getRemainingMessages(payload.sender);
            const limit = isGroup ? 1000 : 100;
            sendToLogger(`🚫 Rate limit exceeded for ${payload.sender}. Daily limit: ${limit}, Remaining: ${remaining}`)
            return;
        }

        const user = await findUserByPhone(payload);
        const taggedMsg = isGroup ? `${user.name}, ${msg}` : msg;

        await whatsapp.sendMessage(payload.sender, taggedMsg);

        // Record the message after successful send
        rateLimiter.recordMessage(payload.sender);
    },
    onError: async (to, err) => {
        sendToLogger(`❌ Error for ${to}: ${err}`)
    },
});