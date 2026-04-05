import path from 'node:path'
import fse from 'fs-extra'
import { WinTraceSourceBuildResult } from './bundles'
import { WinTraceSourceIngestResult } from './pipeline'
import { WinTraceBuildReport, WinTraceRecord, WinTraceSourceReport } from './types'

const incrementCount = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1
}

const toWarningCategory = (warning: string) => {
  return warning.split(':')[0] ?? warning
}

const countCategories = (entries: string[]) => {
  const counts: Record<string, number> = {}

  for (const entry of entries) {
    incrementCount(counts, toWarningCategory(entry))
  }

  return counts
}

const countEntries = (entries: string[]) => {
  const counts: Record<string, number> = {}

  for (const entry of entries) {
    incrementCount(counts, entry)
  }

  return counts
}

const mergeCounts = (target: Record<string, number>, source: Record<string, number>) => {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value
  }

  return target
}

export const buildWinTraceSourceReport = ({
  ingestResult,
  sourceResult,
}: {
  ingestResult: WinTraceSourceIngestResult
  sourceResult: WinTraceSourceBuildResult
}): WinTraceSourceReport => {
  const religionWarnings = ingestResult.wins.flatMap((win) => {
    return ingestResult.religionTraceIndex.get(win.gameId)?.warnings ?? []
  })
  const latestWinEndAt = ingestResult.wins
    .map((win) => win.end)
    .sort((left, right) => right.localeCompare(left))[0]

  return {
    sourceKey: sourceResult.sourceKey,
    server: ingestResult.serverConfig.abbreviation,
    sourceBucket: ingestResult.sourceConfig.sourceBucket,
    winsFound: ingestResult.wins.length,
    milestonesFound: ingestResult.milestones.length,
    recordsBuilt: sourceResult.records.length,
    skippedCount: sourceResult.skipped.length,
    latestWinEndAt: latestWinEndAt ?? null,
    skippedReasonCounts: countEntries(sourceResult.skipped.map((entry) => entry.reason)),
    ingestWarningCounts: countCategories(ingestResult.warnings),
    religionWarningCounts: countCategories(religionWarnings),
  }
}

export const buildWinTraceBuildReport = ({
  revision,
  generatedAt,
  ingestResults,
  sourceResults,
  records,
}: {
  revision: number
  generatedAt: string
  ingestResults: WinTraceSourceIngestResult[]
  sourceResults: WinTraceSourceBuildResult[]
  records: WinTraceRecord[]
}): WinTraceBuildReport => {
  const sourceReports = sourceResults.map((sourceResult) => {
    const ingestResult = ingestResults.find((entry) => {
      return (
        entry.serverConfig.abbreviation === sourceResult.sourceKey.split(':')[0] &&
        entry.sourceConfig.sourceBucket === sourceResult.sourceKey.split(':')[1]
      )
    })

    if (!ingestResult) {
      throw new Error(`Missing ingest result for source ${sourceResult.sourceKey}`)
    }

    return buildWinTraceSourceReport({
      ingestResult,
      sourceResult,
    })
  })

  const totals = {
    sources: sourceReports.length,
    winsFound: sourceReports.reduce((sum, report) => sum + report.winsFound, 0),
    milestonesFound: sourceReports.reduce((sum, report) => sum + report.milestonesFound, 0),
    recordsBuilt: sourceReports.reduce((sum, report) => sum + report.recordsBuilt, 0),
    skippedCount: sourceReports.reduce((sum, report) => sum + report.skippedCount, 0),
  }

  const versions = records.reduce<Record<string, number>>((counts, record) => {
    if (record.versionMinor) {
      incrementCount(counts, record.versionMinor)
    }

    return counts
  }, {})

  return {
    revision,
    generatedAt,
    totals,
    versions,
    skippedReasonCounts: sourceReports.reduce<Record<string, number>>((counts, report) => {
      return mergeCounts(counts, report.skippedReasonCounts)
    }, {}),
    ingestWarningCounts: sourceReports.reduce<Record<string, number>>((counts, report) => {
      return mergeCounts(counts, report.ingestWarningCounts)
    }, {}),
    religionWarningCounts: sourceReports.reduce<Record<string, number>>((counts, report) => {
      return mergeCounts(counts, report.religionWarningCounts)
    }, {}),
    sources: sourceReports,
  }
}

export const writeWinTraceReport = async ({
  report,
  outputDir,
}: {
  report: WinTraceBuildReport
  outputDir: string
}) => {
  const reportPath = path.resolve(outputDir, 'report.json')

  await fse.ensureDir(outputDir)
  await fse.writeJson(reportPath, report, {
    spaces: 2,
  })

  return reportPath
}
