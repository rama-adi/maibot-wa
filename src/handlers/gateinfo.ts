import type { Command } from "@/types/command";

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
    { life: 999, requiredDifficulty: "Basic", daysFromRelease: 21 }
];

function getCurrentCondition(startDate: Date): GateCondition {
    const now = new Date();
    const japanOffset = 9 * 60; // Japan is UTC+9
    const nowInJapan = new Date(now.getTime() + (japanOffset * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
    const daysSinceRelease = Math.floor((nowInJapan.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Find the appropriate condition based on days since release
    for (let i = CONDITION_PROGRESSION.length - 1; i >= 0; i--) {
        if (daysSinceRelease >= CONDITION_PROGRESSION[i].daysFromRelease) {
            return CONDITION_PROGRESSION[i];
        }
    }

    // If gate hasn't been released yet, return the first condition
    return CONDITION_PROGRESSION[0];
}

function formatDate(date: Date): string {
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

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
        keyUnlock: "Mainkan semua 29 lagu dari Youth Area (青春エリア) hingga スカイストリートちほー6 setidaknya sekali sejak course dirilis: STEREOSCAPE, Crazy Circle, シエルブルーマルシェ, ブレインジャックシンドローム, 共鳴, Ututu, REAL VOICE, ユメヒバナ, オリフィス, パラボラ, 星めぐり、果ての君へ。, スローアライズ, 生命不詳, チエルカ／エソテリカ, RIFFRAIN, Falling, ピリオドサイン, 群青シグナル, アンバークロニクル, リフヴェイン, 宵の鳥, Kairos, フェイクフェイス・フェイルセイフ, シックスプラン, フタタビ, ふらふらふら、, パラドクスイヴ, YKWTD, 184億回のマルチトニック",
        courseTrack1: "Lagu acak dari area di 青春エリア",
        courseTrack2: "Lagu Perfect Challenge acak dari area di 青春エリア",
        courseTrack3: "果ての空、僕らが見た光。"
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
        keyUnlock: "Atur player frame Latent Kingdom (dapat dibeli di maimile shop di maimai でらっくす PRiSM jika belum terbuka melalui Stamp Cards di maimai でらっくす BUDDiES PLUS), kemudian dalam satu credit, hanya mainkan lagu-lagu berikut (lagu tidak boleh diulang dalam credit tersebut): 封焔の135秒, ほしぞらスペクタクル, U&iVERSE -銀河鸞翔-, ツムギボシ, ここからはじまるプロローグ。 (Kanon Remix), Latent Kingdom.",
        courseTrack1: "Lagu acak dari area di 神様エリア",
        courseTrack2: "Lagu Perfect Challenge acak dari area di 神様エリア, TEmPTaTiON, dan 封焔の135秒",
        courseTrack3: "氷滅の135小節"
    },
    {
        id: "violet",
        name: "Violet Gate",
        nameJp: "紫の扉",
        color: "🟣",
        startDate: new Date("2025-04-11"), // TBA - set to future date
        unlockedIn: "TBA",
        song: "有明/Ariake",
        artist: "SIINCA",
        correspondingArea: "Black Rose (黒薔薇エリア)",
        keyUnlock: "Atur varian apapun dari アウル (Owl) sebagai tour leader (dapat dibeli di maimile shop jika belum terbuka), kemudian dalam satu credit, hanya mainkan lagu dari salah satu season Kotonoha Project (lagu tidak boleh diulang dalam credit tersebut).",
        courseTrack1: "Lagu acak dari Kotonoha Project Season 1",
        courseTrack2: "Lagu acak dari Kotonoha Project Season 2 (BLACK ROSE)",
        courseTrack3: "有明/Ariake"
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
        correspondingArea: "End (終末エリア)",
        keyUnlock: "Mainkan semua lagu turnamen KING of Performai masa lalu (tidak termasuk lagu divisi internasional) setidaknya sekali sejak course dirilis: Blows Up Everything, ≠彡\"/了→, U&iVERSE -銀河鸞翔-, Rising on the horizon, KHYMΞXΛ, Divide et impera!, Valsqotch, BREaK! BREaK! BREaK!, GIGANTØMAKHIA, ViRTUS, 系ぎて",
        courseTrack1: "Lagu acak dari area di 終末エリア",
        courseTrack2: "Lagu Perfect Challenge acak dari area di 終末エリア, Blows Up Everything, dan STEEL TRANSONIC",
        courseTrack3: "宙天"
    },
    {
        id: "yellow",
        name: "Yellow Gate",
        nameJp: "黄の扉",
        color: "🟡",
        startDate: new Date("2099-12-31"), // TBA - set to future date
        unlockedIn: "なないろちほー",
        song: "Åntinomiε",
        artist: "ああ…翡翠茶漬け…",
        correspondingArea: "Beginning (はじまりエリア)",
        keyUnlock: "Mainkan salah satu lagu tema versi berikut ketika dipilih oleh fitur pemilihan lagu acak: でらっくmaimai♪てんてこまい!, 絡めトリック利己ライザー, ぼくたちいつでも しゅわっしゅわ！, Paradisoda, とびだせ！TO THE COSMIC!!, ミルキースター・シューティングスター, ホシシズク, ツムギボシ, NOIZY BOUNCE, エスオーエス, プリズム△▽リズム, Fraq",
        courseTrack1: "Lagu acak dari area di はじまりエリア",
        courseTrack2: "Lagu Perfect Challenge acak dari area di はじまりエリア, MAXRAGE, dan UniTas",
        courseTrack3: "Åntinomiε"
    },
    {
        id: "red",
        name: "Red Gate",
        nameJp: "赤の扉",
        color: "🔴",
        startDate: new Date("2099-12-31"), // TBA - set to future date
        unlockedIn: "ドラゴンちほー4",
        song: "FLΛME/FRΦST",
        artist: "FANTAGIRAFF",
        correspondingArea: "World Tree (世界樹エリア)",
        keyUnlock: "Mainkan 10 lagu berikut setidaknya sekali sejak course dirilis: ドラゴンエネルギー, Garden Of The Dragon, DRAGONLADY, 好きな惣菜発表ドラゴン, KONNANじゃないっ！, Brand-new Japanesque, Outlaw's Lullaby, 鼓動, 神室雪月花, ばかみたい【Taxi Driver Edition】",
        courseTrack1: "Lagu acak dari area di 世界樹エリア",
        courseTrack2: "Lagu Perfect Challenge acak dari area di 世界樹エリア, dan 一か罰",
        courseTrack3: "FLΛME/FRΦST"
    }
];

const gateinfo: Command = {
    name: "gateinfo",
    description: "Dapatkan informasi tentang gate KALEID×SCOPE",
    commandAvailableOn: "both",
    execute: async (ctx) => {
        const now = new Date();
        const gateId = ctx.rawParams.trim().toLowerCase();

        // If no gate ID provided, show all gates
        if (!gateId) {
            let response = "🌟 *Informasi Gate KALEID×SCOPE (Server Asia)* 🌟\n\n";
            response += "Gate yang tersedia:\n";
            GATES.forEach(gate => {
                const isReleased = gate.startDate.getFullYear() !== 2099;
                const status = isReleased ? "✅ Sudah dirilis" : "🔜 Segera hadir";
                response += `• *${gate.id}* - ${gate.name} (${gate.nameJp}) - ${status}\n`;
            });
            response += "\nGunakan `gateinfo <gate_id>` untuk informasi detail tentang gate tertentu.";
            await ctx.reply(response);
            return;
        }

        const gate = GATES.find(g => g.id.toLowerCase() === gateId);
        if (!gate) {
            await ctx.reply(`Gate "${gateId}" tidak ditemukan. Gunakan "gateinfo" untuk melihat daftar gate yang tersedia.`);
            return;
        }

        // Check if gate has been released and get current condition
        const isReleased = gate.startDate.getFullYear() !== 2099;

        let response = `🌟 *Detail ${gate.name} (${gate.nameJp})* 🌟\n\n`;

        response += `${gate.color} *${gate.name} (${gate.nameJp})*\n`;
        response += `📅 Tanggal Mulai Asia: ${isReleased ? formatDate(gate.startDate) : "-"}\n`;
        response += `📍 Terbuka di: ${gate.unlockedIn}\n`;
        response += `🎵 Lagu: ${gate.song}\n`;
        response += `🎤 Artist: ${gate.artist}\n`;
        response += `🗺️ Area: ${gate.correspondingArea}\n\n`;

        if (isReleased) {
            const currentCondition = getCurrentCondition(gate.startDate);
            const daysSinceRelease = Math.floor((now.getTime() - gate.startDate.getTime()) / (1000 * 60 * 60 * 24));

            response += "*Kondisi Saat Ini:*\n";
            response += `• *${currentCondition.life} Life* | Setidaknya main difficulty *${currentCondition.requiredDifficulty}*\n`;
            response += `• Dirilis ${daysSinceRelease} hari yang lalu\n\n`;

            // Show next condition if not at maximum
            const nextConditionIndex = CONDITION_PROGRESSION.findIndex(c => c.daysFromRelease > daysSinceRelease);
            if (nextConditionIndex !== -1) {
                const nextCondition = CONDITION_PROGRESSION[nextConditionIndex];
                const daysUntilNext = nextCondition.daysFromRelease - daysSinceRelease;
                response += `*Kondisi Selanjutnya:* ${nextCondition.life} Life (${nextCondition.requiredDifficulty}) dalam ${daysUntilNext} hari\n\n`;
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

        await ctx.reply(response);
    }
}

export default gateinfo;