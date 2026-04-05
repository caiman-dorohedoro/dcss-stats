import path from 'node:path'
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib'
import fse from 'fs-extra'
import PQueue from 'p-queue'
import { logger } from '~/utils'
import { fetchWinTraceMorgueText } from './morgues'
import { WinTraceSourceIngestResult } from './pipeline'
import { RequestThrottle } from './requestThrottle'
import { buildWinTraceBuildReport, writeWinTraceReport } from './report'
import { parseSerializedSkillTrace } from './skillTrace'
import { toIsoTimestampFromLogfile } from './timestamps'
import { SerializedSkillTrace, WinTraceManifest, WinTraceRecord, WinTraceVersionBundle } from './types'
import { WinIndexEntry } from './winIndex'

export type WinTraceSkippedGame = {
  gameId: string
  reason: string
}

export type WinTraceSourceBuildResult = {
  sourceKey: string
  records: WinTraceRecord[]
  skipped: WinTraceSkippedGame[]
}

export type MorgueTextLoader = typeof fetchWinTraceMorgueText

type SelectedWin = {
  sourceKey: string
  gameId: string
  end: string
}

const buildDefaultReligionWarnings = (win: Pick<WinIndexEntry, 'finalGod'>) => {
  return win.finalGod ? [`missing-religion-trace:${win.finalGod}`] : []
}

export const createWinTraceRecord = ({
  win,
  religionTrace,
  skills,
}: {
  win: WinIndexEntry
  religionTrace: {
    religionTrace: WinTraceRecord['religionTrace']
    warnings: string[]
  }
  skills: SerializedSkillTrace
}): WinTraceRecord => {
  return {
    gameId: win.gameId,
    server: win.serverAbbreviation,
    sourceBucket: win.sourceBucket,
    fullVersion: win.fullVersion,
    longVersion: win.longVersion,
    versionMinor: win.versionMinor,
    player: win.player,
    race: win.race,
    class: win.class,
    char: win.char,
    startAt: toIsoTimestampFromLogfile(win.start),
    endAt: toIsoTimestampFromLogfile(win.end),
    finalGod: win.finalGod,
    religionTrace: religionTrace.religionTrace,
    religionWarnings: religionTrace.warnings,
    skills,
  }
}

export const buildWinTraceRecordsForSource = async ({
  ingestResult,
  cacheDir,
  timeoutMs = 5_000,
  concurrency = 6,
  loadMorgueText = fetchWinTraceMorgueText,
  requestThrottle,
  maxWinsPerSource,
}: {
  ingestResult: WinTraceSourceIngestResult
  cacheDir?: string
  timeoutMs?: number
  concurrency?: number
  loadMorgueText?: MorgueTextLoader
  requestThrottle?: RequestThrottle
  maxWinsPerSource?: number
}): Promise<WinTraceSourceBuildResult> => {
  const records: WinTraceRecord[] = []
  const skipped: WinTraceSkippedGame[] = []
  const queue = new PQueue({
    concurrency,
  })
  const winsToProcess =
    maxWinsPerSource && maxWinsPerSource > 0
      ? ingestResult.wins.slice(-maxWinsPerSource)
      : ingestResult.wins

  if (winsToProcess.length === 0) {
    return {
      sourceKey: `${ingestResult.serverConfig.abbreviation}:${ingestResult.sourceConfig.sourceBucket}`,
      records,
      skipped,
    }
  }

  const sourceLabel = `${ingestResult.serverConfig.abbreviation}:${ingestResult.sourceConfig.sourceBucket}`

  if (winsToProcess.length !== ingestResult.wins.length) {
    logger(`wintrace: source ${sourceLabel} limiting morgues to ${winsToProcess.length}/${ingestResult.wins.length}`)
  } else {
    logger(`wintrace: source ${sourceLabel} processing ${winsToProcess.length} morgues`)
  }

  const tasks = winsToProcess.map((win, index) =>
    queue.add(async () => {
      const religionTrace =
        ingestResult.religionTraceIndex.get(win.gameId) ?? {
          religionTrace: [],
          warnings: buildDefaultReligionWarnings(win),
        }

      const morgue = await loadMorgueText({
        serverConfig: ingestResult.serverConfig,
        sourceConfig: ingestResult.sourceConfig,
        win,
        cacheDir,
        timeoutMs,
        requestThrottle,
        progress: {
          current: index + 1,
          total: winsToProcess.length,
        },
      })

      if (!morgue.text) {
        skipped.push({
          gameId: win.gameId,
          reason: `morgue:${morgue.status}`,
        })
        return
      }

      const skills = parseSerializedSkillTrace(morgue.text)

      if (Object.keys(skills).length === 0) {
        skipped.push({
          gameId: win.gameId,
          reason: 'skill-trace-empty',
        })
        return
      }

      records.push(
        createWinTraceRecord({
          win,
          religionTrace,
          skills,
        }),
      )
    }),
  )

  await Promise.all(tasks)

  records.sort((left, right) => left.endAt.localeCompare(right.endAt))
  skipped.sort((left, right) => left.gameId.localeCompare(right.gameId))

  return {
    sourceKey: sourceLabel,
    records,
    skipped,
  }
}

