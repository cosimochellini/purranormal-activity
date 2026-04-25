import { describe, expect, it } from 'vitest'
import { time } from './time'

const SECOND = 1000
const MINUTE = SECOND * 60
const HOUR = MINUTE * 60
const DAY = HOUR * 24
const MONTH = DAY * 30

describe('time', () => {
  it('returns 0 when no fields are provided', () => {
    expect(time({})).toBe(0)
  })

  it('converts seconds correctly', () => {
    expect(time({ seconds: 1 })).toBe(SECOND)
    expect(time({ seconds: 90 })).toBe(90 * SECOND)
  })

  it('converts minutes correctly', () => {
    expect(time({ minutes: 1 })).toBe(MINUTE)
    expect(time({ minutes: 3 })).toBe(3 * MINUTE)
  })

  it('converts hours correctly', () => {
    expect(time({ hours: 1 })).toBe(HOUR)
    expect(time({ hours: 5 })).toBe(5 * HOUR)
  })

  it('converts days correctly', () => {
    expect(time({ days: 1 })).toBe(DAY)
    expect(time({ days: 7 })).toBe(7 * DAY)
  })

  it('converts months correctly (30-day month)', () => {
    expect(time({ months: 1 })).toBe(MONTH)
    expect(time({ months: 2 })).toBe(2 * MONTH)
  })

  it('sums all fields together', () => {
    expect(
      time({
        seconds: 1,
        minutes: 1,
        hours: 1,
        days: 1,
        months: 1,
      }),
    ).toBe(SECOND + MINUTE + HOUR + DAY + MONTH)
  })

  it('treats undefined fields as zero', () => {
    expect(time({ minutes: 2, hours: undefined })).toBe(2 * MINUTE)
  })

  it('handles zero values explicitly', () => {
    expect(time({ seconds: 0, minutes: 0, hours: 0, days: 0, months: 0 })).toBe(0)
  })
})
