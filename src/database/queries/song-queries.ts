import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { eq, and, or, like, desc, asc, sql, inArray } from 'drizzle-orm';
import { musicDatabase } from "@/database/drizzle";
import type { Song } from '@/types/arcade-song-info';
import * as musicSchema from "@/database/schemas/music-schema";

export interface SearchResult {
    primary: Song;
    utages: Song[];
}

/**
 * Convert database song record to Song interface
 */
async function dbSongToSong(dbSong: typeof musicSchema.songs.$inferSelect): Promise<Song> {
    // Fetch sheets for this song
    const sheets = await musicDatabase
        .select()
        .from(musicSchema.sheets)
        .leftJoin(musicSchema.types, eq(musicSchema.sheets.typeId, musicSchema.types.id))
        .leftJoin(musicSchema.difficulties, eq(musicSchema.sheets.difficultyId, musicSchema.difficulties.id))
        .where(eq(musicSchema.sheets.songId, dbSong.id));

    return {
        internalProcessId: dbSong.internalProcessId || 0,
        songId: dbSong.id,
        category: dbSong.categoryId,
        title: dbSong.title,
        artist: dbSong.artist,
        bpm: dbSong.bpm || undefined,
        imageName: dbSong.imageName,
        version: dbSong.versionId,
        releaseDate: dbSong.releaseDate,
        isNew: dbSong.isNew,
        isLocked: dbSong.isLocked,
        comment: dbSong.comment || undefined,
        sheets: sheets.map(sheet => {
            // Normalize type names for compatibility with the UI
            let type = sheet.types?.name || sheet.sheets.typeId;
            if (type === 'DX（でらっくす）') type = 'dx';
            else if (type === 'STD（スタンダード）') type = 'std';
            else if (type === '宴（宴会場）') type = 'utage';
            
            // Normalize difficulty names
            let difficulty = (sheet.difficulties?.name || sheet.sheets.difficultyId).toLowerCase();
            if (difficulty === 're:master') difficulty = 'remaster';
            
            return {
                type,
                difficulty,
                level: sheet.sheets.level,
                levelValue: sheet.sheets.levelValue,
                internalLevel: sheet.sheets.internalLevel || undefined,
                internalLevelValue: sheet.sheets.internalLevelValue,
                noteDesigner: sheet.sheets.noteDesigner || undefined,
                noteCounts: {
                    tap: sheet.sheets.notesTap || 0,
                    hold: sheet.sheets.notesHold || 0,
                    slide: sheet.sheets.notesSlide || 0,
                    touch: sheet.sheets.notesTouch || 0,
                    break: sheet.sheets.notesBreak || 0,
                    total: sheet.sheets.notesTotal || 0
                },
                regions: {
                    jp: sheet.sheets.regionJp,
                    intl: sheet.sheets.regionIntl,
                    cn: sheet.sheets.regionCn
                },
                regionOverrides: {
                    intl: {}
                },
                isSpecial: sheet.sheets.isSpecial,
                version: sheet.sheets.version || undefined
            };
        }).filter(sheet => sheet.level !== '*')
    };
}

/**
 * Find a song by its internal process ID
 */
export async function findSongByInternalId(internalId: number): Promise<Song | null> {
    const dbSong = await musicDatabase
        .select()
        .from(musicSchema.songs)
        .where(eq(musicSchema.songs.internalProcessId, internalId))
        .limit(1)
        .get();

    if (!dbSong) {
        return null;
    }

    return await dbSongToSong(dbSong);
}

/**
 * MANDATORY: Search songs by title with utage relationship optimization
 * Replaces the complex JavaScript filtering logic with efficient database queries
 */
