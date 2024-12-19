import { defineConfig } from 'drizzle-kit'
import { TURSO_AUTH_TOKEN, TURSO_DATABASE_URL } from './env/db'

export default defineConfig({
  out: './drizzle',
  schema: './db/schema.ts',
  dialect: 'turso',
  dbCredentials: {
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
  },
})
