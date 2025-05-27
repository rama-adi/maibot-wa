import { searchSongByTitle } from "@/services/typesense";
import type { Command } from "@/types/command";
import type { Song } from "@/types/arcade-song-info";

const minfo: Command = {
    name: "music",
    description: "Dapatkan informasi musik dari pencarian Anda",
    commandAvailableOn: "both",
    execute: async (ctx) => {
        const query = ctx.rawParams.trim();
        const searchResults = await searchSongByTitle(query);

        if (searchResults.length === 0) {
            await ctx.reply(`Tidak ada lagu yang ditemukan untuk pencarian: ${query}`);
            return;
        }

        // Get the first search result
        const result = searchResults[0];
        const primarySong = result.primary;
        const utages = result.utages;

        // Helper function to format difficulty levels
        const formatDifficulties = (sheets: any[], type: string) => {
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



        let replyText = `Hasil pencarian lagu _${query}_ berhasil!\n\n`;
        replyText += `Judul: ${primarySong.title}\n`;
        replyText += `Artis: ${primarySong.artist}\n`;
        replyText += `Versi: ${primarySong.version}\n`;

        // Add DX version if available and different from main version
        const dxSheets = primarySong.sheets.filter(sheet => sheet.type === 'dx');
        if (dxSheets.length > 0 && dxSheets[0].version && dxSheets[0].version !== primarySong.version) {
            replyText += `Versi (DX): ${dxSheets[0].version}\n`;
        }

        if (primarySong.bpm) {
            replyText += `BPM: ${primarySong.bpm}\n`;
        }

        replyText += `\n`;

        // Add song availability based on sheets regions
        const hasRegion = (region: 'cn' | 'intl' | 'jp') => {
            return primarySong.sheets.some((sheet: any) =>
                sheet.regions && sheet.regions[region] === true
            );
        };

        replyText += `Tersedia di: `;
        const cn = hasRegion('cn') ? '✅' : '❌';
        const intl = hasRegion('intl') ? '✅' : '❌';
        const jp = hasRegion('jp') ? '✅' : '❌';
        replyText += `🇨🇳: ${cn} / 🌏: ${intl} / 🇯🇵: ${jp}\n`;

       
        replyText += `\n`;

        // Get available chart types for this song
        const availableTypes = [...new Set(primarySong.sheets.map((sheet: any) => sheet.type))];

        // Format DX difficulties
        if (availableTypes.includes('dx')) {
            const dxDifficulties = formatDifficulties(primarySong.sheets, 'dx');
            if (dxDifficulties) {
                replyText += `Level(DX):\n${dxDifficulties}\n`;
            }
        }

        // Format ST difficulties (try both 'std' and 'standard')
        if (availableTypes.includes('std') || availableTypes.includes('standard')) {
            const stDifficulties = formatDifficulties(primarySong.sheets, 'std') ||
                formatDifficulties(primarySong.sheets, 'standard');
            if (stDifficulties) {
                replyText += `\nLevel(ST):\n${stDifficulties}\n`;
            }
        }

        // If no DX or ST, show whatever types are available
        if (!availableTypes.includes('dx') && !availableTypes.includes('std') && !availableTypes.includes('standard')) {
            for (const type of availableTypes) {
                if (type !== 'utage') {
                    const difficulties = formatDifficulties(primarySong.sheets, type);
                    if (difficulties) {
                        replyText += `\nLevel(${type.toUpperCase()}):\n${difficulties}\n`;
                    }
                }
            }
        }

        // Add utage comments for each utage version
        if (utages.length > 0) {
            replyText += `\nLevel [宴]:`;
            utages.forEach((utage, index) => {
                if (utage.comment) {
                    const prefix = utages.length > 1 ? `${index + 1}. ${utage.sheets[0].difficulty}` : utage.sheets[0].difficulty;
                    replyText += `\n${prefix} ${utage.sheets[0].level} Komentar: ${utage.comment}`;
                }
            });

            replyText += `\n\n⚠️ *PERINGATAN PENTING U･TA･GE:*\n• *Minimal rating 10000 untuk bermain*\n• *Mode ini TIDAK menaikkan rating sama sekali*\n• *Jika main 2P, pastikan partner setuju main mode ini agar tidak terjadi masalah*\n• Bila 2P tidak setuju, tidak boleh memaksakan main mode ini`;
        }

        if (searchResults.length > 1) {
            replyText += `\nSaya juga menemukan beberapa lagu lain yang mungkin terkait dengan pencarian Anda:\n`;
            const otherResults = searchResults.slice(1, 5);
            replyText += otherResults.map((result: any) => `- ${result.primary.title} (${result.primary.artist})`).join('\n');
            replyText += `\nJika ini adalah lagu yang Anda cari, Anda dapat menggunakan perintah lagi dengan judul lagu untuk mendapatkan informasi lebih lanjut tentang lagu tersebut`;
        }

        await ctx.reply(replyText);
    }
}

export default minfo;