export async function searchSongByTitle(title: string, limit: number = 10): Promise<SearchResult[]> {
    const normalizedSearch = title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

    // 1. Search for songs using database indexes
    const matchingSongs = await musicDatabase
        .select()
        .from(musicSchema.songs)
        .where(
            or(
                like(musicSchema.songs.title, `%${title}%`),
                like(musicSchema.songs.baseTitle, `%${title}%`),
                like(musicSchema.songs.normalizedTitle, `%${normalizedSearch}%`),
                eq(musicSchema.songs.title, title), // Exact match
                eq(musicSchema.songs.baseTitle, title),
                // Additional flexible matching like the old script
                like(musicSchema.songs.id, `%${title}%`), // songId contains title
                like(musicSchema.songs.title, `%${normalizedSearch}%`)
            )
        )
        .orderBy(
            desc(sql`
        CASE 
          WHEN ${musicSchema.songs.title} = ${title} THEN 5
          WHEN ${musicSchema.songs.baseTitle} = ${title} THEN 4
          WHEN ${musicSchema.songs.title} LIKE ${title + '%'} THEN 3
          WHEN ${musicSchema.songs.baseTitle} LIKE ${title + '%'} THEN 2
          ELSE 1
        END
      `),
            asc(musicSchema.songs.title)
        )
        .limit(limit * 3); // Get more results to account for grouping

    // 2. Separate regular and utage songs
    const regularSongs = matchingSongs.filter(song => !song.isUtage);
    const utageSongs = matchingSongs.filter(song => song.isUtage);

    const results: SearchResult[] = [];
    const processedSongs = new Set<string>();

    // 3. Process regular songs as primary with their utage variants
    for (const regularSong of regularSongs.slice(0, limit)) {
        if (processedSongs.has(regularSong.id)) continue;

        // Get pre-computed utage variants for this regular song
        const utageVariants = await musicDatabase
            .select()
            .from(musicSchema.songs)
            .innerJoin(
                musicSchema.utageRelationships,
                eq(musicSchema.songs.id, musicSchema.utageRelationships.utageSongId)
            )
            .where(eq(musicSchema.utageRelationships.primarySongId, regularSong.id))
            .orderBy(desc(musicSchema.songs.releaseDate));

        // Deduplicate utage variants by comment (keeping newest)
        let deduplicatedUtages = utageVariants.reduce((acc, item) => {
            const utage = item.songs;
            const existing = acc.find(u => u.comment === utage.comment);
            if (!existing) {
                acc.push(utage);
            } else if (new Date(utage.releaseDate) > new Date(existing.releaseDate)) {
                const index = acc.indexOf(existing);
                acc[index] = utage;
            }
            return acc;
        }, [] as typeof utageVariants[0]['songs'][]);

        // If no pre-computed relationships found, try flexible matching like old script
        if (deduplicatedUtages.length === 0) {
            const flexibleUtages = await musicDatabase
                .select()
                .from(musicSchema.songs)
                .where(
                    and(
                        eq(musicSchema.songs.isUtage, true), // Is utage
                        or(
                            eq(musicSchema.songs.title, regularSong.title), // Same title
                            like(musicSchema.songs.id, `%${regularSong.title}%`), // songId contains title
                            eq(musicSchema.songs.baseTitle, regularSong.baseTitle) // Same base title
                        )
                    )
                )
                .orderBy(desc(musicSchema.songs.releaseDate));

            deduplicatedUtages = flexibleUtages.reduce((acc, utage) => {
                const existing = acc.find(u => u.comment === utage.comment);
                if (!existing) {
                    acc.push(utage);
                } else if (new Date(utage.releaseDate) > new Date(existing.releaseDate)) {
                    const index = acc.indexOf(existing);
                    acc[index] = utage;
                }
                return acc;
            }, [] as typeof flexibleUtages);
        }

        // Filter out utages with "*" level before processing
        const filteredUtages = await Promise.all(deduplicatedUtages.map(async (utage) => {
            const utageSong = await dbSongToSong(utage);
            // Check if this utage has any valid (non-"*") sheets
            const hasValidSheets = utageSong.sheets.length > 0;
            return hasValidSheets ? utageSong : null;
        }));

        results.push({
            primary: await dbSongToSong(regularSong),
            utages: filteredUtages.filter(Boolean) as Song[]
        });

        processedSongs.add(regularSong.id);
        deduplicatedUtages.forEach(utage => processedSongs.add(utage.id));
    }

    // 4. Handle orphaned utage songs if no regular songs found
    if (results.length === 0 && utageSongs.length > 0) {
        for (const utageSong of utageSongs.slice(0, limit)) {
            if (processedSongs.has(utageSong.id)) continue;

            // Try to find regular counterpart
            const regularCounterpart = await musicDatabase
                .select()
                .from(musicSchema.songs)
                .innerJoin(
                    musicSchema.utageRelationships,
                    eq(musicSchema.songs.id, musicSchema.utageRelationships.primarySongId)
                )
                .where(eq(musicSchema.utageRelationships.utageSongId, utageSong.id))
                .limit(1);

            if (regularCounterpart.length > 0 && regularCounterpart[0]) {
                const regular = regularCounterpart[0].songs;
                if (!regular) continue;

                // Get all utage variants for this regular song
                const allUtageVariants = await musicDatabase
                    .select()
                    .from(musicSchema.songs)
                    .innerJoin(
                        musicSchema.utageRelationships,
                        eq(musicSchema.songs.id, musicSchema.utageRelationships.utageSongId)
                    )
                    .where(eq(musicSchema.utageRelationships.primarySongId, regular.id))
                    .orderBy(desc(musicSchema.songs.releaseDate));

                // Deduplicate by comment
                const deduplicatedUtages = allUtageVariants.reduce((acc, item) => {
                    const utage = item.songs;
                    const existing = acc.find(u => u.comment === utage.comment);
                    if (!existing) {
                        acc.push(utage);
                    } else if (new Date(utage.releaseDate) > new Date(existing.releaseDate)) {
                        const index = acc.indexOf(existing);
                        acc[index] = utage;
                    }
                    return acc;
                }, [] as typeof allUtageVariants[0]['songs'][]);

                // Filter out utages with "*" level before processing
                const filteredUtages = await Promise.all(deduplicatedUtages.map(async (utage) => {
                    const utageSong = await dbSongToSong(utage);
                    // Check if this utage has any valid (non-"*") sheets
                    const hasValidSheets = utageSong.sheets.length > 0;
                    return hasValidSheets ? utageSong : null;
                }));

                results.push({
                    primary: await dbSongToSong(regular),
                    utages: filteredUtages.filter(Boolean) as Song[]
                });

                processedSongs.add(regular.id);
                deduplicatedUtages.forEach(utage => processedSongs.add(utage.id));
            } else {
                // No regular counterpart found, use utage as primary
                results.push({
                    primary: await dbSongToSong(utageSong),
                    utages: []
                });
                processedSongs.add(utageSong.id);
            }
        }
    }

    return results.slice(0, limit);
}

