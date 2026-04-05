import { describe, expect, test } from 'vitest'
import { buildProgressiveSkillRecommendations, buildSkillRecommendations } from './recommendations'
import { WinTraceRecord } from './types'

const baseRecord = {
  server: 'CXC',
  sourceBucket: '0.32',
  fullVersion: '0.32.1',
  longVersion: '0.32.1-5-gba85492886',
  versionMinor: '0.32',
  race: 'Minotaur',
  class: 'Fighter',
  char: 'MiFi',
  startAt: '2025-10-01T11:32:01.000Z',
  endAt: '2025-10-07T22:59:53.000Z',
  religionWarnings: [],
} satisfies Omit<WinTraceRecord, 'gameId' | 'player' | 'finalGod' | 'religionTrace' | 'skills'>

const records: WinTraceRecord[] = [
  {
    ...baseRecord,
    gameId: 'game-1',
    player: 'a',
    finalGod: 'Okawaru',
    religionTrace: [[3, 'Okawaru']],
    skills: {
      fighting: [
        [6, 4],
        [10, 5],
        [12, 6],
      ],
      axes: [
        [5, 4],
        [11, 5],
      ],
      armour: [
        [9, 2],
        [10, 3],
      ],
    },
  },
  {
    ...baseRecord,
    gameId: 'game-2',
    player: 'b',
    finalGod: 'Okawaru',
    religionTrace: [[4, 'Okawaru']],
    skills: {
      fighting: [
        [6, 5],
        [9, 6],
        [11, 7],
      ],
      axes: [
        [7, 3],
        [10, 4],
      ],
      throwing: [[12, 2]],
    },
  },
  {
    ...baseRecord,
    gameId: 'game-3',
    player: 'c',
    finalGod: 'Makhleb',
    religionTrace: [[5, 'Makhleb']],
    skills: {
      fighting: [
        [6, 4],
        [10, 4],
      ],
      axes: [
        [6, 3],
        [11, 4],
      ],
    },
  },
]

describe('buildSkillRecommendations', () => {
  test('filters records and summarizes skill usage around the current xl', () => {
    const result = buildSkillRecommendations({
      records,
      xl: 10,
      nextWindow: 2,
      versionMinor: '0.32',
      race: 'Minotaur',
      className: 'Fighter',
      godAtXl: 'Okawaru',
    })

    expect(result).toMatchObject({
      sampleSize: 2,
      xl: 10,
      nextWindow: 2,
      filters: {
        versionMinor: '0.32',
        race: 'Minotaur',
        className: 'Fighter',
        godAtXl: 'Okawaru',
      },
    })

    expect(result.skills[0]).toEqual({
      skillId: 'fighting',
      sampleSize: 2,
      nonZeroCount: 2,
      nonZeroRate: 1,
      trainedAtXlCount: 1,
      trainedAtXlRate: 0.5,
      trainedNextWindowCount: 2,
      trainedNextWindowRate: 1,
      levelSummary: {
        min: 5,
        max: 6,
        mean: 5.5,
        p25: 5.25,
        median: 5.5,
        p75: 5.75,
      },
    })

    expect(result.skills.find((skill) => skill.skillId === 'axes')).toEqual({
      skillId: 'axes',
      sampleSize: 2,
      nonZeroCount: 2,
      nonZeroRate: 1,
      trainedAtXlCount: 1,
      trainedAtXlRate: 0.5,
      trainedNextWindowCount: 1,
      trainedNextWindowRate: 0.5,
      levelSummary: {
        min: 4,
        max: 4,
        mean: 4,
        p25: 4,
        median: 4,
        p75: 4,
      },
    })

    expect(result.skills.find((skill) => skill.skillId === 'armour')).toEqual({
      skillId: 'armour',
      sampleSize: 2,
      nonZeroCount: 1,
      nonZeroRate: 0.5,
      trainedAtXlCount: 1,
      trainedAtXlRate: 0.5,
      trainedNextWindowCount: 0,
      trainedNextWindowRate: 0,
      levelSummary: {
        min: 0,
        max: 3,
        mean: 1.5,
        p25: 0.75,
        median: 1.5,
        p75: 2.25,
      },
    })
  })

  test('can restrict aggregation to explicit skill ids', () => {
    const result = buildSkillRecommendations({
      records,
      xl: 10,
      godAtXl: 'Okawaru',
      skillIds: ['throwing', 'fighting'],
    })

    expect(result.skills.map((skill) => skill.skillId)).toEqual(['fighting', 'throwing'])
    expect(result.skills.find((skill) => skill.skillId === 'throwing')).toMatchObject({
      sampleSize: 2,
      nonZeroCount: 0,
      trainedAtXlCount: 0,
      trainedNextWindowCount: 1,
    })
  })

  test('falls back from race+class to broader scopes when the sample is too small', () => {
    const result = buildProgressiveSkillRecommendations({
      records,
      xl: 10,
      versionMinor: '0.32',
      race: 'Minotaur',
      className: 'Gladiator',
      minSample: 2,
    })

    expect(result.matchedBy).toBe('race')
    expect(result.requestedFilters).toEqual({
      race: 'Minotaur',
      className: 'Gladiator',
    })
    expect(result.sampleThreshold).toBe(2)
    expect(result.sampleSize).toBe(3)
    expect(result.skills[0]?.skillId).toBe('fighting')
  })
})
