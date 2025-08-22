import { defineCommand, type BotCommand } from "@/contracts/bot-command";
import { CommandExecutor } from "@/contracts/command-executor";
import { Effect } from "effect";

interface GateCondition {
  life: number;
  requiredDifficulty: string;
  daysFromRelease: number;
}

interface Gate {
  id: string;
  name: string;
  nameJp: string;
  color: string;
  startDate: Date;
  unlockedIn: string;
  song: string;
  artist: string;
  correspondingArea: string;
  keyUnlock: string;
  courseTrack1: string;
  courseTrack2: string;
  courseTrack3: string;
}

// Condition progression based on days since release (Asia server)
const CONDITION_PROGRESSION: GateCondition[] = [
  { life: 1, requiredDifficulty: "Master", daysFromRelease: 1 },
  { life: 10, requiredDifficulty: "Master", daysFromRelease: 4 },
  { life: 30, requiredDifficulty: "Master", daysFromRelease: 7 },
  { life: 50, requiredDifficulty: "Master", daysFromRelease: 10 },
  { life: 100, requiredDifficulty: "Expert", daysFromRelease: 14 },
  { life: 999, requiredDifficulty: "Basic", daysFromRelease: 21 },
];

const GATES: Gate[] = [
  {
    id: "blue",
    name: "Blue Gate",
    nameJp: "青の扉",
    color: "🔵",
    startDate: new Date("2025-01-16"),
    unlockedIn: "スカイストリートちほー6",
    song: "果ての空、僕らが見た光。",
    artist: "TAKU1175 ft.駄々子",
    correspondingArea: "Youth (青春エリア)",
    keyUnlock:
      "Mainkan semua 29 lagu dari Youth Area (青春エリア) hingga スカイストリートちほー6 setidaknya sekali sejak course dirilis: STEREOSCAPE, Crazy Circle, シエルブルーマルシェ, ブレインジャックシンドローム, 共鳴, Ututu, REAL VOICE, ユメヒバナ, オリフィス, パラボラ, 星めぐり、果ての君へ。, スローアライズ, 生命不詳, チエルカ／エソテリカ, RIFFRAIN, Falling, ピリオドサイン, 群青シグナル, アンバークロニクル, リフヴェイン, 宵の鳥, Kairos, フェイクフェイス・フェイルセイフ, シックスプラン, フタタビ, ふらふらふら、, パラドクスイヴ, YKWTD, 184億回のマルチトニック",
    courseTrack1: "Lagu acak dari area di 青春エリア",
    courseTrack2: "Lagu Perfect Challenge acak dari area di 青春エリア",
    courseTrack3: "果ての空、僕らが見た光。",
  },
  {
    id: "white",
    name: "White Gate",
    nameJp: "白の扉",
    color: "⚪",
    startDate: new Date("2025-05-23"),
    unlockedIn: "天界ちほー8",
    song: "氷滅の135小節",
    artist: "大国奏音",
    correspondingArea: "God (神様エリア)",
    keyUnlock:
      "Atur player frame Latent Kingdom (dapat dibeli di maimile shop di maimai でらっくす PRiSM jika belum terbuka melalui Stamp Cards di maimai でらっくす BUDDiES PLUS), kemudian dalam satu credit, hanya mainkan lagu-lagu berikut (lagu tidak boleh diulang dalam credit tersebut): 封焔の135秒, ほしぞらスペクタクル, U&iVERSE -銀河鸞翔-, ツムギボシ, ここからはじまるプロローグ。 (Kanon Remix), Latent Kingdom.",
    courseTrack1: "Lagu acak dari area di 神様エリア",
    courseTrack2:
      "Lagu Perfect Challenge acak dari area di 神様エリア, TEmPTaTiON, dan 封焔の135秒",
    courseTrack3: "氷滅の135小節",
  },
  {
    id: "violet",
    name: "Violet Gate",
    nameJp: "紫の扉",
    color: "🟣",
    startDate: new Date("2025-04-11"),
    unlockedIn: "BLACK ROSEちほー10",
    song: "有明/Ariake",
    artist: "SIINCA",
    correspondingArea: "Black Rose (黒薔薇エリア)",
    keyUnlock:
      "Atur varian apapun dari アウル (Owl) sebagai tour leader (dapat dibeli di maimile shop jika belum terbuka), kemudian dalam satu credit, hanya mainkan lagu dari salah satu season Kotonoha Project (lagu tidak boleh diulang dalam credit tersebut).",
    courseTrack1: "Lagu acak dari Kotonoha Project Season 1",
    courseTrack2: "Lagu acak dari Kotonoha Project Season 2 (BLACK ROSE)",
    courseTrack3: "有明/Ariake",
  },
  {
    id: "black",
    name: "Black Gate",
    nameJp: "黒の扉",
    color: "⚫",
    startDate: new Date("2025-02-27"),
    unlockedIn: "メトロポリスちほー9",
    song: "宙天",
    artist: "t+pazolite vs. かねこちはる",
    correspondingArea: "World's End (終末エリア)",
    keyUnlock:
      "Mainkan semua lagu final set turnamen KING of Performai masa lalu (divisi internasional tidak termasuk) setidaknya sekali sejak course dirilis: Blows Up Everything, ≠彡\"/了→, U&iVERSE -銀河鸞翔-, Rising on the horizon, KHYMΞXΛ, Divide et impera!, Valsqotch, BREaK! BREaK! BREaK!, GIGANTØMAKHIA, ViRTUS, 系ぎて",
    courseTrack1: "Lagu acak dari area di 終末エリア",
    courseTrack2:
      "Lagu Perfect Challenge acak dari area di 終末エリア, Blows Up Everything, dan STEEL TRANSONIC",
    courseTrack3: "宙天",
  },
  {
    id: "yellow",
    name: "Yellow Gate",
    nameJp: "黄の扉",
    color: "🟡",
    startDate: new Date("2025-07-24"),
    unlockedIn: "なないろちほー",
    song: "Åntinomiε",
    artist: "ああ…翡翠茶漬け…",
    correspondingArea: "Beginning (はじまりエリア)",
    keyUnlock:
      "Mainkan salah satu lagu tema versi berikut ketika dipilih oleh fitur pemilihan lagu acak: でらっくmaimai♪てんてこまい!, 絡めトリック利己ライザー, ぼくたちいつでも しゅわっしゅわ！, Paradisoda, とびだせ！TO THE COSMIC!!, ミルキースター・シューティングスター, ホシシズク, ツムギボシ, NOIZY BOUNCE, エスオーエス, プリズム△▽リズム, Fraq \n\n*TIPS: Favorit lagu ini dan gunakan fitur acak di favorit supaya gachanya gak bau*",
    courseTrack1: "Lagu acak dari area di はじまりエリア",
    courseTrack2:
      "Lagu Perfect Challenge acak dari area di はじまりエリア, MAXRAGE, dan UniTas",
    courseTrack3: "Åntinomiε",
  },
  {
    id: "red",
    name: "Red Gate",
    nameJp: "赤の扉",
    color: "🔴",
    startDate: new Date("2099-12-31"), // Belum rilis Asia; data berdasarkan JP dan bisa berubah
    unlockedIn: "ドラゴンちほー4",
    song: "FLΛME/FRΦST",
    artist: "FANTAGIRAFF",
    correspondingArea: "World Tree (世界樹エリア)",
    keyUnlock:
      "Mainkan 10 lagu berikut setidaknya sekali sejak course dirilis: ドラゴンエネルギー, Garden Of The Dragon, DRAGONLADY, 好きな惣菜発表ドラゴン, KONNANじゃないっ！, Brand-new Japanesque, Outlaw's Lullaby, 鼓動, 神室雪月花, ばかみたい【Taxi Driver Edition】 (Info JP; bisa berubah saat rilis Asia)",
    courseTrack1: "Lagu acak dari area di 世界樹エリア",
    courseTrack2: "Lagu Perfect Challenge acak dari area di 世界樹エリア, dan 一か罰",
    courseTrack3: "FLΛME/FRΦST",
  },
  {
    id: "prism",
    name: "Prism Tower",
    nameJp: "プリズムタワー",
    color: "🔷",
    startDate: new Date("2099-12-31"), // JP: 2025-07-11 — belum rilis Asia
    unlockedIn: "7sRefちほー4",
    song: "World's end BLACKBOX",
    artist: "打打だいず",
    correspondingArea: "Prism (プリズムエリア)",
    keyUnlock:
      "Selesaikan semua 6 fase di Stage 1 (Info JP; bisa berubah saat rilis Asia).",
    courseTrack1: "Lagu acak dari area di プリズムエリア (kecuali ヨミビトシラズ)",
    courseTrack2: "Lagu Perfect Challenge acak dari area di プリズムエリア",
    courseTrack3: "World's end BLACKBOX",
  },
  {
    id: "error",
    name: "ERROR",
    nameJp: "エラー",
    color: "🟥",
    startDate: new Date("2099-12-31"), // JP: 2025-08-08 — belum rilis Asia
    unlockedIn: "ERRORちほー",
    song: "ERROR CODE:UNKNOWN",
    artist: "xi vs. 削除",
    correspondingArea: "???",
    keyUnlock:
      "Hanya tersedia setelah menyelesaikan Prism Tower. Info JP: Dalam satu credit, mainkan semua lagu boss dari gate sebelumnya (Blue, White, Violet, Black, Yellow, Red, Prism Tower) secara berurutan. (Syarat Asia bisa berubah)",
    courseTrack1: "Lagu acak boss dari Stage 1",
    courseTrack2: "World's end BLACKBOX",
    courseTrack3: "ERROR CODE:UNKNOWN",
  },
  {
    id: "finale",
    name: "Finale Gate",
    nameJp: "終焉の扉",
    color: "🌈",
    startDate: new Date("2099-12-31"), // JP: 2025-09-?? — belum rilis Asia
    unlockedIn: "???",
    song: "KALEID×SCOPE",
    artist: "Cytus × maimai ALLSTARS",
    correspondingArea: "Final (最終エリア)",
    keyUnlock:
      "Hanya tersedia setelah ERROR Gate selesai. Info JP: Semua course KALEID×SCOPE Stage 1 & Stage 2 harus Clear (Syarat Asia bisa berubah).",
    courseTrack1: "Medley lagu boss Stage 1",
    courseTrack2: "World's end BLACKBOX",
    courseTrack3: "KALEID×SCOPE",
  },
]

