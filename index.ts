

import { serve } from "bun";
import { webHandler } from "@/web/webHandler";
import {findUserByPhone} from "@/database/queries/user-query.ts";

async function main() {
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