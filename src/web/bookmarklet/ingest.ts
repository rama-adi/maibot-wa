import { musicDatabase } from "@/database/drizzle";
import { songs, sheets, difficulties, regionOverrides } from "@/database/schemas/music-schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { Effect, pipe } from "effect";

const DIFFICULTIES = ['basic', 'advanced', 'expert', 'master', 'remaster'] as const;
const CURRENT_VERSION = "PRiSM" as const;

const dataSchema = z.array(z.object({
    name: z.string(),
    difficulty: z.enum(DIFFICULTIES),
    level: z.string(),
    achievement: z.string().transform((val) => val === "N/A" ? 0.0 : parseFloat(val)),
    dx: z.boolean(),
}));

function calculateScore(
    achievement: number,
    chartConstant: number
): number {
    // Cap achievement at 100.5% for rating calculation
    const cappedAchievement = Math.min(achievement, 100.5);

    // Define score multiplier thresholds
    const thresholds = [
        { achievement: 100.5, multiplier: 0.224 },
        { achievement: 100.4999, multiplier: 0.222 },
        { achievement: 100, multiplier: 0.216 },
        { achievement: 99.9999, multiplier: 0.214 },
        { achievement: 99.5, multiplier: 0.211 },
        { achievement: 99, multiplier: 0.208 },
        { achievement: 98.9999, multiplier: 0.206 },
        { achievement: 98, multiplier: 0.203 },
        { achievement: 97, multiplier: 0.2 },
        { achievement: 96.9999, multiplier: 0.176 },
        { achievement: 94, multiplier: 0.168 },
        { achievement: 90, multiplier: 0.152 },
        { achievement: 80, multiplier: 0.136 },
        { achievement: 79.9999, multiplier: 0.128 },
        { achievement: 75, multiplier: 0.120 },
        { achievement: 70, multiplier: 0.112 },
        { achievement: 60, multiplier: 0.096 },
        { achievement: 50, multiplier: 0.08 },
        { achievement: 40, multiplier: 0.064 },
        { achievement: 30, multiplier: 0.048 },
        { achievement: 20, multiplier: 0.032 },
        { achievement: 10, multiplier: 0.016 }
    ];

    // Find the appropriate multiplier based on capped achievement
    let multiplier = 0;
    for (const threshold of thresholds) {
        if (cappedAchievement >= threshold.achievement) {
            multiplier = threshold.multiplier;
            break;
        }
    }

    // Calculate DX Rating using capped achievement
    return Math.floor(chartConstant * cappedAchievement * multiplier);
}

type SongData = {
    id: number;
    songId: string;
    level: string;
    difficultyId: string;
    version: string | null;
    internalLevelValue: number;
    typeId: string;
};

type RatingData = {
    songId: string;
    difficulty: string;
    dxRating: number;
    isCurrentVersion: boolean;
    constant: number;
};

type ParsedInput = Array<{
    name: string;
    difficulty: string;
    level: string;
    achievement: number;
    dx: boolean;
}>;

const parseInput = (input: string) =>
    Effect.try({
        try: () => {
            const jsonData = JSON.parse(input);
            return dataSchema
                .parse(jsonData)
                .filter(data => data.achievement !== 0.0);
        },
        catch: (error) => new Error(`Failed to parse input: ${error}`)
    });

const fetchSongsForDifficulty = (difficulty: string) =>
    Effect.tryPromise({
        try: () => musicDatabase
            .select({
                id: sheets.id,
                songId: sheets.songId,
                level: sheets.level,
                difficultyId: sheets.difficultyId,
                version: sheets.version,
                typeId: sheets.typeId,
                internalLevelValue: sql<number>`COALESCE(${regionOverrides.levelValue}, ${sheets.internalLevelValue})`.as('internal_level_value')
            })
            .from(sheets)
            .leftJoin(regionOverrides, and(
                eq(regionOverrides.sheetId, sheets.id),
                eq(regionOverrides.region, 'intl')
            ))
            .where(eq(sheets.difficultyId, difficulty)),
        catch: (error) => new Error(`Database query failed for difficulty ${difficulty}: ${error}`)
    });

const processRatingsForDifficulty = (
    difficulty: string,
    parsedInput: ParsedInput,
    songsForDifficulty: SongData[]
): RatingData[] => {
    const inputForDifficulty = parsedInput.filter(data => data.difficulty === difficulty);

    // Create map by songName_difficulty_type (since input now includes dx boolean)
    const songDataMap = new Map<string, SongData[]>();

    for (const song of songsForDifficulty) {
        // Normalize typeId to dx/std for matching
        const normalizedType = song.typeId === 'dx' || song.typeId === 'DX（でらっくす）' ? 'dx' : 'std';
        const key = `${song.songId}_${song.difficultyId}_${normalizedType}`;
        if (!songDataMap.has(key)) {
            songDataMap.set(key, []);
        }
        songDataMap.get(key)!.push(song);
    }

    const ratings: RatingData[] = [];

    for (const inputSong of inputForDifficulty) {
        // Match by songName_difficulty_type
        const inputType = inputSong.dx ? 'dx' : 'std';
        const inputKey = `${inputSong.name}_${inputSong.difficulty}_${inputType}`;
        const songOptions = songDataMap.get(inputKey);

        if (songOptions && songOptions.length > 0) {
            // If multiple levels exist, take the first one (or implement logic to choose)
            const songData = songOptions[0];

            // Use internalLevelValue for calculation
            const dxRating = calculateScore(inputSong.achievement, songData.internalLevelValue);
            const isCurrentVersion = songData.version === CURRENT_VERSION;

            ratings.push({
                songId: songData.songId,
                difficulty,
                dxRating,
                constant: songData.internalLevelValue,
                isCurrentVersion
            });
        }
    }

    return ratings;
};

const returnFinalRatingMakeup = (allRatings: RatingData[]): {
    new: RatingData[],
    old: RatingData[]
} => {
    return {
        new: allRatings.filter(rating => rating.isCurrentVersion).sort((a, b) => b.dxRating - a.dxRating).slice(0, 15),
        old: allRatings.filter(rating => !rating.isCurrentVersion).sort((a, b) => b.dxRating - a.dxRating).slice(0, 35)
    }
}

export const ingestData = (input: string) =>
    pipe(
        parseInput(input),
        Effect.flatMap(parsedInput =>
            pipe(
                DIFFICULTIES,
                Effect.forEach(difficulty =>
                    pipe(
                        fetchSongsForDifficulty(difficulty),
                        Effect.map(songsForDifficulty =>
                            processRatingsForDifficulty(difficulty, parsedInput, songsForDifficulty)
                        )
                    )
                ),
                Effect.map(ratingArrays => ratingArrays.flat()),
                Effect.map(allRatings => {
                    const { new: newRatings, old: oldRatings } = returnFinalRatingMakeup(allRatings);
                    
                    return {
                        newRatings,
                        oldRatings,
                        total: allRatings.reduce((prev, rating) => prev + rating.dxRating, 0)
                    };
                })
            )
        )
    );