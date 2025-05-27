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
    songId: string
    category: string
    title: string
    artist: string
    bpm?: number
    imageName: string
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
