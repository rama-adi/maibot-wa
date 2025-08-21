import { Context, Data, Effect } from "effect";
import type { SearchResult } from "./api";

export class MaiSongSearchError extends Data.TaggedError("MaiSongSearchError")<{
    readonly operation: "byTitle" | "byMeta";
    readonly input: string;
    readonly cause: unknown;
    readonly message: string;
}> {}

export class MaiSongNetworkError extends Data.TaggedError("MaiSongNetworkError")<{
    readonly operation: "byTitle" | "byMeta";
    readonly input: string;
    readonly cause: unknown;
    readonly message: string;
}> {}

export class MaiSongValidationError extends Data.TaggedError("MaiSongValidationError")<{
    readonly operation: "byTitle" | "byMeta";
    readonly input: string;
    readonly cause: unknown;
    readonly message: string;
}> {}

export interface MetaSearch {
    readonly artist?: string | null | undefined;
    readonly minLevel?: number | null | undefined;
    readonly maxLevel?: number | null | undefined;
    readonly minLevelDisplay?: string | null | undefined;
    readonly maxLevelDisplay?: string | null | undefined;
    readonly minBpm?: number | null | undefined;
    readonly maxBpm?: number | null | undefined;
    readonly category?: string | null | undefined;
    readonly version?: string | null | undefined;
    readonly isNew?: boolean | null | undefined;
    readonly isLocked?: boolean | null | undefined;
    readonly isUtage?: boolean | null | undefined;
    readonly type?: string | null | undefined;
    readonly difficulty?: string | null | undefined;
    readonly noteDesigner?: string | null | undefined;
    readonly isSpecial?: boolean | null | undefined;
    readonly hasRegionJp?: boolean | null | undefined;
    readonly hasRegionIntl?: boolean | null | undefined;
    readonly hasRegionCn?: boolean | null | undefined;
    readonly limit?: number | undefined;
}

export class MaiSongData extends Context.Tag("MaiSongData")<
    MaiSongData,
    {
        byTitle: (title: string) => Effect.Effect<SearchResult[], MaiSongSearchError | MaiSongNetworkError | MaiSongValidationError>;
        byMeta: (meta: MetaSearch) => Effect.Effect<SearchResult[], MaiSongSearchError | MaiSongNetworkError | MaiSongValidationError>;
    }
>() { }