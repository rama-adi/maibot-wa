import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { join } from 'path';
import * as musicSchema from "@/database/schemas/music-schema";

// Get the project root directory
const projectRoot = process.cwd();

// Music database
const musicSqlite = new Database(join(projectRoot, "data", "sheet_score.db"));
export const musicDatabase = drizzle(musicSqlite, { schema: musicSchema });

import * as configSchema from "@/database/schemas/config-schema";
const configSqlite = new Database(join(projectRoot, "data", "bot_config.db"));
export const configDatabase = drizzle(configSqlite, { schema: configSchema });

import * as userSchema from "@/database/schemas/user-schema";
const userSqlite = new Database(join(projectRoot, "data", "user.db"));
export const userDatabase = drizzle(userSqlite, { schema: userSchema });