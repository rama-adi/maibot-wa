import { defineCommand, type BotCommand } from "@/contracts/bot-command";
import { CommandExecutor } from "@/contracts/command-executor";
import { MaiSongData } from "@/contracts/maisong-data";
import type { SearchResult, Sheet, Song } from "@/contracts/api";
import { Effect } from "effect";
import dedent from "dedent";

export default defineCommand(dependencies => ({
    name: "music",
    enabled: true,
    adminOnly: false,
    description: "Dapatkan informasi musik dari pencarian Anda",
    usageExample: "`music folern` / `music XaleidoscopiX`",
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
        const utages = result.utages;

        // Helper function to format difficulty levels - pure function
        const formatDifficulties = (sheets: Sheet[], type: string): string | null => {
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

            return difficulties
                .map(diff => {
                    const sheet = typeSheets.find(s => s.difficulty === diff);
                    if (!sheet) return null;

                    const level = sheet.level;
                    const constantValue = sheet.internalLevelValue ?? sheet.levelValue;
                    let constantDisplay = '';
                    
                    if (constantValue != null) {
                        let formattedConstant = '';
                        
                        if (typeof constantValue === 'number') {
                            formattedConstant = constantValue.toFixed(1).replace(/\.0$/, '');
                        } else if (typeof constantValue === 'string' && !isNaN(Number(constantValue))) {
                            const numValue = Number(constantValue);
                            formattedConstant = numValue.toFixed(1).replace(/\.0$/, '');
                        } else if (constantValue) {
                            formattedConstant = String(constantValue);
                        }
                        
                        // Only show constant if it's different from the level
                        if (formattedConstant && formattedConstant !== level) {
                            constantDisplay = `(${formattedConstant})`;
                        }
                    }
                    
                    return `${difficultyAbbr[diff]} ${level}${constantDisplay}`;
                })
                .filter(Boolean)
                .join(' / ');
        };

        // Helper function to check region availability - pure function
        const hasRegion = (region: 'cn' | 'intl' | 'jp'): boolean => {
            return primarySong.sheets.some((sheet: Sheet) =>
                sheet.regions && sheet.regions[region] === true
            );
        };

        // Build reply text using Effect.sync for side-effect-free computation
        const replyText = yield* Effect.sync(() => {
           

            // Get DX version info if available and different from main version
            const dxSheets = primarySong.sheets.filter(sheet => sheet.type === 'dx');
            const dxVersionInfo = (dxSheets.length > 0 && dxSheets[0]?.version && dxSheets[0].version !== primarySong.version) 
                ? `\nVersi (DX): ${dxSheets[0].version}` 
                : '';

            const bpmInfo = primarySong.bpm ? `\nBPM: ${primarySong.bpm}` : '';

            // Add song availability based on sheets regions
            const cn = hasRegion('cn') ? '✅' : '❌';
            const intl = hasRegion('intl') ? '✅' : '❌';
            const jp = hasRegion('jp') ? '✅' : '❌';

            // Get available chart types for this song
            const availableTypes = [...new Set(primarySong.sheets.map((sheet: Sheet) => sheet.type))];

            // Format DX difficulties
            const dxLevels = availableTypes.includes('dx') 
                ? formatDifficulties(primarySong.sheets, 'dx')
                : null;
            const dxSection = dxLevels ? `\n\nLevel(DX):\n${dxLevels}` : '';

            // Format ST difficulties (try both 'std' and 'standard')
            const stLevels = (availableTypes.includes('std') || availableTypes.includes('standard'))
                ? formatDifficulties(primarySong.sheets, 'std') || formatDifficulties(primarySong.sheets, 'standard')
                : null;
            const stSection = stLevels ? `\n\nLevel(ST):\n${stLevels}` : '';

            // If no DX or ST, show whatever types are available
            const otherLevels = (!availableTypes.includes('dx') && !availableTypes.includes('std') && !availableTypes.includes('standard'))
                ? availableTypes
                    .filter(type => type !== 'utage')
                    .map(type => {
                        const difficulties = formatDifficulties(primarySong.sheets, type);
                        return difficulties ? `\n\nLevel(${type.toUpperCase()}):\n${difficulties}` : '';
                    })
                    .join('')
                : '';

            // Build utage section
            const utageLines = utages.length > 0 
                ? utages
                    .map((utage, index) => {
                        if (utage.comment && utage.sheets?.[0]) {
                            const prefix = utages.length > 1 ? `${index + 1}. ${utage.sheets[0].difficulty}` : utage.sheets[0].difficulty;
                            return `${prefix} (ID ${utage.internalProcessId}) ${utage.sheets[0].level} Komentar: ${utage.comment}`;
                        }
                        return '';
                    })
                    .filter(Boolean)
                    .join('\n')
                : '';

            const utageSection = utages.length > 0 ? dedent`
                Level [${'宴'}]:
                ${utageLines}

                ${'⚠️'} *PERINGATAN PENTING U${'･'}TA${'･'}GE:*
                - *Minimal rating 10000 untuk bermain*
                - *Mode ini TIDAK menaikkan rating sama sekali*
                - *Jika main 2P, pastikan partner setuju main mode ini agar tidak terjadi masalah*
                - *Bila 2P tidak setuju, tidak boleh memaksakan main mode ini*
            ` : '';

            // Build other results section
            const otherResultsSection = searchResults.length > 1 ? dedent`
                Saya juga menemukan beberapa lagu lain yang mungkin terkait dengan pencarian Anda:
                ${searchResults.slice(1, 5).map((result: SearchResult) => `- ${result.primary.title} (${result.primary.artist}) (ID ${result.primary.internalProcessId})`).join('\n')}
                Jika ini adalah lagu yang Anda cari, Anda dapat menggunakan perintah lagi dengan judul lagu untuk mendapatkan informasi lebih lanjit tentang lagu tersebut
            ` : '';

            return dedent`
                Hasil pencarian lagu _${query}_ berhasil!

                Judul: ${primarySong.title}
                Artis: ${primarySong.artist}
                Versi: ${primarySong.version}${dxVersionInfo}${bpmInfo}
                Tersedia di: ${'🇨🇳'}: ${cn} / ${'🌏'}: ${intl} / ${'🇯🇵'}: ${jp}
                
                ${dxSection}
                ${stSection}
                
                ${otherLevels}
                ${utageSection}
                
                ${otherResultsSection}
            `;
        });

        yield* dependencies.executor.reply(replyText);
    })
}))
