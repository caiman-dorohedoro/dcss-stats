import { describe, expect, test } from 'vitest'
import { buildReligionTraceIndex, parseMilestonesText, parseWinIndexText, resolveSourceUrl } from './sourceFiles'

const winningLine =
  'name=bluepin:ktyp=winning:start=20260330123456S:end=20260331022210S:v=0.35-a0:vlong=0.35-a0-123-gabcdef:race=Minotaur:cls=Fighter:char=MiFi:xl=27:sc=123456:turn=54321:title=Conqueror:tmsg=escaped with the Orb!:dur=9876:br=Zot:lvl=5:str=23:int=9:dex=15:god=Gozag:piety=160'

const beginLine =
  'v=0.35-a0:vlong=0.35-a0-123-gabcdef:name=bluepin:race=Minotaur:cls=Fighter:char=MiFi:xl=2:god=Okawaru:start=20260330123456S:time=20260330124000S:type=god.worship:milestone=became a worshipper of Okawaru.'

const renounceLine =
  'v=0.35-a0:vlong=0.35-a0-123-gabcdef:name=bluepin:race=Minotaur:cls=Fighter:char=MiFi:xl=18:start=20260330123456S:time=20260330183000S:type=god.renounce:milestone=abandoned Okawaru.'

const switchLine =
  'v=0.35-a0:vlong=0.35-a0-123-gabcdef:name=bluepin:race=Minotaur:cls=Fighter:char=MiFi:xl=21:god=Gozag:start=20260330123456S:time=20260330191500S:type=god.worship:milestone=became a worshipper of Gozag.'

describe('resolveSourceUrl', () => {
  test('joins relative paths against the server base url', () => {
    expect(resolveSourceUrl('https://crawl.dcss.io', '/crawl/meta/crawl-git/logfile')).toBe(
      'https://crawl.dcss.io/crawl/meta/crawl-git/logfile',
    )
  })

  test('keeps absolute urls untouched', () => {
    expect(resolveSourceUrl('https://crawl.dcss.io', 'https://example.com/logfile')).toBe(
      'https://example.com/logfile',
    )
  })
})

describe('text parsers', () => {
  test('parses win index text into winning entries only', () => {
    expect(
      parseWinIndexText({
        serverAbbreviation: 'CNC',
        sourceBucket: 'git',
        logfilePath: '/meta/crawl-git/logfile',
        text: [winningLine, 'name=loser:ktyp=mon'].join('\n'),
      }),
    ).toHaveLength(1)
  })

  test('can drop the first partial line for tail-fetched logfile text', () => {
    expect(
      parseWinIndexText({
        serverAbbreviation: 'CNC',
        sourceBucket: 'git',
        logfilePath: '/meta/crawl-git/logfile',
        text: ['partial gibberish', winningLine].join('\n'),
        dropFirstLine: true,
      }),
    ).toHaveLength(1)
  })

  test('parses milestones text into milestone entries', () => {
    expect(
      parseMilestonesText({
        serverAbbreviation: 'CNC',
        sourceBucket: 'git',
        milestonesPath: '/meta/crawl-git/milestones',
        text: [beginLine, renounceLine, switchLine].join('\n'),
      }),
    ).toHaveLength(3)
  })

  test('can drop the first partial line for tail-fetched milestones text', () => {
    expect(
      parseMilestonesText({
        serverAbbreviation: 'CNC',
        sourceBucket: 'git',
        milestonesPath: '/meta/crawl-git/milestones',
        text: ['partial gibberish', beginLine, renounceLine].join('\n'),
        dropFirstLine: true,
      }),
    ).toHaveLength(2)
  })
})

describe('buildReligionTraceIndex', () => {
  test('combines win index entries with milestone-derived religion traces', () => {
    const wins = parseWinIndexText({
      serverAbbreviation: 'CNC',
      sourceBucket: 'git',
      logfilePath: '/meta/crawl-git/logfile',
      text: winningLine,
    })
    const milestones = parseMilestonesText({
      serverAbbreviation: 'CNC',
      sourceBucket: 'git',
      milestonesPath: '/meta/crawl-git/milestones',
      text: [beginLine, renounceLine, switchLine].join('\n'),
    })

    expect(buildReligionTraceIndex({ wins, milestones }).get(wins[0]!.gameId)).toEqual({
      religionTrace: [
        [2, 'Okawaru'],
        [18, null],
        [21, 'Gozag'],
      ],
      warnings: [],
    })
  })
})
