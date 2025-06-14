import { Effect, Console, Layer, Context } from "effect";

/**
 * =================================================================
 * SCRIPT ENTRY POINT & RERUN GUARD
 * =================================================================
 */
if (document.getElementById("maimai-rating-overlay")) {
  console.warn(
    "Maimai Rating Extractor is already running. Please close the existing dialog or wait for it to finish."
  );
  throw new Error("Script already running");
}

// =================================================================
// 1. DATA MODELS & CUSTOM ERRORS
// =================================================================

interface MusicRecord {
  readonly name: string;
  readonly difficulty: "basic" | "advanced" | "expert" | "master" | "remaster";
  readonly level: string;
  readonly achievement: string;
  readonly dx: boolean;
}

const difficultyImageMap: Record<string, MusicRecord["difficulty"]> = {
  "diff_basic.png": "basic",
  "diff_advanced.png": "advanced",
  "diff_expert.png": "expert",
  "diff_master.png": "master",
  "diff_remaster.png": "remaster",
};

class NetworkError {
  readonly _tag = "NetworkError";
  constructor(readonly error: unknown) { }
}
class ParsingError {
  readonly _tag = "ParsingError";
  constructor(readonly message: string) { }
}

// =================================================================
// 2. UI CREATION & SERVICE DEFINITION
// =================================================================

/**
 * This class defines the "contract" for our UI Service.
 * It lists all the UI operations our program can perform,
 * keeping the main logic clean from DOM manipulation code.
 */
class UiService extends Context.Tag("UiService")<
  UiService,
  {
    readonly createOverlay: Effect.Effect<void>;
    readonly updateProgress: (
      text: string,
      percentage: number
    ) => Effect.Effect<void>;
    readonly showResult: (
      result: { count: number; sendSuccess: boolean } | { error: NetworkError | ParsingError }
    ) => Effect.Effect<void>;
    readonly listenForClose: Effect.Effect<void, never, never>;
  }
>() { }

/**
 * This is the "live" implementation of our UiService.
 * It contains all the actual browser DOM code.
 */
