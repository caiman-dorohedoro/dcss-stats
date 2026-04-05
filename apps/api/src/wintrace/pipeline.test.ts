import { describe, expect, test } from 'vitest'
import { WinTraceServerConfig, WinTraceSourceConfig } from './serverConfigs'
import { ingestWinTraceSource } from './pipeline'

const winningLine =
  'name=bluepin:ktyp=winning:start=20260330123456S:end=20260331022210S:v=0.35-a0:vlong=0.35-a0-123-gabcdef:race=Minotaur:cls=Fighter:char=MiFi:xl=27:sc=123456:turn=54321:title=Conqueror:tmsg=escaped with the Orb!:dur=9876:br=Zot:lvl=5:str=23:int=9:dex=15:god=Gozag:piety=160'

const beginLine =
  'v=0.35-a0:vlong=0.35-a0-123-gabcdef:name=bluepin:race=Minotaur:cls=Fighter:char=MiFi:xl=2:god=Okawaru:start=20260330123456S:time=20260330124000S:type=god.worship:milestone=became a worshipper of Okawaru.'

const renounceLine =
  'v=0.35-a0:vlong=0.35-a0-123-gabcdef:name=bluepin:race=Minotaur:cls=Fighter:char=MiFi:xl=18:start=20260330123456S:time=20260330183000S:type=god.renounce:milestone=abandoned Okawaru.'

const switchLine =
  'v=0.35-a0:vlong=0.35-a0-123-gabcdef:name=bluepin:race=Minotaur:cls=Fighter:char=MiFi:xl=21:god=Gozag:start=20260330123456S:time=20260330191500S:type=god.worship:milestone=became a worshipper of Gozag.'

const serverConfig: WinTraceServerConfig = {
  name: 'Nemelex',
  abbreviation: 'CNC',
  url: 'https://crawl.nemelex.cards',
  baseUrl: 'https://archive.nemelex.cards',
  morgueUrl: 'https://archive.nemelex.cards/morgue',
  isDormant: false,
  sources: [],
}

const sourceConfig: WinTraceSourceConfig = {
  sourceBucket: 'git',
  logfilePath: '/meta/crawl-git/logfile',
  milestonesPath: '/meta/crawl-git/milestones',
  milestonesPathStatus: 'inferred',
}

describe('ingestWinTraceSource', () => {
  test('downloads logfile and milestones, then builds a religion trace index', async () => {
    const result = await ingestWinTraceSource({
      serverConfig,
      sourceConfig,
      downloadText: async ({ path }) => {
        if (path === sourceConfig.logfilePath) {
          return {
            url: `https://example.com${path}`,
            status: 200,
            ok: true,
            bytes: winningLine.length,
            compression: 'none',
            contentType: 'text/plain',
            text: winningLine,
          }
        }

        return {
          url: `https://example.com${path}`,
          status: 200,
          ok: true,
          bytes: beginLine.length + renounceLine.length + switchLine.length,
          compression: 'none',
          contentType: 'text/plain',
          text: [beginLine, renounceLine, switchLine].join('\n'),
        }
      },
    })

    expect(result.wins).toHaveLength(1)
    expect(result.milestones).toHaveLength(3)
    expect(result.religionTraceIndex.get(result.wins[0]!.gameId)).toEqual({
      religionTrace: [
        [2, 'Okawaru'],
        [18, null],
        [21, 'Gozag'],
      ],
      warnings: [],
    })
    expect(result.warnings).toEqual([])
  })

  test('records a warning when milestones are not configured for a source', async () => {
    const result = await ingestWinTraceSource({
      serverConfig,
      sourceConfig: {
        ...sourceConfig,
        milestonesPath: null,
        milestonesPathStatus: 'missing',
      },
      downloadText: async () => ({
        url: 'https://example.com/logfile',
        status: 200,
        ok: true,
        bytes: winningLine.length,
        compression: 'none',
        contentType: 'text/plain',
        text: winningLine,
      }),
    })

    expect(result.warnings).toContain('milestones-path-missing:missing')
  })

  test('does not throw when a source download fails', async () => {
    const result = await ingestWinTraceSource({
      serverConfig,
      sourceConfig,
      downloadText: async ({ path }) => {
        if (path === sourceConfig.logfilePath) {
          throw new Error('network down')
        }

        return {
          url: `https://example.com${path}`,
          status: 200,
          ok: true,
          bytes: 0,
          compression: 'none',
          contentType: 'text/plain',
          text: '',
        }
      },
    })

    expect(result.wins).toEqual([])
    expect(result.warnings).toContain(`download-error:${sourceConfig.logfilePath}:Error`)
    expect(result.warnings).toContain('logfile-download-failed:0')
  })
})
