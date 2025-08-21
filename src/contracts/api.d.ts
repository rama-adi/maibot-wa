import * as _trpc_server from '@trpc/server';

export interface SearchResult {
    primary: Song;
    utages: Song[];
}

export type MaimaiJsonSongInfo = {
    artist: string
    catcode: string
    image_url: string
    release: string
    lev_bas?: string
    lev_adv?: string
    lev_exp?: string
    lev_mas?: string
    sort: string
    title: string
    title_kana: string
    version: string
    lev_remas?: string
    dx_lev_bas?: string
    dx_lev_adv?: string
    dx_lev_exp?: string
    dx_lev_mas?: string
    key?: string
    dx_lev_remas?: string
    date?: string
    lev_utage?: string
    kanji?: string
    comment?: string
    buddy?: string
}

export interface ArcadeSongInfo {
    songs: Song[]
    categories: Category[]
    versions: Version[]
    types: Type[]
    difficulties: Difficulty[]
    regions: Region[]
    updateTime: string
}

export interface Song {
    internalProcessId?: number
    songId: string
    category: string
    title: string
    artist: string
    bpm?: number
    imageName: string
    r2ImageUrl?: string
    version: string
    releaseDate: string
    isNew: boolean
    isLocked: boolean
    comment?: string
    sheets: Sheet[]
}

export interface Sheet {
    type: string
    difficulty: string
    level: string
    levelValue: number
    internalLevel?: string
    internalLevelValue: number
    noteDesigner?: string
    noteCounts: NoteCounts
    regions: Regions
    regionOverrides: RegionOverrides
    isSpecial: boolean
    version?: string
}

export interface NoteCounts {
    tap?: number
    hold?: number
    slide?: number
    touch?: number
    break?: number
    total?: number
}

export interface Regions {
    jp: boolean
    intl: boolean
    cn: boolean
}


export interface RegionOverrides {
    intl: Intl
}

export interface Intl {
    version?: string
    level?: string
    levelValue?: number
}

export interface Category {
    category: string
}

export interface Version {
    version: string
    abbr: string
}

export interface Type {
    type: string
    name: string
    abbr: string
    iconUrl?: string
    iconHeight?: number
}

export interface Difficulty {
    difficulty: string
    name: string
    color: string
}

export interface Region {
    region: string
    name: string
}

declare const trpcApi: _trpc_server.TRPCBuiltRouter<{
    ctx: any;
    meta: object;
    errorShape: _trpc_server.TRPCDefaultErrorShape;
    transformer: false;
}, _trpc_server.TRPCDecorateCreateRouterOptions<{
    songs: _trpc_server.TRPCBuiltRouter<{
        ctx: any;
        meta: object;
        errorShape: _trpc_server.TRPCDefaultErrorShape;
        transformer: false;
    }, _trpc_server.TRPCDecorateCreateRouterOptions<{
        findByTitle: _trpc_server.TRPCQueryProcedure<{
            input: {
                readonly title: string;
            };
            output: SearchResult[];
            meta: object;
        }>;
        searchByMeta: _trpc_server.TRPCQueryProcedure<{
            input: {
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
            };
            output: SearchResult[];
            meta: object;
        }>;
        findByInternalId: _trpc_server.TRPCQueryProcedure<{
            input: {
                readonly internalId: number;
            };
            output: Song | null;
            meta: object;
        }>;
    }>>;
}>>;
type API = typeof trpcApi;

export { type API, trpcApi };