import { describe, expect, test } from 'vitest'
import {
  filterWinTraceRecords,
  getGodAtXl,
  getSkillLevelAtXl,
  getSkillLevelsAtXl,
  getSkillsTrainedAtXl,
  wasSkillTrainedAtXl,
  wasSkillTrainedInWindow,
} from './query'
import { WinTraceRecord } from './types'

const record: WinTraceRecord = {
  gameId: 'game-1',
  server: 'CNC',
  sourceBucket: '0.32',
  fullVersion: '0.32.1',
  longVersion: '0.32.1-5-gba85492886',
  versionMinor: '0.32',
  player: 'tunatongue',
  race: 'Ghoul',
  class: 'Monk',
  char: 'GhMo',
  startAt: '2025-04-03T11:37:18.000Z',
  endAt: '2025-04-03T13:59:50.000Z',
  finalGod: 'Ru',
  religionTrace: [
    [7, 'Ru'],
    [20, null],
  ],
  religionWarnings: [],
  skills: {
    '1': [
      [3, 1],
      [4, 2],
      [6, 3],
    ],
    '7': [
      [3, 4],
      [6, 5],
      [8, 8],
    ],
  },
}

describe('query helpers', () => {
  test('returns the active god at a given xl', () => {
    expect(getGodAtXl(record.religionTrace, 6)).toBeNull()
    expect(getGodAtXl(record.religionTrace, 7)).toBe('Ru')
    expect(getGodAtXl(record.religionTrace, 20)).toBeNull()
  })

  test('returns the latest skill level at xl', () => {
    expect(
      getSkillLevelAtXl({
        skills: record.skills,
        skillId: '1',
        xl: 5,
      }),
    ).toBe(2)
    expect(
      getSkillLevelAtXl({
        skills: record.skills,
        skillId: '7',
        xl: 2,
      }),
    ).toBe(0)
  })

  test('returns all non-zero skill levels at xl', () => {
    expect(
      getSkillLevelsAtXl({
        skills: record.skills,
        xl: 6,
      }),
    ).toEqual({
      '1': 3,
      '7': 5,
    })
  })

  test('reports which skills were trained exactly at xl', () => {
    expect(
      getSkillsTrainedAtXl({
        skills: record.skills,
        xl: 6,
      }),
    ).toEqual([
      { skillId: '7', level: 5 },
      { skillId: '1', level: 3 },
    ])
    expect(
      wasSkillTrainedAtXl({
        skills: record.skills,
        skillId: '1',
        xl: 4,
      }),
    ).toBe(true)
  })

  test('can check whether a skill was trained in an xl window', () => {
    expect(
      wasSkillTrainedInWindow({
        skills: record.skills,
        skillId: '7',
        fromXl: 7,
        toXl: 9,
      }),
    ).toBe(true)
    expect(
      wasSkillTrainedInWindow({
        skills: record.skills,
        skillId: '1',
        fromXl: 7,
        toXl: 9,
      }),
    ).toBe(false)
  })

  test('filters records using version, combo, and god-at-xl constraints', () => {
    expect(
      filterWinTraceRecords({
        records: [record],
        versionMinor: '0.32',
        race: 'Ghoul',
        className: 'Monk',
        godAtXl: 'Ru',
        xl: 10,
      }),
    ).toEqual([record])

    expect(
      filterWinTraceRecords({
        records: [record],
        godAtXl: 'Ru',
        xl: 25,
      }),
    ).toEqual([])
  })
})
