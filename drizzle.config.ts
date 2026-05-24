import { defineConfig } from 'drizzle-kit'
import { serverEnv } from './env/server'

export default defineConfig({
  out: './drizzle',
  schema: './db/schema.ts',
  dialect: 'turso',
  dbCredentials: {
    url: serverEnv.tursoUrl,
    authToken: serverEnv.tursoToken,
  },
})
