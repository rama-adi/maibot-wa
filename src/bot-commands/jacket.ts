import { defineCommand } from "@/contracts/bot-command";
import { Effect } from "effect";

export default defineCommand(dependencies => ({
    name: "jacket",
    enabled: true,
    adminOnly: false,
    description: "Ambil jacket lagu dari judul (top 1 only)",
    usageExample: "`jacket xaleidoscopix`",
    commandAvailableOn: "both",
    execute: (ctx) => Effect.gen(function* () {
        const query = ctx.rawParams.trim();
        const searchResults = yield* dependencies.maiSongData.byTitle(query);

        if (searchResults.length === 0) {
            yield* dependencies.executor.reply(`Tidak ada lagu yang ditemukan untuk pencarian: ${query}`);
            return;
        }
        // Get the first search result
        const result = searchResults[0];
        if (!result) {
            yield* dependencies.executor.reply(`Tidak ada lagu yang ditemukan untuk pencarian: ${query}`);
            return;
        }
        const primarySong = result.primary;

        if(!primarySong.r2ImageUrl) {
            yield* dependencies.executor.reply(`Lagu ${query} tidak memiliki jacket`);
            return;
        }

        yield* dependencies.executor.replyImage(primarySong.r2ImageUrl, {
            caption: `Ini dia jacket untuk lagu ${primarySong.title}`,
            mime: "image/png",
            filename: `Jacket-${primarySong.title}`
        });
    })
}))
