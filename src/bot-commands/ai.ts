import { defineCommand, type BotCommand } from "@/contracts/bot-command";
import { CommandExecutor } from "@/contracts/command-executor";
import { MaiSongData } from "@/contracts/maisong-data";
import type { SearchResult, Sheet, Song } from "@/contracts/api";
import { Effect } from "effect";

export default defineCommand(dependencies => ({
    name: "ai",
    adminOnly: false,
    enabled: true,
    description: "MAI.ai (BETA)",
    commandAvailableOn: "both",
    usageExample: "`ai tolong beritahu lagu tersulit di maimai`",
    execute: (ctx) => Effect.gen(function* () {
        //yield* dependencies.executor.reply("Maaf ya untuk sekarang AI nya dimatiin karena rada suram wkwkwkwkwk");

        yield* dependencies.executor.reply("Sebentar ya, lagi aku pikirin...");

        const query = ctx.rawParams.trim();
        const result = yield* dependencies.maiAi.infer(query)

        yield* dependencies.executor.reply(result);
    })
}))
