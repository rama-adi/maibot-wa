import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schemas/user-schema.ts',
  out: './drizzle/user_migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './user.db',
  },
});