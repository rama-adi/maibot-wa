import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// -- LOOKUP TABLES --

export const categories = sqliteTable('categories', {
    id: text('id').primaryKey(),
});

export const versions = sqliteTable('versions', {
    id: text('id').primaryKey(),
    abbr: text('abbr'),
});

export const types = sqliteTable('types', {
    id: text('id').primaryKey(),
    name: text('name'),
    abbr: text('abbr'),
    iconUrl: text('icon_url'),
    iconHeight: integer('icon_height'),
});

export const difficulties = sqliteTable('difficulties', {
    id: text('id').primaryKey(),
    name: text('name'),
    color: text('color'),
});

export const regions = sqliteTable('regions', {
    id: text('id').primaryKey(), // Corresponds to region
    name: text('name'),
});

// -- MAIN DATA TABLES --

export const songs = sqliteTable('songs', {
    id: text('id').primaryKey(), // Corresponds to songId
    internalProcessId: integer('internal_process_id').default(0),
    title: text('title').notNull(),
    artist: text('artist').notNull(),
    imageName: text('image_name').notNull(),
    releaseDate: text('release_date').notNull(),
    isNew: integer('is_new', { mode: 'boolean' }).notNull(),
    isLocked: integer('is_locked', { mode: 'boolean' }).notNull(),
    bpm: real('bpm'),
    comment: text('comment'),
    categoryId: text('category_id').notNull().references(() => categories.id),
    versionId: text('version_id').notNull().references(() => versions.id),
    // Utage-specific computed fields
    isUtage: integer('is_utage', { mode: 'boolean' }).notNull(), // true if category is '宴会場'
    baseTitle: text('base_title').notNull(), // cleaned title for matching (removes [宴], (宴) prefixes)
    normalizedTitle: text('normalized_title').notNull(), // further normalized for search
}, (table) => [
    index('internal_process_id_idx').on(table.internalProcessId),

    // Indexes for utage song queries
    index('songs_category_idx').on(table.categoryId),
    index('songs_is_utage_idx').on(table.isUtage),
    index('songs_title_idx').on(table.title),
    index('songs_base_title_idx').on(table.baseTitle),
    index('songs_normalized_title_idx').on(table.normalizedTitle),
    // Compound index for finding utage variants
    index('songs_base_title_utage_idx').on(table.baseTitle, table.isUtage),
    // Index for deduplication by comment and release date
    index('songs_comment_release_idx').on(table.comment, table.releaseDate),
]);

export const sheets = sqliteTable('sheets', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    songId: text('song_id').notNull().references(() => songs.id),
    typeId: text('type_id').notNull().references(() => types.id),
    difficultyId: text('difficulty_id').notNull().references(() => difficulties.id),
    level: text('level').notNull(),
    levelValue: real('level_value').notNull(),
    internalLevel: text('internal_level'),
    internalLevelValue: real('internal_level_value').notNull(),
    noteDesigner: text('note_designer'),
    isSpecial: integer('is_special', { mode: 'boolean' }).notNull(),
    version: text('version'),
    // Note Counts
    notesTap: integer('notes_tap'),
    notesHold: integer('notes_hold'),
    notesSlide: integer('notes_slide'),
    notesTouch: integer('notes_touch'),
    notesBreak: integer('notes_break'),
    notesTotal: integer('notes_total'),
    // Region Availability
    regionJp: integer('region_jp', { mode: 'boolean' }).notNull(),
    regionIntl: integer('region_intl', { mode: 'boolean' }).notNull(),
    regionCn: integer('region_cn', { mode: 'boolean' }).notNull(),
}, (table) => [
    // Index for finding sheets by song
    index('sheets_song_idx').on(table.songId),
    // Compound index for song + difficulty queries
    index('sheets_song_difficulty_idx').on(table.songId, table.difficultyId),
]);

export const regionOverrides = sqliteTable('region_overrides', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sheetId: integer('sheet_id').notNull().references(() => sheets.id),
    region: text('region').notNull(), // 'intl'
    versionId: text('version_id').references(() => versions.id),
    level: text('level'),
    levelValue: real('level_value'),
});

// -- UTAGE RELATIONSHIPS TABLE --
// This table pre-computes the relationships between regular songs and their utage variants
export const utageRelationships = sqliteTable('utage_relationships', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    primarySongId: text('primary_song_id').notNull().references(() => songs.id),
    utageSongId: text('utage_song_id').notNull().references(() => songs.id),
    relationshipType: text('relationship_type').notNull(), // 'same_title', 'title_variant', 'id_contains'
}, (table) => [
    // Indexes for efficient utage relationship queries
    index('utage_primary_idx').on(table.primarySongId),
    index('utage_utage_idx').on(table.utageSongId),
    uniqueIndex('utage_unique_pair_idx').on(table.primarySongId, table.utageSongId),
]);

// -- RELATIONS --

export const songRelations = relations(songs, ({ one, many }) => ({
    category: one(categories, {
        fields: [songs.categoryId],
        references: [categories.id],
    }),
    version: one(versions, {
        fields: [songs.versionId],
        references: [versions.id],
    }),
    sheets: many(sheets),
    // Utage relationships - songs that have this song as their primary
    utageVariants: many(utageRelationships),
    // Relationships where this song is the utage variant
    regularVersions: many(utageRelationships),
}));

export const sheetRelations = relations(sheets, ({ one, many }) => ({
    song: one(songs, {
        fields: [sheets.songId],
        references: [songs.id],
    }),
    type: one(types, {
        fields: [sheets.typeId],
        references: [types.id],
    }),
    difficulty: one(difficulties, {
        fields: [sheets.difficultyId],
        references: [difficulties.id],
    }),
    regionOverrides: many(regionOverrides),
}));

export const regionOverrideRelations = relations(regionOverrides, ({ one }) => ({
    sheet: one(sheets, {
        fields: [regionOverrides.sheetId],
        references: [sheets.id],
    }),
    version: one(versions, {
        fields: [regionOverrides.versionId],
        references: [versions.id],
    })
}));

export const regionRelations = relations(regions, ({ one }) => ({
    // Relations can be added here if needed
}));

export const utageRelationshipRelations = relations(utageRelationships, ({ one }) => ({
    primarySong: one(songs, {
        fields: [utageRelationships.primarySongId],
        references: [songs.id],
    }),
    utageSong: one(songs, {
        fields: [utageRelationships.utageSongId],
        references: [songs.id],
    }),
}));