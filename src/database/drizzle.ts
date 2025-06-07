import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as musicSchema from "@/database/schemas/music-schema";

// Music database
const musicSqlite = new Database("data/sheet_score.db");
export const musicDatabase = drizzle(musicSqlite, { schema: musicSchema });


import * as configSchema from "@/database/schemas/config-schema";
const configSqlite = new Database("data/bot_config.db");
export const configDatabase = drizzle(configSqlite, { schema: configSchema });