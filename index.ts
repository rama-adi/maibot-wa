import {serve} from "bun";
import {webHandler} from "@/web/webHandler";
import {findUserByPhone} from "@/database/queries/user-query.ts";
import {Effect, Layer} from "effect";
import {WahaWhatsappService} from "@/services/waha";
import {DatabaseRateLimiterService} from "@/services/rate-limiter";
import {CommandRouterServiceLive} from "@/services/command-router";
import {WhatsAppGatewayService} from "@/types/whatsapp-gateway";

export const MainDependencies = Layer.mergeAll(
    WahaWhatsappService,
    DatabaseRateLimiterService,
    CommandRouterServiceLive
);

async function main() {
    // Test WA dependency configuration
    try {
        const test = Effect.gen(function* () {
            const whatsapp = yield* WhatsAppGatewayService;
            return yield * whatsapp.handleWebhook("", new Headers());
        });

        await Effect.runPromise(test.pipe(Effect.provide(MainDependencies)));
        console.log("✅ WAHA service configuration validated successfully");
    } catch (error) {
        console.error("❌ WAHA service configuration failed:", error);
        console.error("Please check your environment variables and try again.");
        process.exit(1);
    }

    const fakeUser = await findUserByPhone({
        sender: "INTERNAL_ADMIN",
        message: "test",
        group: false,
        number: "INTERNAL_ADMIN",
        name: "Tester Admin Account",
        messageId: null
    });

    console.log("Fake user loaded", fakeUser.name, fakeUser.phoneNumberHash);

    const httpServer = serve({
        routes: webHandler,
    });

    console.log(`Bun Server listening on ${httpServer.hostname}:${httpServer.port}`)
}

main();