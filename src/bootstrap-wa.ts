import { Config, Effect, Redacted, Layer } from "effect";
import { buildURL } from "./utils/url";
import { WhatsAppGatewayService } from "./contracts/whatsapp-gateway";
import { WahaWSWhatsappService, wahaWSConfig } from "./services/wahaWS";
import { LiveRuntimeContainer } from "../container";
import { CommandRouterService } from "./contracts/command-router";
import { CommandRouterServiceLive } from "./services/command-router";
import { createCommandExecutor } from "./services/command-executor";
import { LockService } from "./contracts/lock";

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

        // Program to handle incoming messages with command routing
        const program = (data: string) => Effect.gen(function* () {
            const gateway = yield* WhatsAppGatewayService;
            const lockService = yield* LockService;
            
            // Parse the webhook to get WhatsApp payload
            const payload = yield* gateway.handleWebhook(data, new Headers());
            
            // If we have a valid payload, route it through the command system
            if (payload && payload.message) {
                // Create lock key using message ID to prevent spam/duplicate processing
                const lockKey = `message_lock:${payload.messageId}`;
                
                // Try to acquire lock with 5 minute expiry (300 seconds)
                const lockAcquired = yield* lockService.acquire(lockKey, { 
                    expiry: 300, // 5 minutes in seconds
                    limit: 1 
                });
                
                if (!lockAcquired) {
                    // Message is already being processed or was recently processed
                    return payload;
                }
                
                try {
                    // Create command executor for this specific message
                    const executorLayer = createCommandExecutor(payload);
                    
                    // Create router layer with all dependencies
                    const routerWithDeps = Layer.provide(
                        CommandRouterServiceLive,
                        Layer.mergeAll(LiveRuntimeContainer, executorLayer)
                    );
                    
                    // Load commands and handle the message
                    yield* Effect.gen(function* () {
                        const commandRouter = yield* CommandRouterService;
                        yield* commandRouter.loadCommands();
                        yield* commandRouter.handle(payload);
                    }).pipe(Effect.provide(routerWithDeps));
                } finally {
                    // Note: We don't release the lock immediately to prevent rapid re-processing
                    // The lock will expire after 5 minutes automatically
                }
            }
            
            return payload;
        });

        // Create the base layer without CommandRouterService (it's created per-message)
        const baseLayer = Layer.mergeAll(
            LiveRuntimeContainer,
            WahaWSWhatsappService
        );

        // Set up WebSocket event listener
        socket.addEventListener("message", async event => {
            try {
                const result = await Effect.runPromise(program(event.data).pipe(
                    Effect.provide(baseLayer)
                ));
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

//bootstrapWhatsappWS();