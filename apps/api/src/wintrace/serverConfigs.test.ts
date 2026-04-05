import { describe, expect, test } from 'vitest'
import {
  getWinTraceServerConfig,
  inferMilestonesPath,
  winTraceServerConfigs,
} from './serverConfigs'

describe('inferMilestonesPath', () => {
  test('infers milestones path for logfile directories', () => {
    expect(inferMilestonesPath('/meta/crawl-git/logfile')).toEqual({
      path: '/meta/crawl-git/milestones',
      status: 'inferred',
    })
    expect(inferMilestonesPath('/crawl/meta/0.34/logfile')).toEqual({
      path: '/crawl/meta/0.34/milestones',
      status: 'inferred',
    })
  })

  test('infers milestones path for flat logfile files', () => {
    expect(inferMilestonesPath('/logfile-git')).toEqual({
      path: '/milestones-git',
      status: 'inferred',
    })
    expect(inferMilestonesPath('/logfile04')).toEqual({
      path: '/milestones04',
      status: 'inferred',
    })
    expect(inferMilestonesPath('/server-xlogs/remote.rhf-logfile-git')).toEqual({
      path: '/server-xlogs/remote.rhf-milestones-git',
      status: 'inferred',
    })
  })

  test('uses explicit mappings for known non-standard formats', () => {
    expect(inferMilestonesPath('/allgames-svn.txt')).toEqual({
      path: '/milestones-svn.txt',
      status: 'explicit',
    })
    expect(inferMilestonesPath('/allgames.txt')).toEqual({
      path: '/milestones.txt',
      status: 'explicit',
    })
    expect(inferMilestonesPath('/dcss-logfiles-trunk')).toEqual({
      path: '/dcss-milestones-trunk',
      status: 'explicit',
    })
  })

  test('returns missing when the pattern is unsupported', () => {
    expect(inferMilestonesPath('/totally-unknown-format')).toEqual({
      path: null,
      status: 'missing',
    })
  })
})

describe('winTraceServerConfigs', () => {
  test('creates normalized server configs from seed data', () => {
    expect(winTraceServerConfigs).toHaveLength(15)
    expect(getWinTraceServerConfig('CDI')).toMatchObject({
      abbreviation: 'CDI',
      baseUrl: 'https://crawl.dcss.io',
      morgueUrl: 'https://crawl.dcss.io/crawl/morgue',
      isDormant: false,
    })
  })

  test('keeps every source bucket from seed data', () => {
    const cao = getWinTraceServerConfig('CAO')

    expect(cao?.sources.map((source) => source.sourceBucket)).toEqual(
      expect.arrayContaining(['0.4', 'git', 'git-old']),
    )
    expect(cao?.sources.find((source) => source.sourceBucket === 'git')).toMatchObject({
      logfilePath: '/logfile-git',
      milestonesPath: '/milestones-git',
    })
  })
})