export const limitIngestResultsToLatestWins = ({
  ingestResults,
  maxTotalWins,
}: {
  ingestResults: WinTraceSourceIngestResult[]
  maxTotalWins?: number
}) => {
  if (!maxTotalWins || maxTotalWins <= 0) {
    return ingestResults
  }

  const selectedWins = ingestResults
    .flatMap<SelectedWin>((ingestResult) =>
      ingestResult.wins.map((win) => ({
        sourceKey: `${ingestResult.serverConfig.abbreviation}:${ingestResult.sourceConfig.sourceBucket}`,
        gameId: win.gameId,
        end: win.end,
      })),
    )
    .sort((left, right) => right.end.localeCompare(left.end))
    .slice(0, maxTotalWins)

  const selectedGameIdsBySource = selectedWins.reduce<Map<string, Set<string>>>((map, selected) => {
    const existing = map.get(selected.sourceKey) ?? new Set<string>()
    existing.add(selected.gameId)
    map.set(selected.sourceKey, existing)
    return map
  }, new Map())

  return ingestResults.map((ingestResult) => {
    const sourceKey = `${ingestResult.serverConfig.abbreviation}:${ingestResult.sourceConfig.sourceBucket}`
    const selectedGameIds = selectedGameIdsBySource.get(sourceKey)

    if (!selectedGameIds) {
      return {
        ...ingestResult,
        wins: [],
        religionTraceIndex: new Map(),
      }
    }

    const wins = ingestResult.wins.filter((win) => selectedGameIds.has(win.gameId))
    const religionTraceIndex = new Map(
      wins.flatMap((win) => {
        const religionTrace = ingestResult.religionTraceIndex.get(win.gameId)

        return religionTrace ? [[win.gameId, religionTrace] as const] : []
      }),
    )

    return {
      ...ingestResult,
      wins,
      religionTraceIndex,
    }
  })
}

const compareVersionMinorDesc = (left: string, right: string) => {
  const [leftMajor, leftMinor] = left.split('.').map(Number)
  const [rightMajor, rightMinor] = right.split('.').map(Number)

  return rightMajor - leftMajor || rightMinor - leftMinor
}

export const getLatestVersionMinors = (records: Pick<WinTraceRecord, 'versionMinor'>[], count = 2) => {
  return [...new Set(records.map((record) => record.versionMinor).filter((value): value is string => !!value))]
    .sort(compareVersionMinorDesc)
    .slice(0, count)
}

export const groupWinTraceRecordsByVersionMinor = (records: WinTraceRecord[]) => {
  const grouped = new Map<string, WinTraceRecord[]>()

  for (const record of records) {
    if (!record.versionMinor) {
      continue
    }

    const current = grouped.get(record.versionMinor)

    if (current) {
      current.push(record)
    } else {
      grouped.set(record.versionMinor, [record])
    }
  }

  return grouped
}

export const buildWinTraceManifest = ({
  bundles,
  revision,
  generatedAt,
}: {
  bundles: Array<{
    versionMinor: string
    fileName: string
    gameCount: number
  }>
  revision: number
  generatedAt: string
}): WinTraceManifest => {
  return {
    revision,
    generatedAt,
    versions: Object.fromEntries(bundles.map((bundle) => [bundle.versionMinor, bundle.fileName])),
    counts: Object.fromEntries(bundles.map((bundle) => [bundle.versionMinor, bundle.gameCount])),
  }
}

