import { serve } from "bun";
import { webHandler } from "@/web/webHandler";
import { findUserByPhone } from "@/database/queries/user-query.ts";
import { Effect, Layer } from "effect";
import { WahaWhatsappService } from "@/services/waha";
import { DatabaseRateLimiterService } from "@/services/rate-limiter";
import { CommandRouterService, CommandRouterServiceLive } from "@/services/command-router";
import { WhatsAppGatewayService } from "@/types/whatsapp-gateway";
import { EnvLive } from "@/services/env";

export const MainDependencies = Layer.mergeAll(
    EnvLive,
    WahaWhatsappService,
    DatabaseRateLimiterService,
    CommandRouterServiceLive
);

async function main() {
    // Test WA dependency configuration
    const test = Effect.gen(function* () {
        const commands = yield* CommandRouterService;
        const whatsapp = yield* WhatsAppGatewayService;
        const commandList = yield* commands.loadCommands();

        console.log("✅ App bootstrap succeeded!");
        console.log("- WhatsApp Provider:", whatsapp.name)
        console.log("- Provider capabilities:", whatsapp.capabilities.join(", "));
        console.log("\n📋 Available Commands:");
        
        console.table(
            commandList.map(cmd => ({
                Name: cmd.name,
                Available: cmd.commandAvailableOn,
                Enabled: cmd.enabled ? "✅" : "❌",
                "Admin Only": cmd.adminOnly ? "🔒" : "👥"
            }))
        );

        yield* Effect.succeed(void 0);
    });

    await Effect.runPromise(
        test.pipe(
            Effect.provide(MainDependencies),
            Effect.catchAll((error) => 
                Effect.gen(function* () {
                    const message = error.message || String(error);
                    console.error("Bootstrap app failed:");
                    console.error(message);
                    yield* Effect.sync(() => process.exit(1));
                })
            )
        )
    );

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