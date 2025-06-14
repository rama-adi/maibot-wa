
import { sendToLogger } from "@/services/logger";
import { commandRouter, createDummyUser, whatsapp } from "@/initialize";
import { serve } from "bun";
import { findAllowedGroup } from "@/database/queries/allowed-group";
import { webHandler } from "@/web/webHandler";

async function main() {
    await commandRouter.loadCommands();
    await createDummyUser();

    const httpServer = serve({
        routes: webHandler,
        async fetch(request: Request): Promise<Response> {
            if (request.method == 'POST') {
                // Check if the request path matches the secret webhook path
                const url = new URL(request.url);
                const expectedPath = process.env.SECRET_PATH;
                sendToLogger(`Request path: ${url.pathname}, Expected: ${expectedPath}`);

                if (url.pathname !== expectedPath) {
                    return new Response('Unauthorized', { status: 401 });
                }

                try {
                    const payload = await request.text();
                    const result = await whatsapp.handleWebhook(payload);

                    if (result?.group && !findAllowedGroup(result.sender)) {
                        sendToLogger(`Unauthorized group access: ${result.sender}`);
                        return new Response('Unauthorized', { status: 401 });
                    }

                    if (result) {
                        await commandRouter.handle(result);
                    }

                    return new Response('OK', { status: 200 });

                } catch (error) {
                    sendToLogger(`Webhook error: ${error}`);
                    return new Response('Internal server error', { status: 500 });
                }
            }
            return new Response('MaiBot is running', { status: 200 });

        }
    });

    console.log(`Bun Server listening on ${httpServer.hostname}:${httpServer.port}`)
}

main();