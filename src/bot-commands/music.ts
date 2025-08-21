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

      const compactJoin = (blocks: Array<string | null | undefined>) =>
        blocks
          .map((b) => (b ?? "").trim())
          .filter(Boolean)
          .join("\n");

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
          .filter(Boolean);

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
        Tersedia di: ${'🇨🇳'}: ${hasRegion("cn") ? "✅" : "❌"} / ${'🌏'}: ${
          hasRegion("intl") ? "✅" : "❌"
        } / ${'🇯🇵'}: ${hasRegion("jp") ? "✅" : "❌"}
      `
        .split("\n")
        .filter((line) => line.trim() !== "")
        .join("\n");

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
        ? dedent`
            Level (DX):
            ${dxLevels}
          `
        : null;

      const stSection = stLevels
        ? dedent`
            Level (ST):
            ${stLevels}
          `
        : null;

      const otherLevelSections =
        !availableTypes.includes("dx") &&
        !availableTypes.includes("std") &&
        !availableTypes.includes("standard")
          ? availableTypes
              .filter((t) => t !== "utage")
              .map((t) => {
                const diffs = formatDifficulties(primarySong.sheets, t);
                if (!diffs) return null;
                return dedent`
                  Level (${t.toUpperCase()}):
                  ${diffs}
                `;
              })
              .filter(Boolean)
              .join("\n")
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
          ? dedent`
              Level [${'宴'}]:
              ${utageLines}

              ${'⚠️'} *PERINGATAN PENTING U${'･'}TA${'･'}GE:*
              - *Minimal rating 10000 untuk bermain*
              - *Mode ini TIDAK menaikkan rating sama sekali*
              - *Jika main 2P, pastikan partner setuju main mode ini agar tidak terjadi masalah*
              - *Bila 2P tidak setuju, tidak boleh memaksakan main mode ini*
            `
              .split("\n")
              .filter((line) => line.trim() !== "")
              .join("\n")
          : null;

      // ---------- Other results block ----------

      const otherResultsSection =
        searchResults.length > 1
          ? dedent`
              Saya juga menemukan beberapa lagu lain yang mungkin terkait dengan pencarian Anda:
              ${searchResults
                .slice(1, 5)
                .map(
                  (r: SearchResult) =>
                    `- ${r.primary.title} (${r.primary.artist}) (ID ${r.primary.internalProcessId})`
                )
                .join("\n")}
              Jika ini adalah lagu yang Anda cari, Anda dapat menggunakan perintah lagi dengan judul lagu untuk mendapatkan informasi lebih lanjut tentang lagu tersebut
            `
              .split("\n")
              .map((line) => line.trimEnd())
              .join("\n")
          : null;

      // ---------- Final message ----------

      const replyText = compactJoin([
        header,
        dxSection,
        stSection,
        otherLevelSections,
        utageSection,
        otherResultsSection,
      ]);

      yield* dependencies.executor.reply(replyText);
    }),
}));
