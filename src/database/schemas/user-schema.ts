import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
    id: integer('id').primaryKey(),
    phoneNumberHash: text("phone_number_hash").notNull().unique(),
    publicId: text('public_id').unique().notNull(), 
    name: text('name').notNull(),
    isBanned: integer('is_banned', { mode: 'boolean' }).notNull(),
    bio: text('bio').default("").notNull(),
    rating: integer('rating').default(0).notNull(),
    favSong: integer('fav_song'),
}, (table) => {
    return [
        index('users_id_idx').on(table.id),
        index('users_public_id_idx').on(table.publicId),
        index('users_phone_hash_idx').on(table.phoneNumberHash),
        index('users_name_idx').on(table.name)
    ];
});

export const topUserSongs = sqliteTable('top_user_songs', {
    id: integer('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id),
    songs: text('songs', { mode: 'json' }).notNull(),
}, (table) => {
    return [
        index('top_user_songs_user_id_idx').on(table.userId),
    ];
});