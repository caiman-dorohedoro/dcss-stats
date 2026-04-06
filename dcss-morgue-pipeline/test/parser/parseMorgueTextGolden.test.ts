import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseMorgueText } from '../../../packages/morgue-parser/src/index'
import type { ParsedMorgueTextRecord } from '../../../packages/morgue-parser/src/types'

function loadMorgueFixture(name: string) {
  return readFileSync(
    path.resolve(process.cwd(), `test/fixtures/morgue/success/${name}`),
    'utf8',
  )
}

function loadExpectedRecord(name: string): ParsedMorgueTextRecord {
  return JSON.parse(
    readFileSync(path.resolve(process.cwd(), `test/fixtures/morgue/expected/${name}`), 'utf8'),
  ) as ParsedMorgueTextRecord
}

const GOLDEN_CASES = [
  {
    name: 'cao-0.34-webtiles-quit',
    morgue: 'cao-0.34-webtiles-quit.txt',
    expected: 'cao-0.34-webtiles-quit.json',
  },
  {
    name: 'cao-trunk-webtiles-death',
    morgue: 'cao-trunk-webtiles-death.txt',
    expected: 'cao-trunk-webtiles-death.json',
  },
  {
    name: 'spell-library-table-full',
    morgue: 'spell-library-table-full.txt',
    expected: 'spell-library-table-full.json',
  },
  {
    name: 'colored-draconian',
    morgue: 'colored-draconian.txt',
    expected: 'colored-draconian.json',
  },
  {
    name: 'skryme-jiyva-full',
    morgue: 'skryme-jiyva-full.txt',
    expected: 'skryme-jiyva-full.json',
  },
  {
    name: 'knorpule3000-gozag-full',
    morgue: 'knorpule3000-gozag-full.txt',
    expected: 'knorpule3000-gozag-full.json',
  },
] as const

describe('parseMorgueText golden fixtures', () => {
  for (const testCase of GOLDEN_CASES) {
    it(`matches expected structured output for ${testCase.name}`, () => {
      const result = parseMorgueText(loadMorgueFixture(testCase.morgue))

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.record).toEqual(loadExpectedRecord(testCase.expected))
      }
    })
  }
})
