import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
    id: integer('id').primaryKey(),
    phoneNumberHash: text("phone_number_hash").unique(),
    publicId: text('public_id').unique(), 
    name: text('name').notNull(),
    isBanned: integer('is_banned', { mode: 'boolean' }).notNull(),
    bio: text('bio').default("")
}, (table) => {
    return [
        index('users_id_idx').on(table.id),
        index('users_public_id_idx').on(table.publicId),
        index('users_phone_hash_idx').on(table.phoneNumberHash),
        index('users_name_idx').on(table.name)
    ];
});