// ——— Helpers ———
const toJapanNow = () => {
  const now = new Date();
  const japanOffsetMinutes = 9 * 60;
  return new Date(
    now.getTime() + japanOffsetMinutes * 60 * 1000 - now.getTimezoneOffset() * 60 * 1000
  );
};

const daysSince = (start: Date) =>
  Math.floor((toJapanNow().getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

const getCurrentCondition = (startDate: Date): GateCondition => {
  const d = daysSince(startDate);
  // choose the last condition whose daysFromRelease <= d
  const sorted = [...CONDITION_PROGRESSION].sort(
    (a, b) => a.daysFromRelease - b.daysFromRelease
  );
  let chosen = sorted[0]!; // Non-null assertion since CONDITION_PROGRESSION is not empty
  for (const c of sorted) {
    if (d >= c.daysFromRelease) chosen = c;
    else break;
  }
  return chosen;
};

const getNextCondition = (startDate: Date): GateCondition | undefined => {
  const d = daysSince(startDate);
  return [...CONDITION_PROGRESSION]
    .sort((a, b) => a.daysFromRelease - b.daysFromRelease)
    .find(c => c.daysFromRelease > d);
};

const formatDateID = (date: Date) =>
  date.toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });

const findGateById = (gateId: string): Gate | undefined =>
  GATES.find(g => g.id.toLowerCase() === gateId.toLowerCase());