const UiServiceLive = Layer.succeed(
  UiService,
  UiService.of({
    createOverlay: Effect.sync(() => {
      const overlay = document.createElement("div");
      overlay.id = "maimai-rating-overlay";
      overlay.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(0, 0, 0, 0.6); z-index: 2147483647;
          display: flex; align-items: center; justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          backdrop-filter: blur(8px);
          opacity: 0; animation: fadeIn 0.3s ease-out forwards;
        `;

      const modal = document.createElement("div");
      modal.style.cssText = `
          background: #ffffff; border-radius: 16px; padding: 24px;
          max-width: 480px; width: 90%;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          text-align: center; transform: scale(0.95);
          opacity: 0; animation: fadeInScaleUp 0.3s 0.1s ease-out forwards;
        `;

      modal.innerHTML = `
          <style>
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes fadeInScaleUp { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            .mm-close-btn {
              background: #e5e7eb; color: #4b5563; border: none; padding: 10px 20px;
              border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;
              transition: background-color 0.2s, color 0.2s;
            }
            .mm-close-btn:hover { background: #d1d5db; color: #1f2937; }
          </style>
          <div id="modal-content">
            <h2 style="margin: 0 0 12px; color: #111827; font-size: 22px; font-weight: 700;">Maimai WA Score Sync</h2>
            <div style="background: #fffbeb; border-radius: 8px; padding: 12px; margin-bottom: 20px; color: #92400e; font-weight: 500; font-size: 14px; border: 1px solid #fef3c7;">
              ⚠️ Mohon jangan tutup atau refresh halaman ini.
            </div>
            <div id="progress-container">
              <div id="progress-text" style="color: #4b5563; font-size: 16px; margin-bottom: 8px;">Memulai...</div>
              <div style="width: 100%; height: 10px; background: #f3f4f6; border-radius: 5px; overflow: hidden;">
                <div id="progress-fill" style="height: 100%; background: linear-gradient(90deg, #60a5fa, #3b82f6); width: 0%; transition: width 0.4s ease;"></div>
              </div>
            </div>
          </div>
          <div id="result-container" style="display: none; margin-top: 16px;">
            <div id="status-message" style="border-radius: 8px; padding: 16px; margin-bottom: 20px; font-weight: 500; line-height: 1.5;"></div>
            <button id="close-button" class="mm-close-btn">Tutup</button>
          </div>
        `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    }),

    updateProgress: (text, percentage) => Effect.sync(() => {
      const progressText = document.getElementById("progress-text");
      const progressFill = document.getElementById("progress-fill");
      if (progressText) progressText.textContent = text;
      if (progressFill) (progressFill as HTMLElement).style.width = `${percentage}%`;
    }),

    showResult: (result) => Effect.sync(() => {
      const progressContainer = document.getElementById("progress-container");
      const resultContainer = document.getElementById("result-container");
      const statusMessage = document.getElementById("status-message");

      if (progressContainer) progressContainer.style.display = "none";
      if (resultContainer) resultContainer.style.display = "block";
      if (!statusMessage) return;

      if ('error' in result) {
        statusMessage.style.background = '#fee2e2';
        statusMessage.style.color = '#b91c1c';
        const message = result.error._tag === 'NetworkError' ? 'Gagal mengambil data dari server.' : result.error.message;
        statusMessage.innerHTML = `<strong>Terjadi Kesalahan</strong><br>${message}`;
      } else {
        if (result.sendSuccess) {
          statusMessage.style.background = '#dcfce7';
          statusMessage.style.color = '#166534';
          statusMessage.innerHTML = `<strong>Selesai!</strong><br>${result.count} lagu berhasil diekstrak dan dikirim ke server.`;
        } else {
          statusMessage.style.background = '#fffbeb';
          statusMessage.style.color = '#92400e';
          statusMessage.innerHTML = `<strong>Data Diekstrak</strong><br>${result.count} lagu berhasil diekstrak, namun gagal mengirim ke server.`;
        }
      }
    }),

    listenForClose: Effect.async<void>((resume) => {
      const overlay = document.getElementById("maimai-rating-overlay");
      const closeHandler = () => {
        if (overlay) overlay.remove();
        resume(Effect.succeed(undefined));
      };
      const closeButton = document.getElementById("close-button");
      if (closeButton) {
        closeButton.addEventListener("click", closeHandler, { once: true });
      }
    })
  })
);

// =================================================================
// 3. DATA HANDLING EFFECTS
// =================================================================

const getDocument = (url: string) =>
  window.location.href === url
    ? Effect.succeed(document)
    : Effect.tryPromise({
      try: () => fetch(url).then((res) => res.text()),
      catch: (error) => new NetworkError(error),
    }).pipe(
      Effect.map((html) => new DOMParser().parseFromString(html, "text/html"))
    );

const parseMusicRecords = (document: Document) =>
  Effect.try({
    try: () => {
      const records: MusicRecord[] = [];
      const container = document.querySelector(".main_wrapper");
      if (!container) throw new Error("Struktur halaman tidak valid: .main_wrapper tidak ditemukan.");

      for (const element of Array.from(container.children)) {
        if (element.classList.contains("screw_block") && element.textContent?.includes("Songs for Rating Selection")) {
          break;
        }
        if (element.matches("div[class*='_score_back']")) {
          const diffImg = element.querySelector<HTMLImageElement>("img[src*='diff_']");
          const nameElement = element.querySelector(".music_name_block");
          const levelElement = element.querySelector(".music_lv_block");
          const achievementElement = element.querySelector(".music_score_block");
          const kindIcon = element.querySelector<HTMLImageElement>(".music_kind_icon");

          if (!nameElement || !levelElement || !achievementElement || !diffImg || !kindIcon) continue;

          let difficulty: MusicRecord["difficulty"] = "basic";
          const srcFilename = diffImg.src.split("/").pop() ?? "";
          if (srcFilename in difficultyImageMap) {
            difficulty = difficultyImageMap[srcFilename];
          }

          records.push({
            name: nameElement.textContent?.trim() ?? "Unknown",
            difficulty,
            level: levelElement.textContent?.trim() ?? "Unknown",
            achievement: achievementElement.textContent?.trim().replace("%", "") ?? "N/A",
            dx: kindIcon.src.includes("music_dx.png"),
          });
        }
      }
      if (records.length === 0) throw new Error("Tidak ada lagu rating yang ditemukan. Pastikan Anda berada di halaman yang benar.");
      return records;
    },
    catch: (e) => new ParsingError(e instanceof Error ? e.message : "Kesalahan saat memproses halaman."),
  });

const postData = (data: ReadonlyArray<MusicRecord>) =>
  Effect.tryPromise({
    try: async () => {

      return true;
      // TODO: Ganti dengan URL endpoint Anda yang sebenarnya
      // const response = await fetch("https://example.com/api/ingest-maimai-data", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     timestamp: new Date().toISOString(),
      //     source: "maimai-rating-bookmarklet",
      //     data,
      //   }),
      // });
      // return response.ok;
    },
    catch: (error) => new NetworkError(error),
  });

// =================================================================
// 4. MAIN PROGRAM LOGIC
// =================================================================

const program = Effect.gen(function* (_) {
  const ui = yield* _(UiService);
  const url = "https://maimaidx-eng.com/maimai-mobile/home/ratingTargetMusic/";

  yield* _(ui.createOverlay);
  yield* _(ui.updateProgress("Mengambil data rating...", 25));

  const document = yield* _(getDocument(url));

  yield* _(ui.updateProgress("Memproses data lagu...", 60));
  const records = yield* _(parseMusicRecords(document));

  yield* _(ui.updateProgress("Mengirim data ke server...", 90));
  const sendSuccess = yield* _(postData(records));

  yield* _(ui.updateProgress("Selesai!", 100));
  yield* _(Effect.sleep("500 millis"));

  yield* _(ui.showResult({ count: records.length, sendSuccess }));

  yield* _(Console.log(`✅ Top ${records.length} rating songs parsed. Send status: ${sendSuccess}`));
  yield* _(Console.log(JSON.stringify(records, null, 2)));

  yield* _(ui.listenForClose); // Wait for user to close the dialog
}).pipe(
  Effect.catchAll((error) =>
    Effect.gen(function* (_) {
      const ui = yield* _(UiService);
      yield* _(ui.showResult({ error }));
      yield* _(Console.error("Script failed:", error));
      yield* _(ui.listenForClose);
    })
  )
);

const runnable = Effect.provide(program, UiServiceLive);
Effect.runFork(runnable);