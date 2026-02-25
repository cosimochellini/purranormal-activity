export function getRequiredEnv(key: string) {
  const value = typeof process !== 'undefined' ? process.env?.[key] : undefined

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}
