import { logger } from '~/utils'
import { DownloadTextFileResult } from './download'
import { buildReligionTrace, MilestoneEntry, ReligionTraceBuildResult } from './milestones'
import { RequestThrottle } from './requestThrottle'
import {
  downloadSourceText,
  groupMilestonesByGameId,
  parseMilestonesText,
  parseWinIndexText,
  resolveSourceUrl,
} from './sourceFiles'
import { WinTraceServerConfig, WinTraceSourceConfig, winTraceServerConfigs } from './serverConfigs'
import { WinIndexEntry } from './winIndex'

export type SourceTextDownloader = typeof downloadSourceText

export type WinTraceSourceIngestResult = {
  serverConfig: WinTraceServerConfig
  sourceConfig: WinTraceSourceConfig
  logfileUrl: string
  logfileDownload: DownloadTextFileResult
  wins: WinIndexEntry[]
  milestonesUrl: string | null
  milestonesDownload: DownloadTextFileResult | null
  milestones: MilestoneEntry[]
  religionTraceIndex: Map<string, ReligionTraceBuildResult>
  warnings: string[]
}

export const ingestWinTraceSource = async ({
  serverConfig,
  sourceConfig,
  timeoutMs = 15_000,
  downloadText = downloadSourceText,
  requestThrottle,
  tailLogfileBytes,
  tailMilestonesBytes,
  targetWins,
}: {
  serverConfig: WinTraceServerConfig
  sourceConfig: WinTraceSourceConfig
  timeoutMs?: number
  downloadText?: SourceTextDownloader
  requestThrottle?: RequestThrottle
  tailLogfileBytes?: number
  tailMilestonesBytes?: number
  targetWins?: number
}): Promise<WinTraceSourceIngestResult> => {
  const warnings: string[] = []
  const safeDownload = async (path: string, tailBytes?: number): Promise<DownloadTextFileResult> => {
    try {
      const runDownload = () =>
        downloadText({
          baseUrl: serverConfig.baseUrl,
          path,
          timeoutMs,
          tailBytes,
        })

      return requestThrottle
        ? await requestThrottle.run(
            {
              key: serverConfig.abbreviation,
            },
            runDownload,
          )
        : await runDownload()
    } catch (error) {
      warnings.push(`download-error:${path}:${error instanceof Error ? error.name : 'unknown'}`)

      return {
        url: resolveSourceUrl(serverConfig.baseUrl, path),
        status: 0,
        ok: false,
        bytes: 0,
        compression: 'none',
        contentType: null,
        text: null,
      }
    }
  }

  logger(
    `wintrace: ingesting source ${serverConfig.abbreviation}:${sourceConfig.sourceBucket}:${sourceConfig.logfilePath}`,
  )

  const [logfileDownload, milestonesDownload] = await Promise.all([
    safeDownload(sourceConfig.logfilePath, tailLogfileBytes),
    sourceConfig.milestonesPath ? safeDownload(sourceConfig.milestonesPath, tailMilestonesBytes) : Promise.resolve(null),
  ])

  const wins =
    logfileDownload.ok && logfileDownload.text
      ? parseWinIndexText({
          serverAbbreviation: serverConfig.abbreviation,
          sourceBucket: sourceConfig.sourceBucket,
          logfilePath: sourceConfig.logfilePath,
          text: logfileDownload.text,
          dropFirstLine: logfileDownload.isPartial,
        })
      : []

  if (targetWins && logfileDownload.isPartial && wins.length < targetWins) {
    warnings.push(`logfile-tail-too-small:${wins.length}<${targetWins}`)
  }

  if (!logfileDownload.ok) {
    warnings.push(`logfile-download-failed:${logfileDownload.status}`)
  }

  if (!sourceConfig.milestonesPath) {
    warnings.push(`milestones-path-missing:${sourceConfig.milestonesPathStatus}`)
  } else if (!milestonesDownload?.ok) {
    warnings.push(`milestones-download-failed:${milestonesDownload?.status ?? 'unknown'}`)
  }

  const milestones =
    milestonesDownload?.ok && milestonesDownload.text
      ? parseMilestonesText({
          serverAbbreviation: serverConfig.abbreviation,
          sourceBucket: sourceConfig.sourceBucket,
          milestonesPath: sourceConfig.milestonesPath,
          text: milestonesDownload.text,
          dropFirstLine: milestonesDownload.isPartial,
        })
      : []

  const milestonesByGameId = groupMilestonesByGameId(milestones)
  const religionTraceIndex = new Map<string, ReligionTraceBuildResult>()

  for (const win of wins) {
    religionTraceIndex.set(
      win.gameId,
      buildReligionTrace({
        milestones: milestonesByGameId.get(win.gameId) ?? [],
        finalGod: win.finalGod,
      }),
    )
  }

  return {
    serverConfig,
    sourceConfig,
    logfileUrl: logfileDownload.url,
    logfileDownload,
    wins,
    milestonesUrl: milestonesDownload?.url ?? null,
    milestonesDownload,
    milestones,
    religionTraceIndex,
    warnings,
  }
}

export const getEnabledWinTraceServerConfigs = ({
  includeDormant = false,
}: {
  includeDormant?: boolean
} = {}) => {
  return includeDormant
    ? winTraceServerConfigs
    : winTraceServerConfigs.filter((serverConfig) => !serverConfig.isDormant)
}

export const ingestWinTraceServers = async ({
  serverConfigs = getEnabledWinTraceServerConfigs(),
  timeoutMs,
  downloadText,
  requestThrottle,
  tailLogfileBytes,
  tailMilestonesBytes,
  targetWins,
}: {
  serverConfigs?: WinTraceServerConfig[]
  timeoutMs?: number
  downloadText?: SourceTextDownloader
  requestThrottle?: RequestThrottle
  tailLogfileBytes?: number
  tailMilestonesBytes?: number
  targetWins?: number
} = {}) => {
  const results: WinTraceSourceIngestResult[] = []

  for (const serverConfig of serverConfigs) {
    for (const sourceConfig of serverConfig.sources) {
      results.push(
        await ingestWinTraceSource({
          serverConfig,
          sourceConfig,
          timeoutMs,
          downloadText,
          requestThrottle,
          tailLogfileBytes,
          tailMilestonesBytes,
          targetWins,
        }),
      )
    }
  }

  return results
}