export const writeWinTraceBundles = async ({
  records,
  outputDir = path.resolve(process.cwd(), 'wintrace-dist'),
  revision,
  latestCount = 2,
}: {
  records: WinTraceRecord[]
  outputDir?: string
  revision: number
  latestCount?: number
}) => {
  const generatedAt = new Date().toISOString()
  const grouped = groupWinTraceRecordsByVersionMinor(records)
  const versionMinors = getLatestVersionMinors(records, latestCount)

  await fse.ensureDir(outputDir)

  const writtenBundles: Array<{
    versionMinor: string
    fileName: string
    filePath: string
    gameCount: number
  }> = []

  for (const versionMinor of versionMinors) {
    const versionRecords = (grouped.get(versionMinor) ?? []).slice().sort((left, right) => {
      return left.endAt.localeCompare(right.endAt)
    })
    const fileName = `wins-${versionMinor}-r${revision}.json.br`
    const filePath = path.resolve(outputDir, fileName)
    const bundle: WinTraceVersionBundle = {
      revision,
      generatedAt,
      versionMinor,
      gameCount: versionRecords.length,
      games: versionRecords,
    }

    const compressed = brotliCompressSync(Buffer.from(JSON.stringify(bundle)), {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
      },
    })

    await fse.writeFile(filePath, compressed)

    writtenBundles.push({
      versionMinor,
      fileName,
      filePath,
      gameCount: versionRecords.length,
    })
  }

  const manifest = buildWinTraceManifest({
    bundles: writtenBundles,
    revision,
    generatedAt,
  })
  const manifestPath = path.resolve(outputDir, 'manifest.json')

  await fse.writeJson(manifestPath, manifest, {
    spaces: 2,
  })

  return {
    outputDir,
    generatedAt,
    manifestPath,
    manifest,
    bundles: writtenBundles,
  }
}

export const buildWinTraceBundles = async ({
  ingestResults,
  revision,
  outputDir,
  cacheDir,
  latestCount = 2,
  timeoutMs,
  concurrency,
  loadMorgueText,
  requestThrottle,
  maxWinsPerSource,
  maxTotalWins,
}: {
  ingestResults: WinTraceSourceIngestResult[]
  revision: number
  outputDir?: string
  cacheDir?: string
  latestCount?: number
  timeoutMs?: number
  concurrency?: number
  loadMorgueText?: MorgueTextLoader
  requestThrottle?: RequestThrottle
  maxWinsPerSource?: number
  maxTotalWins?: number
}) => {
  const selectedIngestResults = limitIngestResultsToLatestWins({
    ingestResults,
    maxTotalWins,
  })
  const sourceResults: WinTraceSourceBuildResult[] = []

  if (maxTotalWins && maxTotalWins > 0) {
    const totalWins = ingestResults.reduce((sum, result) => sum + result.wins.length, 0)
    const selectedWins = selectedIngestResults.reduce((sum, result) => sum + result.wins.length, 0)

    if (selectedWins !== totalWins) {
      logger(`wintrace: limiting total morgues to ${selectedWins}/${totalWins}`)
    }
  }

  for (const ingestResult of selectedIngestResults) {
    sourceResults.push(
      await buildWinTraceRecordsForSource({
        ingestResult,
        cacheDir,
        timeoutMs,
        concurrency,
        loadMorgueText,
        requestThrottle,
        maxWinsPerSource,
      }),
    )
  }

  const records = sourceResults.flatMap((result) => result.records)
  const skipped = sourceResults.flatMap((result) => result.skipped)
  const written = await writeWinTraceBundles({
    records,
    outputDir,
    revision,
    latestCount,
  })
  const report = buildWinTraceBuildReport({
    revision,
    generatedAt: written.generatedAt,
    ingestResults,
    sourceResults,
    records,
  })
  const reportPath = await writeWinTraceReport({
    report,
    outputDir: written.outputDir,
  })

  return {
    records,
    skipped,
    sourceResults,
    report,
    reportPath,
    ...written,
  }
}
