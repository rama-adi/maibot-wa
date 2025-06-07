import { sqliteTable, text, int, index } from 'drizzle-orm/sqlite-core';

export const allowedGroups = sqliteTable('allowed_groups', {
    id: text('id').primaryKey(),
    rateLimit: int('rate_limit').default(1000)
}, (table) => [
    index('allowed_groups_rate_limit_idx').on(table.rateLimit)
]);

export const admins = sqliteTable('admins', {
    id: text('id').primaryKey(),
}, (table) => [
    index('admin_id_idx').on(table.id)
]);

export const rateLimits = sqliteTable('rate_limits', {
    id: text('id').primaryKey(),
    rateLimit: int('rate_limit').default(0),
    resetsAt: int('resets_at')
}, (table) => [
    index('rate_limits_resets_at_idx').on(table.resetsAt)
]);