import { configDatabase } from "@/database/drizzle";
import { findUserByPhoneWithFavSong } from "@/database/queries/user-query";
import { admins } from "@/database/schemas/config-schema";
import { CommandExecutor } from "@/services/command-executor";
import type { Command } from "@/types/command";
import { Effect } from "effect";
import z from "zod";

const loaddata: Command = {
    name: "addadmin",
    enabled: true,
    adminOnly: true,
    description: "Load data maimai DX kamu menggunakan bookmarklet!",
    commandAvailableOn: "private",
    usageExample: "`loaddata`",
    execute: (ctx) => Effect.gen(function* () {
        const executor = yield* CommandExecutor;
        const host = process.env.HOST || "";
        const user = yield* Effect.promise(() => findUserByPhoneWithFavSong(ctx.rawPayload));

       let message = "*Load maimai data*"
       message += "\nIkuti langkah berikut untuk memasukkan data maimai (rating, top 50):"
       message += "\n\nBuka link berikut:"
       message += host + "/bookmarklet#token=" + user.phoneNumberHash
       message += "\n_(Note: Link ini privat, jangan dibagikan!)_"
    })
}

export default loaddata;