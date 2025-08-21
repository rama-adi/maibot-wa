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
    execute: (ctx) =>
        Effect.gen(function* () {
            const query = ctx.rawParams.trim();

            const searchResults = yield* dependencies.maiSongData.byTitle(query);

            if (searchResults.length === 0) {
                yield* dependencies.executor.reply(
                    `Tidak ada lagu yang ditemukan untuk pencarian: ${query}`
                );
                return;
            }

            const result = searchResults[0];
            if (!result) {
                yield* dependencies.executor.reply(
                    `Tidak ada lagu yang ditemukan untuk pencarian: ${query}`
                );
                return;
            }

            const primarySong = result.primary;
            const utages = result.utages ?? [];

            // ---------- Helpers ----------

            // Join blocks with EXACTLY one newline; keep "" to force extra blank lines.
            const joinBlocks = (blocks: Array<string | null | undefined>) =>
                blocks
                    .map(b => (b ?? ""))          // keep "" so caller can force extra blank lines
                    .map(b => b.trim())           // trim edges of each provided block
                    .filter(b => b !== null && b !== undefined) // don't drop "" !
                    .join("\n");                  // single newline between items; "" causes consecutive "\n"

            const difficultyOrder = [
                "basic",
                "advanced",
                "expert",
                "master",
                "remaster",
            ] as const;

            const difficultyAbbr: Record<(typeof difficultyOrder)[number], string> = {
                basic: "🟩B",
                advanced: "🟨A",
                expert: "🟥E",
                master: "🟪M",
                remaster: "⬜Re",
            };

            const formatNumberish = (v: unknown): string | null => {
                if (v == null) return null;
                if (typeof v === "number" && Number.isFinite(v)) {
                    return v.toFixed(1).replace(/\.0$/, "");
                }
                if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) {
                    const n = Number(v);
                    return n.toFixed(1).replace(/\.0$/, "");
                }
                return String(v);
            };

            // Format difficulties by type (pure)
            const formatDifficulties = (sheets: Sheet[], type: string): string | null => {
                const typeSheets = sheets.filter((s) => s.type === type);
                if (typeSheets.length === 0) return null;

                const parts = difficultyOrder
                    .map((diff) => {
                        const sheet = typeSheets.find((s) => s.difficulty === diff);
                        if (!sheet) return null;

                        const level = sheet.level;
                        const constantValue =
                            sheet.internalLevelValue ?? sheet.levelValue ?? null;

                        const formattedConstant = formatNumberish(constantValue);
                        const constantDisplay =
                            formattedConstant && formattedConstant !== level
                                ? `(${formattedConstant})`
                                : "";

                        return `${difficultyAbbr[diff]} ${level}${constantDisplay}`;
                    })
                    .filter(Boolean) as string[];

                return parts.length ? parts.join(" / ") : null;
            };

            // Region availability (pure)
            const hasRegion = (region: "cn" | "intl" | "jp"): boolean =>
                primarySong.sheets.some((sheet: Sheet) => sheet.regions?.[region] === true);

            // ---------- Header block ----------

            const dxSheets = primarySong.sheets.filter((s) => s.type === "dx");
            const dxVersionInfo =
                dxSheets.length > 0 &&
                    dxSheets[0]?.version &&
                    dxSheets[0].version !== primarySong.version
                    ? `Versi (DX): ${dxSheets[0].version}`
                    : "";
            const bpmInfo = primarySong.bpm ? `BPM: ${primarySong.bpm}` : "";

            const header = dedent`
        Hasil pencarian lagu _${query}_ berhasil!
        Judul: ${primarySong.title}
        Artis: ${primarySong.artist}
        Versi: ${primarySong.version}
        ${dxVersionInfo}
        ${bpmInfo}
        Tersedia di: ${'🇨🇳'}: ${hasRegion("cn") ? "✅" : "❌"} / ${'🌏'}: ${hasRegion("intl") ? "✅" : "❌"} / ${'🇯🇵'}: ${hasRegion("jp") ? "✅" : "❌"}
        `.trim();

            // ---------- Levels blocks ----------

            const availableTypes = Array.from(
                new Set(primarySong.sheets.map((s: Sheet) => s.type))
            );

            const dxLevels = availableTypes.includes("dx")
                ? formatDifficulties(primarySong.sheets, "dx")
                : null;

            const stLevels =
                availableTypes.includes("std") || availableTypes.includes("standard")
                    ? formatDifficulties(primarySong.sheets, "std") ??
                    formatDifficulties(primarySong.sheets, "standard")
                    : null;

            const dxSection = dxLevels
                ? `Level (DX):\n${dxLevels}`.trim()
                : null;

            const stSection = stLevels
                ? `Level (ST):\n${stLevels}`.trim()
                : null;

            const otherLevelSections =
                !availableTypes.includes("dx") &&
                    !availableTypes.includes("std") &&
                    !availableTypes.includes("standard")
                    ? availableTypes
                        .filter((t) => t !== "utage")
                        .map((t) => {
                            const diffs = formatDifficulties(primarySong.sheets, t);
                            return diffs ? `Level (${t.toUpperCase()}):\n${diffs}`.trim() : null;
                        })
                        .filter(Boolean)
                        .join("\n") // sections of other types are one block; join with single \n
                    : null;

            // ---------- Utage block ----------

            const utageLines =
                utages.length > 0
                    ? utages
                        .map((u, idx) => {
                            const s = u.sheets?.[0];
                            if (!s) return null;
                            const prefix = utages.length > 1 ? `${idx + 1}. ${s.difficulty}` : s.difficulty;
                            const commentPart = u.comment ? ` Komentar: ${u.comment}` : "";
                            return `${prefix} (ID ${u.internalProcessId}) ${s.level}${commentPart}`;
                        })
                        .filter(Boolean)
                        .join("\n")
                    : "";

            const utageSection =
                utages.length > 0
                    ? [
                        `Level [${'宴'}]:`,
                        utageLines,
                        `${'⚠️'} PERINGATAN PENTING U${'･'}TA${'･'}GE:`,
                        "- Minimal rating 10000 untuk bermain",
                        "- Mode ini TIDAK menaikkan rating sama sekali",
                        "- Jika main 2P, pastikan partner setuju main mode ini agar tidak terjadi masalah",
                        "- Bila 2P tidak setuju, tidak boleh memaksakan main mode ini",
                    ]
                        .map(l => l.trim())
                        .filter(l => l.length > 0)
                        .join("\n")
                    : null;

            // ---------- Other results block ----------

            const otherResultsSection =
                searchResults.length > 1
                    ? [
                        "Saya juga menemukan beberapa lagu lain yang mungkin terkait dengan pencarian Anda:",
                        ...searchResults
                            .slice(1, 5)
                            .map(
                                (r: SearchResult) =>
                                    `- ${r.primary.title} (${r.primary.artist}) (ID ${r.primary.internalProcessId})`
                            ),
                        "Jika ini adalah lagu yang Anda cari, Anda dapat menggunakan perintah lagi dengan judul lagu untuk mendapatkan informasi lebih lanjut tentang lagu tersebut",
                    ]
                        .map(l => l.trimRight?.() ?? l.trim())
                        .join("\n")
                    : null;

            // ---------- Final message ----------
            // If you want extra blank lines, insert "" in this array where desired.
            const replyText = joinBlocks([
                header,
                dxSection,
                stSection,
                otherLevelSections,
                utageSection,
                otherResultsSection,
            ]);

            yield* dependencies.executor.reply(replyText.trim());
        }),
}));
