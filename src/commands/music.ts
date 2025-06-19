import {findUserByPhoneWithFavSong} from "@/database/queries/user-query";
import {CommandExecutor} from "@/services/command-executor";
import {searchSongByTitle} from "@/services/typesense";
import type {Command} from "@/types/command";
import {Effect} from "effect";

const minfo: Command = {
    name: "music",
    enabled: true,
    adminOnly: false,
    description: "Dapatkan informasi musik dari pencarian Anda",
    usageExample: "`music folern` / `music tsunagite`",
    commandAvailableOn: "both",
    execute: (ctx) => Effect.gen(function* () {
        const executor = yield* CommandExecutor;

        const query = ctx.rawParams.trim();

        // Use Effect.tryPromise for better error handling
        const searchResults = yield* Effect.tryPromise({
            try: () => searchSongByTitle(query),
            catch: (error) => new Error(`Failed to search songs: ${error}`)
        });

        const userSong = yield* Effect.tryPromise({
            try: () => findUserByPhoneWithFavSong(ctx.rawPayload),
            catch: (error) => new Error(`Failed to fetch user song data: ${error}`)
        });

        if (searchResults.length === 0) {
            yield* executor.reply(`Tidak ada lagu yang ditemukan untuk pencarian: ${query}`);
            return;
        }

        // Get the first search result
        const result = searchResults[0];
        const primarySong = result.primary;
        const utages = result.utages;

        // Helper function to format difficulty levels - pure function
        const formatDifficulties = (sheets: any[], type: string): string | null => {
            const typeSheets = sheets.filter(sheet => sheet.type === type);
            if (typeSheets.length === 0) return null;

            const difficulties = ['basic', 'advanced', 'expert', 'master', 'remaster'] as const;
            const difficultyAbbr: Record<typeof difficulties[number], string> = {
                basic: '🟩B',
                advanced: '🟨A',
                expert: '🟥E',
                master: '🟪M',
                remaster: '⬜Re'
            };

            const formatted = difficulties
                .map(diff => {
                    const sheet = typeSheets.find(s => s.difficulty === diff);
                    if (!sheet) return null;

                    const level = sheet.level;
                    const constant = sheet.internalLevelValue || sheet.levelValue;
                    return `${difficultyAbbr[diff]} ${level}(${constant.toFixed(1)})`;
                })
                .filter(Boolean)
                .join(' / ');

            return formatted;
        };

        // Helper function to check region availability - pure function
        const hasRegion = (region: 'cn' | 'intl' | 'jp'): boolean => {
            return primarySong.sheets.some((sheet: any) =>
                sheet.regions && sheet.regions[region] === true
            );
        };

        // Build reply text using Effect.sync for side-effect-free computation
        const replyText = yield* Effect.sync(() => {
            let text = `Hasil pencarian lagu _${query}_ berhasil!\n\n`;

            if (userSong.favoriteSongData) {
                text += `Judul: ${primarySong.title}\n (⭐ Favorit)`;
            } else {
                text += `Judul: ${primarySong.title}\n`;
            }
            text += `Artis: ${primarySong.artist}\n`;
            text += `Versi: ${primarySong.version}\n`;
            text += `ID Lagu: ${primarySong.internalProcessId} _(Untuk set lagu favorit)_\n`;

            // Add DX version if available and different from main version
            const dxSheets = primarySong.sheets.filter(sheet => sheet.type === 'dx');
            if (dxSheets.length > 0 && dxSheets[0].version && dxSheets[0].version !== primarySong.version) {
                text += `Versi (DX): ${dxSheets[0].version}\n`;
            }

            if (primarySong.bpm) {
                text += `BPM: ${primarySong.bpm}\n`;
            }

            text += `\n`;
            text += "🆕 Baru! Gunakan ID lagu untuk mengatur lagu favorit di profilmu. cek perintah `setme` !\n\n"

            // Add song availability based on sheets regions
            text += `Tersedia di: `;
            const cn = hasRegion('cn') ? '✅' : '❌';
            const intl = hasRegion('intl') ? '✅' : '❌';
            const jp = hasRegion('jp') ? '✅' : '❌';
            text += `🇨🇳: ${cn} / 🌏: ${intl} / 🇯🇵: ${jp}\n`;

            text += `\n`;

            // Get available chart types for this song
            const availableTypes = [...new Set(primarySong.sheets.map((sheet: any) => sheet.type))];

            // Format DX difficulties
            if (availableTypes.includes('dx')) {
                const dxDifficulties = formatDifficulties(primarySong.sheets, 'dx');
                if (dxDifficulties) {
                    text += `Level(DX):\n${dxDifficulties}\n`;
                }
            }

            // Format ST difficulties (try both 'std' and 'standard')
            if (availableTypes.includes('std') || availableTypes.includes('standard')) {
                const stDifficulties = formatDifficulties(primarySong.sheets, 'std') ||
                    formatDifficulties(primarySong.sheets, 'standard');
                if (stDifficulties) {
                    text += `\nLevel(ST):\n${stDifficulties}\n`;
                }
            }

            // If no DX or ST, show whatever types are available
            if (!availableTypes.includes('dx') && !availableTypes.includes('std') && !availableTypes.includes('standard')) {
                for (const type of availableTypes) {
                    if (type !== 'utage') {
                        const difficulties = formatDifficulties(primarySong.sheets, type);
                        if (difficulties) {
                            text += `\nLevel(${type.toUpperCase()}):\n${difficulties}\n`;
                        }
                    }
                }
            }

            // Add utage comments for each utage version
            if (utages.length > 0) {
                text += `\nLevel [宴]:`;
                utages.forEach((utage, index) => {
                    if (utage.comment) {
                        const prefix = utages.length > 1 ? `${index + 1}. ${utage.sheets[0].difficulty}` : utage.sheets[0].difficulty;
                        text += `\n${prefix} (ID ${utage.internalProcessId}) ${utage.sheets[0].level} Komentar: ${utage.comment}`;
                    }
                });

                text += `\n\n⚠️ *PERINGATAN PENTING U･TA･GE:*\n• *Minimal rating 10000 untuk bermain*\n• *Mode ini TIDAK menaikkan rating sama sekali*\n• *Jika main 2P, pastikan partner setuju main mode ini agar tidak terjadi masalah*\n• *Bila 2P tidak setuju, tidak boleh memaksakan main mode ini*`;
            }

            if (searchResults.length > 1) {
                text += `\n\nSaya juga menemukan beberapa lagu lain yang mungkin terkait dengan pencarian Anda:\n`;
                const otherResults = searchResults.slice(1, 5);
                text += otherResults.map((result: any) => `- ${result.primary.title} (${result.primary.artist}) (ID ${result.primary.internalProcessId})`).join('\n');
                text += `\nJika ini adalah lagu yang Anda cari, Anda dapat menggunakan perintah lagi dengan judul lagu untuk mendapatkan informasi lebih lanjut tentang lagu tersebut`;
            }

            return text;
        });

        yield* executor.reply(replyText);
    })
}

export default minfo;