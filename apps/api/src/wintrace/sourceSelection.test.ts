import { describe, expect, test } from 'vitest'
import { filterServerConfigsBySources, isCurrentGitSourceBucket, shouldIncludeSourceBucket } from './sourceSelection'
import { WinTraceServerConfig } from './serverConfigs'

const serverConfigs: WinTraceServerConfig[] = [
  {
    name: 'Nemelex',
    abbreviation: 'CNC',
    url: 'https://crawl.nemelex.cards',
    baseUrl: 'https://archive.nemelex.cards',
    morgueUrl: 'https://archive.nemelex.cards/morgue',
    isDormant: false,
    sources: [
      {
        sourceBucket: '0.29',
        logfilePath: '/meta/crawl-0.29/logfile',
        milestonesPath: '/meta/crawl-0.29/milestones',
        milestonesPathStatus: 'inferred',
      },
      {
        sourceBucket: '0.30',
        logfilePath: '/meta/crawl-0.30/logfile',
        milestonesPath: '/meta/crawl-0.30/milestones',
        milestonesPathStatus: 'inferred',
      },
      {
        sourceBucket: '0.32',
        logfilePath: '/meta/crawl-0.32/logfile',
        milestonesPath: '/meta/crawl-0.32/milestones',
        milestonesPathStatus: 'inferred',
      },
      {
        sourceBucket: 'git',
        logfilePath: '/meta/crawl-git/logfile',
        milestonesPath: '/meta/crawl-git/milestones',
        milestonesPathStatus: 'inferred',
      },
      {
        sourceBucket: 'git-old',
        logfilePath: '/meta/crawl-old/logfile',
        milestonesPath: '/meta/crawl-old/milestones',
        milestonesPathStatus: 'inferred',
      },
    ],
  },
]

describe('source bucket selection', () => {
  test('treats git as the current development source', () => {
    expect(isCurrentGitSourceBucket('git')).toBe(true)
    expect(isCurrentGitSourceBucket('trunk')).toBe(true)
    expect(isCurrentGitSourceBucket('git-old')).toBe(false)
  })

  test('keeps 0.30+ plus git by default', () => {
    expect(
      serverConfigs[0]?.sources
        .filter((sourceConfig) =>
          shouldIncludeSourceBucket({
            sourceBucket: sourceConfig.sourceBucket,
            minSourceVersion: '0.30',
          }),
        )
        .map((sourceConfig) => sourceConfig.sourceBucket),
    ).toEqual(['0.30', '0.32', 'git'])
  })

  test('allows exact source bucket selection', () => {
    expect(
      serverConfigs[0]?.sources
        .filter((sourceConfig) =>
          shouldIncludeSourceBucket({
            sourceBucket: sourceConfig.sourceBucket,
            explicitSourceBuckets: ['0.32', 'git-old'],
          }),
        )
        .map((sourceConfig) => sourceConfig.sourceBucket),
    ).toEqual(['0.32', 'git-old'])
  })

  test('filters server configs down to matching sources only', () => {
    expect(
      filterServerConfigsBySources({
        serverConfigs,
      })[0]?.sources.map((sourceConfig) => sourceConfig.sourceBucket),
    ).toEqual(['0.30', '0.32', 'git'])
  })
})
