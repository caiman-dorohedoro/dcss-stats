import { describe, expect, test } from 'vitest'
import {
  getSkillTraceKey,
  parseDenseSkillTrace,
  parseSerializedSkillTrace,
  parseSkillHeadingColumns,
  toSparseSkillTrace,
} from './skillTrace'

const morgueSample = `
Some unrelated header line
Skill      XL: |  1  2  3  4  5  6  7  8  9 10 |
---------------+--------------------------------+-----
Long Blades    |        2  4  5     6  7  8  9 |  9.0
Maces & Flails |           3  3     4          |  4.0
Unarmed Combat |  3  5  6  7  8  8 10 10 12 12 | 12.0
Spellcasting   |                    1  2  3  4 |  4.0

You have 2 potions of curing.
`

describe('parseSkillHeadingColumns', () => {
  test('finds xl column offsets including double-digit levels', () => {
    expect(
      parseSkillHeadingColumns('Skill      XL: |  1  2  3  4  5  6  7  8  9 10 |'),
    ).toEqual([
      { xl: 1, start: 0, end: 3 },
      { xl: 2, start: 3, end: 6 },
      { xl: 3, start: 6, end: 9 },
      { xl: 4, start: 9, end: 12 },
      { xl: 5, start: 12, end: 15 },
      { xl: 6, start: 15, end: 18 },
      { xl: 7, start: 18, end: 21 },
      { xl: 8, start: 21, end: 24 },
      { xl: 9, start: 24, end: 27 },
      { xl: 10, start: 27, end: 30 },
    ])
  })
})

describe('parseDenseSkillTrace', () => {
  test('parses multi-word skill names and carries levels forward through blanks', () => {
    expect(parseDenseSkillTrace(morgueSample)).toEqual({
      'Long Blades': [0, 0, 2, 4, 5, 5, 6, 7, 8, 9],
      'Maces & Flails': [0, 0, 0, 3, 3, 3, 4, 4, 4, 4],
      'Unarmed Combat': [3, 5, 6, 7, 8, 8, 10, 10, 12, 12],
      Spellcasting: [0, 0, 0, 0, 0, 0, 1, 2, 3, 4],
    })
  })

  test('returns an empty object when the morgue does not contain a skill table', () => {
    expect(parseDenseSkillTrace('No skill table here')).toEqual({})
  })
})

describe('toSparseSkillTrace', () => {
  test('compresses dense skill traces into sparse change points', () => {
    expect(
      toSparseSkillTrace({
        Fighting: [0, 0, 4, 4, 4, 5, 5, 7],
      }),
    ).toEqual({
      Fighting: [
        [3, 4],
        [6, 5],
        [8, 7],
      ],
    })
  })
})

describe('parseSerializedSkillTrace', () => {
  test('serializes known skills to stable ids', () => {
    const parsed = parseSerializedSkillTrace(morgueSample)

    expect(parsed[getSkillTraceKey('Long Blades')]).toEqual([
      [3, 2],
      [4, 4],
      [5, 5],
      [7, 6],
      [8, 7],
      [9, 8],
      [10, 9],
    ])
    expect(parsed[getSkillTraceKey('Unarmed Combat')]).toEqual([
      [1, 3],
      [2, 5],
      [3, 6],
      [4, 7],
      [5, 8],
      [7, 10],
      [9, 12],
    ])
  })
})
