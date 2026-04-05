import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import { describe, expect, test } from 'vitest'
import {
  fetchWinTraceMorgueText,
  getWinTraceMorgueFileName,
  getWinTraceMorgueLocalPath,
  getWinTraceMorgueRemoteUrl,
} from './morgues'
import { WinTraceServerConfig, WinTraceSourceConfig } from './serverConfigs'
import { WinIndexEntry } from './winIndex'

const serverConfig: WinTraceServerConfig = {
  name: 'Develz',
  abbreviation: 'CDO',
  url: 'https://crawl.develz.org',
  baseUrl: 'https://crawl.develz.org',
  morgueUrl: 'https://crawl.develz.org/morgues',
  isDormant: false,
  sources: [],
}

const sourceConfig: WinTraceSourceConfig = {
  sourceBucket: 'git',
  logfilePath: '/allgames-svn.txt',
  milestonesPath: '/milestones-svn.txt',
  milestonesPathStatus: 'explicit',
  morgueUrlPrefix: '/trunk',
}

const win: WinIndexEntry = {
  gameId: 'game-1',
  serverAbbreviation: 'CDO',
  sourceBucket: 'git',
  logfilePath: '/allgames-svn.txt',
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

describe('morgue helpers', () => {
  test('formats the raw logfile timestamp into a morgue file name', () => {
    expect(getWinTraceMorgueFileName(win)).toBe('morgue-bluepin-20260328-022210.txt')
  })

  test('builds a remote url using the per-source morgue prefix', () => {
    expect(
      getWinTraceMorgueRemoteUrl({
        serverConfig,
        sourceConfig,
        win,
      }),
    ).toBe('https://crawl.develz.org/morgues/trunk/bluepin/morgue-bluepin-20260328-022210.txt')
  })

  test('builds a deterministic local cache path', () => {
    expect(
      getWinTraceMorgueLocalPath({
        serverConfig,
        sourceConfig,
        win,
        cacheDir: '/tmp/wintrace-cache',
      }),
    ).toBe(
      path.resolve(
        '/tmp/wintrace-cache',
        'morgues',
        'CDO',
        'git',
        'bluepin',
        'morgue-bluepin-20260328-022210.txt',
      ),
    )
  })

  test('skips network fetch when a cached morgue already exists', async () => {
    const cacheDir = path.join(os.tmpdir(), 'dcss-stats-wintrace-morgue-cache')
    const localPath = getWinTraceMorgueLocalPath({
      serverConfig,
      sourceConfig,
      win,
      cacheDir,
    })

    await fse.ensureDir(path.dirname(localPath))
    await fse.writeFile(localPath, 'cached morgue')

    let called = false

    const result = await fetchWinTraceMorgueText({
      serverConfig,
      sourceConfig,
      win,
      cacheDir,
      downloadText: async () => {
        called = true
        return {
          url: 'https://example.com/morgue',
          status: 200,
          ok: true,
          bytes: 0,
          compression: 'none',
          contentType: 'text/plain',
          text: 'network morgue',
        }
      },
    })

    expect(called).toBe(false)
    expect(result).toMatchObject({
      status: 'cached',
      text: 'cached morgue',
    })
  })
})
