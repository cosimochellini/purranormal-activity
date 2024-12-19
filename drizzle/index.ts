import { drizzle } from 'drizzle-orm/libsql'
import { TURSO_AUTH_TOKEN, TURSO_DATABASE_URL } from '../env/db'

export const db = drizzle({
  connection: {
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
  },
})
