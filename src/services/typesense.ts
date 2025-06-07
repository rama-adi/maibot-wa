import type { ArcadeSongInfo, Song } from "@/types/arcade-song-info";
import Typesense from 'typesense';
import { searchSongByTitle as songByTitleQuery, type SearchResult } from "@/database/queries/song-queries";

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

export interface WikiSearchResult {
  title: string;
  excerpt: string;
  hybridScore: number;
  vectorScore: number;
  textScore: number;
  source: string;
  chunkCount: number;
}

export interface WikiSection {
  section: string;
  text: string;
}

export interface WikiDocument {
  title: string;
  sections: WikiSection[];
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

  // Get titles from Typesense results
  const titles = results.hits?.map((hit: any) => hit.document.title) || [];

  // Use searchByTitle from queries.ts to get full song data with relationships
  const searchResults: SearchResult[] = [];
  for (const title of titles) {
    const results = await songByTitleQuery(title);
    if (results.length > 0) {
      searchResults.push(results[0]);
    }
  }

  console.log(searchResults);

  return searchResults;
}