const buildAllGatesResponse = (): string => {
  let response = "🌟 *Informasi Gate KALEID×SCOPE (Server Asia)* 🌟\n\n";
  response += "Gate yang tersedia:\n";

  response += GATES.map(g => {
    const isReleased = g.startDate.getFullYear() !== 2099;
    const status = isReleased ? "✅ Sudah dirilis" : "🔜 Segera hadir";
    return `- *${g.id}* - ${g.name} (${g.nameJp}) - ${status}`;
  }).join("\n");

  response += "\n\nGunakan `gateinfo <gate_id>` untuk informasi detail tentang gate tertentu.";
  return response;
};

const buildGateDetailResponse = (gate: Gate): string => {
  const isReleased = gate.startDate.getFullYear() !== 2099;
  const formattedDate = isReleased ? formatDateID(gate.startDate) : "-";
  const d = daysSince(gate.startDate);

  let response = `🌟 *Detail ${gate.name} (${gate.nameJp})* 🌟\n\n`;

  response += `${gate.color} *${gate.name} (${gate.nameJp})*\n`;
  response += `📅 Tanggal Mulai Asia: ${formattedDate}\n`;
  response += `📍 Terbuka di: ${gate.unlockedIn}\n`;
  response += `🎵 Lagu: ${gate.song}\n`;
  response += `🎤 Artist: ${gate.artist}\n`;
  response += `🗺️ Area: ${gate.correspondingArea}\n\n`;

  if (isReleased) {
    const current = getCurrentCondition(gate.startDate);
    response += "*Kondisi Saat Ini:*\n";
    response += `• *${current.life} Life* | Setidaknya main difficulty *${current.requiredDifficulty}*\n`;
    response += `• Dirilis ${d} hari yang lalu\n\n`;

    const next = getNextCondition(gate.startDate);
    if (next) {
      response += `*Kondisi Selanjutnya:* ${next.life} Life (${next.requiredDifficulty}) dalam ${next.daysFromRelease - d
        } hari\n\n`;
    } else {
      response += `*Status:* Kondisi maksimum tercapai (999 Life, difficulty Basic)\n\n`;
    }
  } else {
    response += `*Status:* 🔜 Belum tersedia untuk server Asia! Syarat mungkin berbeda dengan server Jepang!\n\n`;
  }

  response += "*Syarat Membuka Key:*\n";
  response += `${gate.keyUnlock}\n\n`;

  response += "*Struktur Course:*\n";
  response += `1. ${gate.courseTrack1}\n`;
  response += `2. ${gate.courseTrack2}\n`;
  response += `3. ${gate.courseTrack3}\n`;

  response += "\n💡 *Sedikit info mengenai mode KALEID×SCOPE:*\n";
  response += "- Life berkurang 1 untuk setiap judgment yang bukan Perfect. Tidak ada penambahan life sampai selesai gate\n";
  response += "- Semua 3 track harus dimainkan pada difficulty yang sama\n";
  response += "- Kondisi menjadi lebih mudah berdasarkan hari sejak dirilis\n";

  return response;
};

export default defineCommand(dependencies => ({
  name: "gateinfo",
  adminOnly: false,
  enabled: true,
  description: "Dapatkan informasi tentang gate KALEID×SCOPE",
  commandAvailableOn: "both",
  usageExample: "`gateinfo` / `gateinfo blue`",
  execute: (ctx) =>
    Effect.gen(function* () {
      const gateId = (ctx.rawParams ?? "").trim();

      // No gate ID -> list all gates
      if (!gateId) {
        const response = buildAllGatesResponse();
        yield* dependencies.executor.reply(response);
        return;
      }

      // Specific gate
      const gate = findGateById(gateId);
      if (!gate) {
        yield* dependencies.executor.reply(
          `Gate "${gateId}" tidak ditemukan. Gunakan "gateinfo" untuk melihat daftar gate yang tersedia.`
        );
        return;
      }

      const response = buildGateDetailResponse(gate);
      yield* dependencies.executor.reply(response);
    }),
}));
