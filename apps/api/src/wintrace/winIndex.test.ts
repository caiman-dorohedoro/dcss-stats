import { describe, expect, test } from 'vitest'
import {
  createWinTraceGameId,
  getVersionMinorFromFullVersion,
  parseWinIndexLine,
} from './winIndex'

const winningLine =
  'name=bluepin:ktyp=winning:start=20260330123456S:end=20260331022210S:v=0.35-a0:vlong=0.35-a0-123-gabcdef:race=Minotaur:cls=Fighter:char=MiFi:xl=27:sc=123456:turn=54321:title=Conqueror:tmsg=escaped with the Orb!:dur=9876:br=Zot:lvl=5:str=23:int=9:dex=15:god=Gozag:piety=160'

const losingLine =
  'name=bluepin:ktyp=mon:start=20260330123456S:end=20260331022210S:v=0.35-a0:race=Minotaur:cls=Fighter:char=MiFi:xl=12:sc=1234:turn=1234:title=Fighter:tmsg=slain by an orc:dur=321:br=D:lvl=8:str=18:int=8:dex=10'

describe('createWinTraceGameId', () => {
  test('creates a stable hash from server, player and start', () => {
    expect(
      createWinTraceGameId({
        serverAbbreviation: 'CNC',
        player: 'BluePin',
        start: '20260330123456S',
      }),
    ).toBe(
      createWinTraceGameId({
        serverAbbreviation: 'cnc',
        player: 'bluepin',
        start: '20260330123456S',
      }),
    )
  })
})

describe('getVersionMinorFromFullVersion', () => {
  test('extracts the semantic minor version from prerelease and stable versions', () => {
    expect(getVersionMinorFromFullVersion('0.35-a0')).toBe('0.35')
    expect(getVersionMinorFromFullVersion('0.34')).toBe('0.34')
    expect(getVersionMinorFromFullVersion('0.34-b1-32-g7b8d8e6ed1')).toBe('0.34')
    expect(getVersionMinorFromFullVersion('git')).toBeNull()
  })
})

describe('parseWinIndexLine', () => {
  test('parses a winning line into a win index entry', () => {
    expect(
      parseWinIndexLine({
        serverAbbreviation: 'CNC',
        sourceBucket: 'git',
        logfilePath: '/meta/crawl-git/logfile',
        line: winningLine,
      }),
    ).toMatchObject({
      serverAbbreviation: 'CNC',
      sourceBucket: 'git',
      logfilePath: '/meta/crawl-git/logfile',
      player: 'bluepin',
      race: 'Minotaur',
      class: 'Fighter',
      char: 'MiFi',
      start: '20260330123456S',
      end: '20260331022210S',
      fullVersion: '0.35-a0',
      longVersion: '0.35-a0-123-gabcdef',
      versionMinor: '0.35',
      finalGod: 'Gozag',
      piety: 160,
      score: 123456,
      turns: 54321,
      duration: 9876,
    })
  })

  test('ignores non-winning lines', () => {
    expect(
      parseWinIndexLine({
        serverAbbreviation: 'CNC',
        sourceBucket: 'git',
        logfilePath: '/meta/crawl-git/logfile',
        line: losingLine,
      }),
    ).toBeNull()
  })

  test('ignores invalid lines', () => {
    expect(
      parseWinIndexLine({
        serverAbbreviation: 'CNC',
        sourceBucket: 'git',
        logfilePath: '/meta/crawl-git/logfile',
        line: 'name=missing-fields-only',
      }),
    ).toBeNull()
  })
})
