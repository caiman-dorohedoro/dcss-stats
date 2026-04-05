import { ReligionTraceEntry } from './milestones'

export type SerializedSkillTrace = Record<string, Array<[xl: number, level: number]>>

export type WinTraceRecord = {
  gameId: string
  server: string
  sourceBucket: string
  fullVersion: string
  longVersion: string | null
  versionMinor: string | null
  player: string
  race: string
  class: string
  char: string
  startAt: string
  endAt: string
  finalGod: string | null
  religionTrace: ReligionTraceEntry[]
  religionWarnings: string[]
  skills: SerializedSkillTrace
}

export type WinTraceVersionBundle = {
  revision: number
  generatedAt: string
  versionMinor: string
  gameCount: number
  games: WinTraceRecord[]
}

export type WinTraceManifest = {
  revision: number
  generatedAt: string
  versions: Record<string, string>
  counts: Record<string, number>
}

export type WinTraceSourceReport = {
  sourceKey: string
  server: string
  sourceBucket: string
  winsFound: number
  milestonesFound: number
  recordsBuilt: number
  skippedCount: number
  latestWinEndAt: string | null
  skippedReasonCounts: Record<string, number>
  ingestWarningCounts: Record<string, number>
  religionWarningCounts: Record<string, number>
}

export type WinTraceBuildReport = {
  revision: number
  generatedAt: string
  totals: {
    sources: number
    winsFound: number
    milestonesFound: number
    recordsBuilt: number
    skippedCount: number
  }
  versions: Record<string, number>
  skippedReasonCounts: Record<string, number>
  ingestWarningCounts: Record<string, number>
  religionWarningCounts: Record<string, number>
  sources: WinTraceSourceReport[]
}
