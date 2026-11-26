import { z } from 'zod'

export enum SortBy {
  Recent = 'recent',
  Oldest = 'oldest',
  Title = 'title',
}

export enum TimeRange {
  All = 'all',
  Day = 'day',
  Week = 'week',
  Month = 'month',
}

/**
 * `/explore` search params. Shared by the route's `validateSearch` and the
 * `listLogs` server function, so a URL and an RPC payload parse identically.
 * Every field falls back to its default instead of failing: a hand-edited or
 * stale link still renders the page.
 */
/** Longest search the schema accepts; the search box enforces it too. */
export const SEARCH_MAX_LENGTH = 200

export const EXPLORE_DEFAULTS = {
  page: 1,
  limit: 10,
  search: '',
  categories: [] as number[],
  sortBy: SortBy.Recent,
  timeRange: TimeRange.All,
}

// The router JSON-parses search values, so `?search=123` arrives as a number.
const toText = (v: unknown) => (v == null ? '' : String(v))
// Arrays round-trip as JSON; the comma form (`?categories=1,2`) is what the
// pre-router (nuqs) URLs used, so shared links keep working.
const toList = (v: unknown) =>
  typeof v === 'string' ? v.split(',').filter(Boolean) : typeof v === 'number' ? [v] : v

export const exploreSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(EXPLORE_DEFAULTS.page).catch(EXPLORE_DEFAULTS.page),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(EXPLORE_DEFAULTS.limit)
    .catch(EXPLORE_DEFAULTS.limit),
  search: z.preprocess(toText, z.string().max(SEARCH_MAX_LENGTH)).default('').catch(''),
  categories: z
    .preprocess(toList, z.array(z.coerce.number().int().positive()))
    .default([])
    .catch([]),
  sortBy: z.enum(SortBy).default(SortBy.Recent).catch(SortBy.Recent),
  timeRange: z.enum(TimeRange).default(TimeRange.All).catch(TimeRange.All),
})

export type ExploreSearch = z.infer<typeof exploreSearchSchema>
