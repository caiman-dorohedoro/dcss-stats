import os from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  buildWinTraceRecordsForSource,
  createWinTraceRecord,
  getLatestVersionMinors,
  limitIngestResultsToLatestWins,
  writeWinTraceBundles,
} from './bundles'
import { WinTraceSourceIngestResult } from './pipeline'
import { getSkillTraceKey } from './skillTrace'

const winningLineRecord = {
  gameId: 'game-1',
  serverAbbreviation: 'CNC',
  sourceBucket: 'git',
  logfilePath: '/meta/crawl-git/logfile',
  player: 'bluepin',
  race: 'Minotaur',
  class: 'Fighter',
  char: 'MiFi',
  start: '20260227123456S',
  end: '20260228022210S',
  fullVersion: '0.35-a0',
  longVersion: '0.35-a0-123-gabcdef',
  versionMinor: '0.35',
  finalGod: 'Gozag',
  piety: 160,
  score: 123456,
  turns: 54321,
  duration: 9876,
}

const morgueSample = `
Some header
Skill XL: |  1  2  3  4  5 |
Fighting  |  3  4  4  5  6 |
Axes      |  4  5  6  7  8 |
`

const ingestResult: WinTraceSourceIngestResult = {
  serverConfig: {
    name: 'Nemelex',
    abbreviation: 'CNC',
    url: 'https://crawl.nemelex.cards',
    baseUrl: 'https://archive.nemelex.cards',
    morgueUrl: 'https://archive.nemelex.cards/morgue',
    isDormant: false,
    sources: [],
  },
  sourceConfig: {
    sourceBucket: 'git',
    logfilePath: '/meta/crawl-git/logfile',
    milestonesPath: '/meta/crawl-git/milestones',
    milestonesPathStatus: 'inferred',
  },
  logfileUrl: 'https://archive.nemelex.cards/meta/crawl-git/logfile',
  logfileDownload: {
    url: 'https://archive.nemelex.cards/meta/crawl-git/logfile',
    status: 200,
    ok: true,
    bytes: 1,
    compression: 'none',
    contentType: 'text/plain',
    text: 'ignored',
  },
  wins: [winningLineRecord],
  milestonesUrl: 'https://archive.nemelex.cards/meta/crawl-git/milestones',
  milestonesDownload: {
    url: 'https://archive.nemelex.cards/meta/crawl-git/milestones',
    status: 200,
    ok: true,
    bytes: 1,
    compression: 'none',
    contentType: 'text/plain',
    text: 'ignored',
  },
  milestones: [],
  religionTraceIndex: new Map([
    [
      'game-1',
      {
        religionTrace: [
          [2, 'Okawaru'],
          [18, null],
          [21, 'Gozag'],
        ] as Array<[number, string | null]>,
        warnings: [],
      },
    ],
  ]),
  warnings: [],
}

const secondWinRecord = {
  ...winningLineRecord,
  gameId: 'game-2',
  player: 'other',
  start: '20260228123456S',
  end: '20260301022210S',
}

describe('createWinTraceRecord', () => {
  test('normalizes raw logfile timestamps into iso strings', () => {
    expect(
      createWinTraceRecord({
        win: winningLineRecord,
        religionTrace: {
          religionTrace: [[2, 'Okawaru']],
          warnings: [],
        },
        skills: {
          '0': [[1, 3]],
        },
      }),
    ).toMatchObject({
      startAt: '2026-03-27T12:34:56.000Z',
      endAt: '2026-03-28T02:22:10.000Z',
    })
  })
})

describe('buildWinTraceRecordsForSource', () => {
  test('combines win records, religion traces, and parsed morgues', async () => {
    const result = await buildWinTraceRecordsForSource({
      ingestResult,
      loadMorgueText: async () => ({
        status: 'downloaded',
        remoteUrl: 'https://example.com/morgue',
        localPath: '/tmp/morgue.txt',
        text: morgueSample,
      }),
    })

    expect(result.records).toHaveLength(1)
    expect(result.records[0]).toMatchObject({
      gameId: 'game-1',
      server: 'CNC',
      finalGod: 'Gozag',
      religionTrace: [
        [2, 'Okawaru'],
        [18, null],
        [21, 'Gozag'],
      ],
    })
    expect(result.records[0]?.skills).toEqual({
      [getSkillTraceKey('Fighting')]: [
        [1, 3],
        [2, 4],
        [4, 5],
        [5, 6],
      ],
      [getSkillTraceKey('Axes')]: [
        [1, 4],
        [2, 5],
        [3, 6],
        [4, 7],
        [5, 8],
      ],
    })
  })

  test('can limit the number of morgues processed per source', async () => {
    const result = await buildWinTraceRecordsForSource({
      ingestResult: {
        ...ingestResult,
        wins: [winningLineRecord, secondWinRecord],
      },
      maxWinsPerSource: 1,
      loadMorgueText: async ({ win }) => ({
        status: 'downloaded',
        remoteUrl: `https://example.com/${win.player}`,
        localPath: '/tmp/morgue.txt',
        text: morgueSample,
      }),
    })

    expect(result.records).toHaveLength(1)
    expect(result.records[0]?.gameId).toBe('game-2')
  })
})

describe('bundle helpers', () => {
  test('can keep only the latest wins across all sources before loading morgues', () => {
    const laterWinRecord = {
      ...secondWinRecord,
      gameId: 'game-3',
      end: '20260305022210S',
    }

    const limited = limitIngestResultsToLatestWins({
      ingestResults: [
        {
          ...ingestResult,
          wins: [winningLineRecord, secondWinRecord],
          religionTraceIndex: new Map([
            ['game-1', { religionTrace: [], warnings: [] }],
            ['game-2', { religionTrace: [], warnings: [] }],
          ]),
        },
        {
          ...ingestResult,
          serverConfig: {
            ...ingestResult.serverConfig,
            abbreviation: 'CXC',
          },
          wins: [laterWinRecord],
          religionTraceIndex: new Map([['game-3', { religionTrace: [], warnings: [] }]]),
        },
      ],
      maxTotalWins: 2,
    })

    expect(limited[0]?.wins.map((win) => win.gameId)).toEqual(['game-2'])
    expect(limited[1]?.wins.map((win) => win.gameId)).toEqual(['game-3'])
  })

  test('keeps the latest version minors in descending order', () => {
    expect(
      getLatestVersionMinors([
        { versionMinor: '0.33' },
        { versionMinor: '0.35' },
        { versionMinor: '0.34' },
        { versionMinor: '0.35' },
      ]),
    ).toEqual(['0.35', '0.34'])
  })

  test('writes brotli-compressed bundle files and a manifest', async () => {
    const outputDir = path.join(os.tmpdir(), 'dcss-stats-wintrace-test')
    const records = [
      createWinTraceRecord({
        win: winningLineRecord,
        religionTrace: {
          religionTrace: [[2, 'Okawaru']],
          warnings: [],
        },
        skills: {
          '0': [[1, 3]],
        },
      }),
    ]

    const written = await writeWinTraceBundles({
      records,
      outputDir,
      revision: 12,
    })

    expect(written.manifest).toEqual({
      revision: 12,
      generatedAt: written.manifest.generatedAt,
      versions: {
        '0.35': 'wins-0.35-r12.json.br',
      },
      counts: {
        '0.35': 1,
      },
    })
    expect(written.bundles[0]?.filePath).toBe(path.resolve(outputDir, 'wins-0.35-r12.json.br'))
    expect(written.manifestPath).toBe(path.resolve(outputDir, 'manifest.json'))
  })
})
