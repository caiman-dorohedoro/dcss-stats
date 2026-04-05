import os from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { WinTraceSourceBuildResult } from './bundles'
import { WinTraceSourceIngestResult } from './pipeline'
import { buildWinTraceBuildReport, buildWinTraceSourceReport, writeWinTraceReport } from './report'
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
  religionTrace: [[7, 'Ru']],
  religionWarnings: ['missing-god:begin:20250303113719S'],
  skills: {
    '1': [[3, 1]],
  },
}

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
    sourceBucket: '0.32',
    logfilePath: '/meta/crawl-0.32/logfile',
    milestonesPath: '/meta/crawl-0.32/milestones',
    milestonesPathStatus: 'inferred',
  },
  logfileUrl: 'https://archive.nemelex.cards/meta/crawl-0.32/logfile',
  logfileDownload: {
    url: 'https://archive.nemelex.cards/meta/crawl-0.32/logfile',
    status: 200,
    ok: true,
    bytes: 1,
    compression: 'none',
    contentType: 'text/plain',
    text: 'ignored',
  },
  wins: [
    {
      gameId: 'game-1',
      serverAbbreviation: 'CNC',
      sourceBucket: '0.32',
      logfilePath: '/meta/crawl-0.32/logfile',
      player: 'tunatongue',
      race: 'Ghoul',
      class: 'Monk',
      char: 'GhMo',
      start: '20250303113718S',
      end: '20250303135950S',
      fullVersion: '0.32.1',
      longVersion: '0.32.1-5-gba85492886',
      versionMinor: '0.32',
      finalGod: 'Ru',
      piety: 160,
      score: 123456,
      turns: 54321,
      duration: 9876,
    },
  ],
  milestonesUrl: 'https://archive.nemelex.cards/meta/crawl-0.32/milestones',
  milestonesDownload: {
    url: 'https://archive.nemelex.cards/meta/crawl-0.32/milestones',
    status: 200,
    ok: true,
    bytes: 1,
    compression: 'none',
    contentType: 'text/plain',
    text: 'ignored',
  },
  milestones: [
    {
      gameId: 'game-1',
      serverAbbreviation: 'CNC',
      sourceBucket: '0.32',
      milestonesPath: '/meta/crawl-0.32/milestones',
      player: 'tunatongue',
      start: '20250303113718S',
      time: '20250303113719S',
      xl: 1,
      type: 'begin',
      milestone: 'Began as a Ghoul Monk',
      god: null,
      fullVersion: '0.32.1',
      longVersion: '0.32.1-5-gba85492886',
      versionMinor: '0.32',
    },
  ],
  religionTraceIndex: new Map([
    [
      'game-1',
      {
        religionTrace: [[7, 'Ru']] as Array<[number, string | null]>,
        warnings: ['missing-god:begin:20250303113719S'],
      },
    ],
  ]),
  warnings: ['milestones-download-failed:404', 'download-error:/meta/crawl-0.32/logfile:Error'],
}

const sourceResult: WinTraceSourceBuildResult = {
  sourceKey: 'CNC:0.32',
  records: [record],
  skipped: [
    {
      gameId: 'game-2',
      reason: 'morgue:missing',
    },
    {
      gameId: 'game-3',
      reason: 'skill-trace-empty',
    },
  ],
}

describe('report helpers', () => {
  test('summarizes a single source', () => {
    expect(
      buildWinTraceSourceReport({
        ingestResult,
        sourceResult,
      }),
    ).toEqual({
      sourceKey: 'CNC:0.32',
      server: 'CNC',
      sourceBucket: '0.32',
      winsFound: 1,
      milestonesFound: 1,
      recordsBuilt: 1,
      skippedCount: 2,
      latestWinEndAt: '20250303135950S',
      skippedReasonCounts: {
        'morgue:missing': 1,
        'skill-trace-empty': 1,
      },
      ingestWarningCounts: {
        'milestones-download-failed': 1,
        'download-error': 1,
      },
      religionWarningCounts: {
        'missing-god': 1,
      },
    })
  })

  test('builds an aggregate report and can write it to disk', async () => {
    const report = buildWinTraceBuildReport({
      revision: 2,
      generatedAt: '2026-03-31T15:17:41.109Z',
      ingestResults: [ingestResult],
      sourceResults: [sourceResult],
      records: [record],
    })

    expect(report).toMatchObject({
      revision: 2,
      totals: {
        sources: 1,
        winsFound: 1,
        milestonesFound: 1,
        recordsBuilt: 1,
        skippedCount: 2,
      },
      versions: {
        '0.32': 1,
      },
      skippedReasonCounts: {
        'morgue:missing': 1,
        'skill-trace-empty': 1,
      },
      ingestWarningCounts: {
        'milestones-download-failed': 1,
        'download-error': 1,
      },
      religionWarningCounts: {
        'missing-god': 1,
      },
    })

    const outputDir = path.join(os.tmpdir(), 'dcss-stats-wintrace-report-test')
    const reportPath = await writeWinTraceReport({
      report,
      outputDir,
    })

    expect(reportPath).toBe(path.resolve(outputDir, 'report.json'))
  })
})
