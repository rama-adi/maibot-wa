import { defineCommand, type BotCommand } from "@/contracts/bot-command";
import { CommandExecutor } from "@/contracts/command-executor";
import { MaiSongData } from "@/contracts/maisong-data";
import type { SearchResult, Sheet, Song } from "@/contracts/api";
import { Effect } from "effect";

export default defineCommand(dependencies => ({
    name: "help",
    adminOnly: false,
    enabled: true,
    description: "Tampilkan daftar perintah yang tersedia",
    commandAvailableOn: "both",
    usageExample: "`help`",
    execute: (ctx) => Effect.gen(function* () {

        const publicCommand = ctx
            .availableCommands
            .filter(cmd => !cmd.adminOnly)
            .filter(cmd => cmd.enabled)
            .map(cmd => `- ${cmd.name}: ${cmd.description} (Contoh: ${cmd.usageExample})`)
            .join("\n");



        let messagePart = "Selamat datang di WhatsApp MaiBot by Rama!\n\nDaftar perintah yang tersedia:\n";
        messagePart += publicCommand;

        if (ctx.isAdmin) {
            messagePart += "\n\nAnda adalah admin, berikut command tambahan yang tersedia (DM ONLY):\n";
            messagePart += ctx
                .availableCommands
                .filter(cmd => cmd.adminOnly)
                .map(cmd => `- ${cmd.name}: ${cmd.description} (Contoh: ${cmd.usageExample})`)
                .join("\n");
        }

        messagePart += "\n\nCara menggunakan:\n";
        messagePart += "- Via DM: Ketik perintah yang ingin Anda gunakan diikuti dengan lanjutan isian. Contoh: `music folern` atau `music eta beta eta`\n";
        messagePart += "- Via Group: Hampir mirip, namun harus tag akun ini di grup yang ada akun ini. Contoh: `@Onebyte Tech music folern` atau `@Onebyte Tech music eta beta eta`\n";

        messagePart += "\nPenggunaan via DM gratis, dengan batas wajar. Untuk penggunaan via grup, silakan kontak Rama untuk mendapatkan whitelist grup. \n\n";
        messagePart += "Gunakan secara sewajarnya, jangan spam karena ada batas bulanan. \n\n";
        messagePart += "Jika ada kendala, silakan kontak Rama untuk bantuan. \n\n";

        yield* dependencies.executor.reply(messagePart);
    })
}))
