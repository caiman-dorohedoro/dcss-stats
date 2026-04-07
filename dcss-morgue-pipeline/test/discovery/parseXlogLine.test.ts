import { describe, expect, it } from 'vitest'
import { isExcludedModeLine, parseXlogLine } from '../../src/discovery/parseXlogLine'

describe('parseXlogLine', () => {
  it('parses xlog key/value pairs with :: escapes and zero-based months', () => {
    const row = parseXlogLine(
      'name=alice:xl=12:start=20260305000102S:v=0.34:end=20260305010203S:tmsg=slain by an orc:: warrior',
      {
        serverId: 'CAO',
        logfileUrl: 'http://crawl.akrasiac.org/logfile34',
        discoveredAt: '2026-04-05T02:00:00.000Z',
      },
    )

    expect(row.playerName).toBe('alice')
    expect(row.endMessage).toBe('slain by an orc: warrior')
    expect(row.xl).toBe(12)
    expect(row.startedAt).toBe('2026-04-05T00:01:02.000Z')
    expect(row.endedAt).toBe('2026-04-05T01:02:03.000Z')
    expect(row.version).toBe('0.34')
  })

  it('matches the legacy parser behavior for zero-based January timestamps', () => {
    const row = parseXlogLine(
      'name=alice:start=20260031063933S:v=0.34-b1:end=20260031064022S:tmsg=ok',
      {
        serverId: 'CAO',
        logfileUrl: 'http://crawl.akrasiac.org/logfile34',
      },
    )

    expect(row.startedAt).toBe('2026-01-31T06:39:33.000Z')
    expect(row.endedAt).toBe('2026-01-31T06:40:22.000Z')
    expect(row.version).toBe('0.34')
  })

  it('leaves xl null when the xlog line does not include it', () => {
    const row = parseXlogLine(
      'name=alice:start=20260305000102S:v=0.34:end=20260305010203S:tmsg=ok',
      {
        serverId: 'CAO',
        logfileUrl: 'http://crawl.akrasiac.org/logfile34',
      },
    )

    expect(row.xl).toBeNull()
  })

  it('detects excluded game modes and rejects those candidates', () => {
    expect(
      isExcludedModeLine(
        'name=alice:start=20260305000102S:v=0.34:end=20260305010203S:tmsg=ok:wizmode=1',
      ),
    ).toBe(true)

    expect(
      isExcludedModeLine(
        'name=alice:start=20260305000102S:v=0.34:end=20260305010203S:tmsg=entered explore mode:ktyp=exploremode',
      ),
    ).toBe(true)

    expect(() =>
      parseXlogLine(
        'name=alice:start=20260305000102S:v=0.34:end=20260305010203S:tmsg=ok:wizmode=1',
        {
          serverId: 'CAO',
          logfileUrl: 'http://crawl.akrasiac.org/logfile34',
        },
      ),
    ).toThrow('Excluded game mode candidate')

    expect(() =>
      parseXlogLine(
        'name=alice:start=20260305000102S:v=0.34:end=20260305010203S:tmsg=entered explore mode:ktyp=exploremode',
        {
          serverId: 'CAO',
          logfileUrl: 'http://crawl.akrasiac.org/logfile34',
        },
      ),
    ).toThrow('Excluded game mode candidate')
  })

  it('rejects unsupported source versions instead of mapping them to trunk', () => {
    expect(() =>
      parseXlogLine('name=alice:start=20260305000102S:v=0.33:end=20260305010203S:tmsg=ok', {
        serverId: 'CAO',
        logfileUrl: 'http://crawl.akrasiac.org/logfile34',
      }),
    ).toThrow('Unsupported source version for CAO: 0.33')
  })
})
