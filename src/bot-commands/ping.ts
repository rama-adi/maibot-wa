import { defineCommand, type BotCommand } from "@/contracts/bot-command";
import { CommandExecutor } from "@/contracts/command-executor";
import { MaiSongData } from "@/contracts/maisong-data";
import { Effect } from "effect";

export default defineCommand(dependencies => ({
    name: "ping",
    enabled: true,
    adminOnly: false,
    description: "Pasikan command berfungsi",
    usageExample: "`ping`",
    commandAvailableOn: "both",
    execute: (ctx) => Effect.gen(function* () {
        yield* dependencies.executor.reply("PONG");
    })
}))
