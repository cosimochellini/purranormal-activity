import { SECRET } from '@/env/secret'

interface SecretValidationOptions {
  caseInsensitive?: boolean
}

export function isSecretValid(
  providedSecret: string | null | undefined,
  options: SecretValidationOptions = {},
) {
  if (!providedSecret) return false

  const expectedSecret = SECRET.trim()
  const normalizedProvidedSecret = providedSecret.trim()

  if (!expectedSecret || !normalizedProvidedSecret) return false

  if (options.caseInsensitive) {
    return normalizedProvidedSecret.toLowerCase() === expectedSecret.toLowerCase()
  }

  return normalizedProvidedSecret === expectedSecret
}

export function readSecretFromRequest(request: Request) {
  const adminSecretHeader = request.headers.get('x-admin-secret')
  if (adminSecretHeader) return adminSecretHeader

  const authorization = request.headers.get('authorization')
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7)
  }

  const fromQuery = new URL(request.url).searchParams.get('secret')
  if (fromQuery) return fromQuery

  return null
}
