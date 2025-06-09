import { findUserByPhone } from "@/database/queries/user-query";
import type { Command } from "@/types/command";

const me: Command = {
    name: "me",
    adminOnly: false,
    enabled: true,
    description: "Tampilkan secara detail informasi akun anda",
    commandAvailableOn: "both",
    usageExample: "`me`",
    execute: async (ctx) => {
        const user = await findUserByPhone(ctx.rawPayload);

        let message = "📱 Informasi Akun Anda\n\n";
        message += `Nama: ${user.name}\n`;
        message += `ID Publik: ${user.publicId}\n`;
        message += `Bio: ${user.bio}\n`;
        message += `Status: ${user.isBanned ? '❌ Diblokir' : '✅ Aktif'}\n\n`;
        message += "Terima kasih telah menggunakan MaiBot! 🙏";

        await ctx.reply(message);
    }
}

export default me;