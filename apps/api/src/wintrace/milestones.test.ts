import { describe, expect, test } from 'vitest'
import { buildReligionTrace, collapseReligionTrace, parseMilestoneLine } from './milestones'

const notNull = <T>(value: T | null): value is T => value !== null

const beginWithGodLine =
  'v=0.32-a0:vlong=0.32-a0-1468-g753a682cf0:name=ASCIIPhilia:race=Troll:cls=Chaos Knight:char=TrCK:xl=1:god=Xom:start=20240517145234S:time=20240517145234S:type=begin:milestone=began the quest for the Orb.'

const renounceLine =
  'v=0.32-a0:vlong=0.32-a0-1468-g753a682cf0:name=ASCIIPhilia:race=Troll:cls=Chaos Knight:char=TrCK:xl=1:start=20240517145234S:time=20240517145253S:type=god.renounce:milestone=abandoned Xom.'

const worshipLine =
  'v=0.34-b1:vlong=0.34-b1-32-g7b8d8e6ed1:name=Vadalken:race=Deep Elf:cls=Earth Elementalist:char=DEEE:xl=2:god=Fedhas:start=20260101141557S:time=20260101141906S:type=god.worship:milestone=became a worshipper of Fedhas.'

const beginWithoutGodLine =
  'v=0.32.1:vlong=0.32.1-5-gba85492886:name=tunatongue:race=Ghoul:cls=Monk:char=GhMo:xl=1:start=20250303113718S:time=20250303113719S:type=begin:milestone=began the quest for the Orb.'

describe('parseMilestoneLine', () => {
  test('parses milestone lines into canonical milestone entries', () => {
    expect(
      parseMilestoneLine({
        serverAbbreviation: 'CNC',
        sourceBucket: 'git',
        milestonesPath: '/meta/crawl-git/milestones',
        line: beginWithGodLine,
      }),
    ).toMatchObject({
      serverAbbreviation: 'CNC',
      sourceBucket: 'git',
      milestonesPath: '/meta/crawl-git/milestones',
      player: 'ASCIIPhilia',
      start: '20240517145234S',
      time: '20240517145234S',
      xl: 1,
      type: 'begin',
      milestone: 'began the quest for the Orb.',
      god: 'Xom',
      fullVersion: '0.32-a0',
      longVersion: '0.32-a0-1468-g753a682cf0',
      versionMinor: '0.32',
    })
  })

  test('returns null for incomplete milestone rows', () => {
    expect(
      parseMilestoneLine({
        serverAbbreviation: 'CNC',
        sourceBucket: 'git',
        milestonesPath: '/meta/crawl-git/milestones',
        line: 'name=ASCIIPhilia:type=begin',
      }),
    ).toBeNull()
  })
})

describe('buildReligionTrace', () => {
  test('builds a sparse religion trace from state-changing milestones', () => {
    const begin = parseMilestoneLine({
      serverAbbreviation: 'CNC',
      sourceBucket: 'git',
      milestonesPath: '/meta/crawl-git/milestones',
      line: beginWithGodLine,
    })
    const renounce = parseMilestoneLine({
      serverAbbreviation: 'CNC',
      sourceBucket: 'git',
      milestonesPath: '/meta/crawl-git/milestones',
      line: renounceLine,
    })
    const worship = parseMilestoneLine({
      serverAbbreviation: 'CXC',
      sourceBucket: '0.34',
      milestonesPath: '/crawl/meta/0.34/milestones',
      line: worshipLine,
    })

    const milestones = [begin, renounce, worship].filter(notNull)

    expect(
      buildReligionTrace({
        milestones,
        finalGod: 'Fedhas',
      }),
    ).toEqual({
      religionTrace: [
        [1, null],
        [2, 'Fedhas'],
      ],
      warnings: [],
    })
  })

  test('does not warn when a begin milestone has no god', () => {
    const beginWithoutGod = parseMilestoneLine({
      serverAbbreviation: 'CXC',
      sourceBucket: '0.32',
      milestonesPath: '/crawl/meta/0.32/milestones',
      line: beginWithoutGodLine,
    })

    expect(
      buildReligionTrace({
        milestones: [beginWithoutGod].filter(notNull),
        finalGod: null,
      }),
    ).toEqual({
      religionTrace: [],
      warnings: [],
    })
  })

  test('warns when final god does not match the milestone-derived state', () => {
    const begin = parseMilestoneLine({
      serverAbbreviation: 'CNC',
      sourceBucket: 'git',
      milestonesPath: '/meta/crawl-git/milestones',
      line: beginWithGodLine,
    })

    const milestones = [begin].filter(notNull)

    expect(
      buildReligionTrace({
        milestones,
        finalGod: 'Gozag',
      }),
    ).toEqual({
      religionTrace: [[1, 'Xom']],
      warnings: ['final-god-mismatch:Xom->Gozag'],
    })
  })

  test('stays conservative when there are no religion milestones but a final god exists', () => {
    const worship = parseMilestoneLine({
      serverAbbreviation: 'CXC',
      sourceBucket: '0.34',
      milestonesPath: '/crawl/meta/0.34/milestones',
      line: worshipLine.replace(':type=god.worship', ':type=uniq').replace(':god=Fedhas', ''),
    })

    const milestones = [worship].filter(notNull)

    expect(
      buildReligionTrace({
        milestones,
        finalGod: 'Fedhas',
      }),
    ).toEqual({
      religionTrace: [],
      warnings: ['missing-religion-events:Fedhas'],
    })
  })
})

describe('collapseReligionTrace', () => {
  test('keeps only the final state within a single xl', () => {
    expect(
      collapseReligionTrace([
        [9, 'Gozag'],
        [27, null],
        [27, 'Makhleb'],
        [27, null],
        [27, 'Xom'],
        [27, null],
        [27, 'Makhleb'],
      ]),
    ).toEqual([
      [9, 'Gozag'],
      [27, 'Makhleb'],
    ])
  })
})
