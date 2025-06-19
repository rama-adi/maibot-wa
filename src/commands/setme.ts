import { findUserByPhone } from "@/database/queries/user-query";
import type { EffectCommand } from "@/types/command";
import { z } from "zod";
import { setUserDetail } from "@/database/queries/user-query";
import { findSongByInternalId } from "@/database/queries/song-queries";
import { Effect } from "effect";
import { CommandExecutor } from "@/services/command-executor";

const setmeSchema = z.object({
    name: z.string().optional(),
    bio: z.string().optional(),
    favSong: z.number().optional(),
})

const setme: EffectCommand = {
    name: "setme",
    adminOnly: false,
    enabled: true,
    description: "Atur detail informasi akun anda",
    commandAvailableOn: "both",
    usageExample: "`setme name john doe, bio i love maimai, favsong 123`",
    execute: (ctx) => Effect.gen(function* () {
        const executor = yield* CommandExecutor;
        const rawParams = ctx.rawParams.trim();
        const user = yield* Effect.promise(() => findUserByPhone(ctx.rawPayload));

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
            message += "`setme name <nama>, bio <bio>, favsong <nomor>`";
            return yield* executor.reply(message);
        }

        try {
            const validatedParams = setmeSchema.parse(parseSetmeParams(rawParams));

            if (!validatedParams.name && !validatedParams.bio && !validatedParams.favSong) {
                return yield* executor.reply("❌ Format tidak valid!\n\nGunakan: `setme name <nama>, bio <bio>, favsong <nomor>`\n\nContoh: `setme name John Doe, bio Saya suka maimai, favsong 123`");
            }

            // Validate song ID and get song details if provided
            let songDetails = null;
            if (validatedParams.favSong) {
                songDetails = yield* Effect.promise(() => findSongByInternalId(validatedParams.favSong || 0));
                if (!songDetails) {
                    return yield* executor.reply("❌ ID lagu tidak valid! Pastikan ID lagu yang dimasukkan benar.");
                }
            }

            const buildResultMessage = (isDryRun = false) => {
                const prefix = isDryRun ? "🔧 DRY RUN - Parsing berhasil!" : "✅ Informasi berhasil diperbarui!";
                const fields = [
                    validatedParams.name && `📝 Nama: ${validatedParams.name}`,
                    validatedParams.bio && `📄 Bio: ${validatedParams.bio}`,
                    validatedParams.favSong && songDetails && `🎵 Lagu Favorit: ${songDetails.title}`
                ].filter(Boolean).join('\n');
                const suffix = isDryRun ? "✅ Format parsing valid - tidak ada perubahan disimpan untuk admin." : "🎉 Perubahan telah disimpan!";
                return `${prefix}\n\n${fields ? `📋 Parameter yang diparse:\n${fields}\n\n` : ''}${suffix}`;
            };

            // Dry run for admin
            if (ctx.rawPayload.number === "INTERNAL_ADMIN") {
                return yield* executor.reply(buildResultMessage(true));
            }

            if (!user.phoneNumberHash) {
                return yield* executor.reply("❌ Terjadi kesalahan sistem. Silakan coba lagi.");
            }

            yield* Effect.promise(() => setUserDetail(user.phoneNumberHash, validatedParams));
            yield* executor.reply(buildResultMessage());

        } catch (error) {
            const message = error instanceof z.ZodError
                ? "❌ Format parameter tidak valid!\n\nGunakan: `setme name <nama>, bio <bio>, favsong <nomor>`"
                : "❌ Terjadi kesalahan saat memperbarui informasi. Silakan coba lagi.";

            if (!(error instanceof z.ZodError)) {
                console.error('Error updating user details:', error);
            }

            yield* executor.reply(message);
        }
    })
}

function parseSetmeParams(rawParams: string): { name?: string, bio?: string, favSong?: number } {
    const result: { name?: string, bio?: string, favSong?: number } = {};
    const parts = rawParams.split(',');
    let currentField = '';
    let currentValue = '';

    const saveField = () => {
        if (currentField && currentValue) {
            if (currentField === 'favSong') {
                const numValue = parseInt(currentValue.trim(), 10);
                if (!isNaN(numValue)) {
                    result.favSong = numValue;
                }
            } else {
                result[currentField as 'name' | 'bio'] = currentValue.trim();
            }
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
        } else if (trimmed.startsWith('favsong ')) {
            saveField();
            currentField = 'favSong';
            currentValue = trimmed.substring(8);
        } else if (currentField) {
            currentValue += (currentValue ? ', ' : '') + trimmed;
        }
    }

    saveField();
    return result;
}

export default setme;