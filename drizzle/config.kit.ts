import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schemas/config-schema.ts',
  out: './drizzle/config_migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './bot_config.db',
  },
});