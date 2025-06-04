import maimaiJson from "@/data/maimai.json" assert { type: "json" };
import type { ArcadeSongInfo, Song } from "@/types/arcade-song-info";
import Typesense from 'typesense';

export const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST!,
      port: 443,
      protocol: "https",
    },
  ],
  apiKey: process.env.TYPESENSE_KEY!,
  connectionTimeoutSeconds: 5,
});

export interface SearchResult {
  primary: Song;
  utages: Song[];
}

export async function searchMaimaiWiki(query: String): void {
  
}

export async function searchSongByTitle(title: string): Promise<SearchResult[]> {
  const results = await typesenseClient.collections("maimai-songs").documents().search({
    q: title,
    query_by: "manual_alias,generated_alias,romaji,normalized_title,title",
    query_by_weights: "5,4,3,4,2",
    prefix: "true",
    per_page: 5,
    sort_by: "_text_match:desc",
  });

  const mmJson = maimaiJson as unknown as ArcadeSongInfo;

  // Preserve Typesense sort order by mapping over results in order
  const allFoundSongs = results.hits?.map((hit: any) => {
    const title = hit.document.title;
    return mmJson.songs.find((song: Song) => song.title === title);
  }).filter((song): song is Song => song !== undefined) || [];

  // Separate regular songs from utage songs using category field
  const regularSongs = allFoundSongs.filter(song =>
    song.category !== '宴会場'
  );
  const utageSongs = allFoundSongs.filter(song =>
    song.category === '宴会場'
  );

  // For each found song, create a SearchResult with primary and utages
  const searchResults: SearchResult[] = [];
  const processedSongs = new Set<string>();

  // First, process regular songs as primary
  regularSongs.forEach(song => {
    if (processedSongs.has(song.songId)) return;

    // Find all utage variants for this regular song
    // Look for utage songs that have the same title but are in 宴会場 category
    // Also check for utage songs where songId contains the regular song title (for prefix cases)
    const utageVariants = mmJson.songs.filter(s =>
      (s.title === song.title || s.songId.includes(song.title)) &&  // Same title or songId contains title
      s.category === '宴会場' &&  // Utage category
      s.songId !== song.songId  // Different songId
    ).filter((utage, index, array) => {
      // dedupe same comment, prio newest date
      const sameComment = array.filter(s => s.comment === utage.comment);
      if (sameComment.length > 1) {
        const sorted = sameComment.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
        return utage === sorted[0];
      }
      return true;
    });

    searchResults.push({
      primary: song,
      utages: utageVariants
    });

    processedSongs.add(song.songId);
    utageVariants.forEach(utage => processedSongs.add(utage.songId));
  });

  // If no regular songs found, but we have utage songs, we need to find their regular counterparts
  if (regularSongs.length === 0 && utageSongs.length > 0) {
    // For each utage song found, try to find its regular counterpart
    utageSongs.forEach(utage => {
      if (processedSongs.has(utage.songId)) return;

      // Look for regular song with same title
      // For utage songs with prefixes, we need to extract the base title from songId
      let baseTitle = utage.title;
      if (utage.songId.includes('[宴]')) {
        baseTitle = utage.songId.replace('[宴]', '').trim();
      } else if (utage.songId.includes('(宴)')) {
        baseTitle = utage.songId.replace('(宴)', '').trim();
      }

      const regularCounterpart = mmJson.songs.find(s =>
        (s.title === utage.title || s.title === baseTitle || s.songId === baseTitle) &&
        s.category !== '宴会場' &&
        s.songId !== utage.songId
      );

      if (regularCounterpart) {
        // Found regular counterpart, use it as primary
        const allUtageVariants = mmJson.songs.filter(s =>
          (s.title === regularCounterpart.title || s.songId.includes(regularCounterpart.title)) &&
          s.category === '宴会場' &&
          s.songId !== regularCounterpart.songId
        ).filter((utage, index, array) => {
          // dedupe same comment, prio newest date
          const sameComment = array.filter(s => s.comment === utage.comment);
          if (sameComment.length > 1) {
            const sorted = sameComment.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
            return utage === sorted[0];
          }
          return true;
        });

        searchResults.push({
          primary: regularCounterpart,
          utages: allUtageVariants
        });

        processedSongs.add(regularCounterpart.songId);
        allUtageVariants.forEach(u => processedSongs.add(u.songId));
      } else {
        // No regular counterpart found, use utage as primary (rare case)
        searchResults.push({
          primary: utage,
          utages: []
        });

        processedSongs.add(utage.songId);
      }
    });
  }
  return searchResults;
}