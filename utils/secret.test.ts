import { describe, expect, it } from 'vitest'
import { VALIDATION_MESSAGES } from '@/constants'
import { readSecret, secretErrorMessage } from './secret'

describe('readSecret', () => {
  it('reads and trims the secret from an object', () => {
    expect(readSecret({ secret: '  s3cret ' })).toBe('s3cret')
  })

  it('reads the secret from FormData', () => {
    const form = new FormData()
    form.append('secret', 'abc')
    expect(readSecret(form)).toBe('abc')
  })

  it('returns an empty string when there is no string secret', () => {
    expect(readSecret(undefined)).toBe('')
    expect(readSecret({ secret: 42 })).toBe('')
    expect(readSecret(new FormData())).toBe('')
  })
})

describe('secretErrorMessage', () => {
  it('recognises the gate errors', () => {
    expect(secretErrorMessage(new Error(VALIDATION_MESSAGES.SECRET_INVALID))).toBe(
      VALIDATION_MESSAGES.SECRET_INVALID,
    )
    expect(secretErrorMessage(new Error(VALIDATION_MESSAGES.SECRET_REQUIRED))).toBe(
      VALIDATION_MESSAGES.SECRET_REQUIRED,
    )
  })

  it('ignores anything else', () => {
    expect(secretErrorMessage(new Error('boom'))).toBeNull()
    expect(secretErrorMessage(VALIDATION_MESSAGES.SECRET_INVALID)).toBeNull()
  })
})
