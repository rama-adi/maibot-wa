import type { WhatsAppGatewayPayload } from "@/types/whatsapp-gateway";
import { Effect, Layer } from "effect";
import { CommandRouterService, CommandRouterServiceLive } from "./effect-command-router";
// You'll need to import your service layers here
// import { WhatsAppGatewayServiceLive } from "@/path/to/whatsapp-gateway-service";
// import { RateLimiterServiceLive } from "@/path/to/rate-limiter-service";

/**
 * Example usage of the Effect-based Command Router
 * This shows how to setup and use the new command system
 */


// APPROACH 2: Single executor creation per message (recommended)
const MainLayer = Layer.mergeAll(
    // WhatsAppGatewayServiceLive, // Uncomment and import this
    // RateLimiterServiceLive, // Uncomment and import this
    CommandRouterServiceLive
);



// Example function to process a WhatsApp message (Approach 2 - Recommended)
export const processWhatsAppMessage = (payload: WhatsAppGatewayPayload) =>
    Effect.gen(function* () {
        const router = yield* CommandRouterService;

        // Load commands if not already loaded
        yield* router.loadCommands();

        // Handle the incoming message
        yield* router.handle(payload);
    });


// Recommended approach - cleaner dependency resolution
export const runCommandRouter = (payload: WhatsAppGatewayPayload) =>
    Effect.provide(
        processWhatsAppMessage(payload),
        MainLayer
    );

/**
 * Advanced usage examples:
 */

// Error handling with Effect
export const processWhatsAppMessageWithErrorHandling = (payload: WhatsAppGatewayPayload) =>
    Effect.gen(function* () {
        yield* processWhatsAppMessage(payload);
    }).pipe(
        Effect.catchAll((error) =>
            Effect.gen(function* () {
                console.error("Command processing failed:", error);
                // Note: Error handling here would need its own executor context
                // This is just for demonstration
            })
        )
    );

// Batch processing multiple messages
export const processBatchMessages = (payloads: WhatsAppGatewayPayload[]) =>
    Effect.gen(function* () {
        const router = yield* CommandRouterService;
        yield* router.loadCommands();

        // Process all messages concurrently
        yield* Effect.all(
            payloads.map(payload => router.handle(payload)),
            { concurrency: "unbounded" }
        );
    });

// Migration helper: Convert old CommandRouterOptions to Effect
export const migrateFromOldRouter = (
    payload: WhatsAppGatewayPayload,
    onSend: (payload: WhatsAppGatewayPayload, msg: string) => Promise<void>,
    onError: (payload: WhatsAppGatewayPayload, err: unknown) => Promise<void>
) =>
    Effect.gen(function* () {
        yield* processWhatsAppMessage(payload);
    }).pipe(
        Effect.catchAll((error) =>
            Effect.promise(() => onError(payload, error))
        ),
        Effect.provide(MainLayer)
    ); 