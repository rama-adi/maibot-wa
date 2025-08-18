import { Config, Effect, Redacted } from "effect";
import { buildURL } from "./utils/url";
import { WhatsAppGatewayService } from "./contracts/whatsapp-gateway";
import { WahaWSWhatsappService, wahaWSConfig } from "./services/wahaWS";

// I'm using WAHA WS so I can test locally
// Technically, you could just change this implementation. All the contracts are there
export function bootstrapWhatsappWS() {
    const bootstrapEffect = Effect.gen(function* () {
        // Get configuration and build WebSocket URL
        const config = yield* wahaWSConfig;
        const url = yield* buildURL(config.wssUrl, {
            "x-api-key": Redacted.value(config.apiKey),
            "session": config.session,
            "events": "message"
        });

        // Create WebSocket
        const socket = new WebSocket(url.toString());

        // Program to handle incoming messages
        const program = (data: string) => Effect.gen(function* () {
            const gateway = yield* WhatsAppGatewayService;
            const result = yield* gateway.handleWebhook(data, new Headers());
            return result;
        });

        // Set up WebSocket event listener
        socket.addEventListener("message", async event => {

            try {
                const result = await Effect.runPromise(program(event.data).pipe(
                    Effect.provide(WahaWSWhatsappService)
                ));
                console.log("RESULT:", result);
            } catch (error) {
                console.error("Error processing webhook:", error);
            }
        });

        socket.addEventListener("open", () => {
            console.log("WebSocket connected successfully");
        });

        socket.addEventListener("error", (error) => {
            console.error("WebSocket error:", error);
        });

        socket.addEventListener("close", () => {
            console.log("WebSocket connection closed");
        });

        return socket;
    });

    // Run the bootstrap effect and handle any errors
    Effect.runSync(bootstrapEffect.pipe(
        Effect.tapError((error) => Effect.sync(() => {
            console.error("Bootstrap failed:", error);
            process.exit(1);
        }))
    ));
}

bootstrapWhatsappWS();