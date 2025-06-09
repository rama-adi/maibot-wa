import { findUserByPhone } from "@/database/queries/user-query";
import type { Command } from "@/types/command";
import { z } from "zod";
import { setUserDetail } from "@/database/queries/user-query";

const setmeSchema = z.object({
    name: z.string().optional(),
    bio: z.string().optional()
})

const setme: Command = {
    name: "setme",
    adminOnly: false,
    enabled: true,
    description: "Atur detail informasi akun anda",
    commandAvailableOn: "both",
    usageExample: "`setme name john doe, bio i love maimai`",
    execute: async (ctx) => {
        const rawParams = ctx.rawParams.trim();
        const user = await findUserByPhone(ctx.rawPayload);

        // Show current info if no parameters
        if (!rawParams) {
            const status = user.isBanned ? '❌ Diblokir' : '✅ Aktif';
            let message = "📱 Informasi Akun Anda\n\n";
            message += `Nama: ${user.name}\n`;
            message += `ID Publik: ${user.publicId}\n`;
            message += `Bio: ${user.bio}\n`;
            message += `Status: ${status}\n\n`;
            message += "Terima kasih telah menggunakan MaiBot! 🙏\n\n";
            message += "💡 Untuk mengubah informasi, gunakan:\n";
            message += "`setme name <nama>, bio <bio>`";
            return await ctx.reply(message);
        }

        try {
            const validatedParams = setmeSchema.parse(parseSetmeParams(rawParams));
            
            if (!validatedParams.name && !validatedParams.bio) {
                return await ctx.reply("❌ Format tidak valid!\n\nGunakan: `setme name <nama>, bio <bio>`\n\nContoh: `setme name John Doe, bio Saya suka maimai`");
            }

            const buildResultMessage = (isDryRun = false) => {
                const prefix = isDryRun ? "🔧 DRY RUN - Parsing berhasil!" : "✅ Informasi berhasil diperbarui!";
                const fields = [
                    validatedParams.name && `📝 Nama: ${validatedParams.name}`,
                    validatedParams.bio && `📄 Bio: ${validatedParams.bio}`
                ].filter(Boolean).join('\n');
                const suffix = isDryRun ? "✅ Format parsing valid - tidak ada perubahan disimpan untuk admin." : "🎉 Perubahan telah disimpan!";
                return `${prefix}\n\n${fields ? `📋 Parameter yang diparse:\n${fields}\n\n` : ''}${suffix}`;
            };

            // Dry run for admin
            if (ctx.rawPayload.number === "INTERNAL_ADMIN") {
                return await ctx.reply(buildResultMessage(true));
            }

            if (!user.phoneNumberHash) {
                return await ctx.reply("❌ Terjadi kesalahan sistem. Silakan coba lagi.");
            }

            await setUserDetail(user.phoneNumberHash, validatedParams);
            await ctx.reply(buildResultMessage());

        } catch (error) {
            const message = error instanceof z.ZodError 
                ? "❌ Format parameter tidak valid!\n\nGunakan: `setme name <nama>, bio <bio>`"
                : "❌ Terjadi kesalahan saat memperbarui informasi. Silakan coba lagi.";
            
            if (!(error instanceof z.ZodError)) {
                console.error('Error updating user details:', error);
            }
            
            await ctx.reply(message);
        }
    }
}

function parseSetmeParams(rawParams: string): { name?: string, bio?: string } {
    const result: { name?: string, bio?: string } = {};
    const parts = rawParams.split(',');
    let currentField = '';
    let currentValue = '';
    
    const saveField = () => {
        if (currentField && currentValue) {
            result[currentField as 'name' | 'bio'] = currentValue.trim();
        }
    };
    
    for (const part of parts) {
        const trimmed = part.trim();
        
        if (trimmed.startsWith('name ')) {
            saveField();
            currentField = 'name';
            currentValue = trimmed.substring(5);
        } else if (trimmed.startsWith('bio ')) {
            saveField();
            currentField = 'bio';
            currentValue = trimmed.substring(4);
        } else if (currentField) {
            currentValue += (currentValue ? ', ' : '') + trimmed;
        }
    }
    
    saveField();
    return result;
}

export default setme;