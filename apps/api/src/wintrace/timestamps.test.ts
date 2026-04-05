import { describe, expect, test } from 'vitest'
import { toIsoTimestampFromLogfile, toMorgueTimestampFromLogfile } from './timestamps'

describe('logfile timestamp helpers', () => {
  test('applies the crawl month offset when converting to iso timestamps', () => {
    expect(toIsoTimestampFromLogfile('20250106121936S')).toBe('2025-02-06T12:19:36.000Z')
  })

  test('applies the crawl month offset when converting to morgue file timestamps', () => {
    expect(toMorgueTimestampFromLogfile('20250106121936S')).toBe('20250206-121936')
  })

  test('returns the input unchanged when the raw value is malformed', () => {
    expect(toIsoTimestampFromLogfile('bad')).toBe('bad')
    expect(toMorgueTimestampFromLogfile('bad')).toBe('bad')
  })
})
