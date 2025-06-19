
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
    });

    console.log(`Bun Server listening on ${httpServer.hostname}:${httpServer.port}`)
}

main();