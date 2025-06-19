import { findUserByPhoneWithFavSong } from "@/database/queries/user-query";
import { CommandExecutor } from "@/services/command-executor";
import type { Command, EffectCommand } from "@/types/command";
import { Effect } from "effect";

const me: EffectCommand = {
    name: "me",
    adminOnly: false,
    enabled: true,
    description: "Tampilkan secara detail informasi akun anda",
    commandAvailableOn: "both",
    usageExample: "`me`",
    execute: (ctx) => Effect.gen(function* () {
        const executor = yield* CommandExecutor;
        const user = yield* Effect.promise(() => findUserByPhoneWithFavSong(ctx.rawPayload));

        let message = "📱 Informasi Akun Anda\n\n";
        message += `Nama: ${user.name}\n`;
        message += `ID Publik: ${user.publicId}\n`;
        message += `Bio: ${user.bio}\n`;
        message += `Status: ${user.isBanned ? '❌ Diblokir' : '✅ Aktif'}\n\n`;

        if (user.favoriteSongData) {
            message += "🎵 Lagu Favorit:\n";
            message += `${user.favoriteSongData.title} - ${user.favoriteSongData.artist}\n\n`;
        }

        message += "Terima kasih telah menggunakan MaiBot! 🙏";

        yield* executor.reply(message);
    })
}

export default me;