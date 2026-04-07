import { createHash } from 'node:crypto'
import { getBucketForSourceVersion } from '../config/manifest'
import type { CandidateGame, ServerId } from '../types'

const SPLIT_RE = /(?:[^:]|::)+/g

export type ParseXlogContext = {
  serverId: ServerId
  logfileUrl: string
  discoveredAt?: string
}

function parseXlogRecord(line: string): Record<string, string> {
  const chunks = Array.from(line.trim().match(SPLIT_RE) ?? [])

  return Object.fromEntries(
    chunks.flatMap((chunk) => {
      const separatorIndex = chunk.indexOf('=')

      if (separatorIndex <= 0) {
        return []
      }

      return [[chunk.slice(0, separatorIndex), chunk.slice(separatorIndex + 1).replaceAll('::', ':')]]
    }),
  )
}

function isTruthyFlag(value: string | undefined): boolean {
  if (!value) {
    return false
  }

  return ['1', 'true', 'yes', 'on', 'wizard', 'wizmode'].includes(value.trim().toLowerCase())
}

const EXCLUDED_MODE_MARKERS = ['wizard', 'wizmode', 'exploremode'] as const

function hasExcludedModeMarker(value: string | undefined): boolean {
  if (!value) {
    return false
  }

  return EXCLUDED_MODE_MARKERS.includes(
    value.trim().toLowerCase() as (typeof EXCLUDED_MODE_MARKERS)[number],
  )
}

export function isExcludedModeRecord(record: Record<string, string>): boolean {
  if (
    isTruthyFlag(record.wizmode) ||
    isTruthyFlag(record.wizard) ||
    isTruthyFlag(record.debug) ||
    hasExcludedModeMarker(record.type) ||
    hasExcludedModeMarker(record.mode) ||
    hasExcludedModeMarker(record.game_mode) ||
    hasExcludedModeMarker(record.ktyp)
  ) {
    return true
  }

  return ['tmsg', 'vmsg'].some((field) =>
    ['wizard mode', 'explore mode'].some((phrase) =>
      (record[field] ?? '').toLowerCase().includes(phrase),
    ),
  )
}

export function isExcludedModeLine(line: string): boolean {
  return isExcludedModeRecord(parseXlogRecord(line))
}

export function isExcludedModeCandidate(candidate: Pick<CandidateGame, 'rawXlogLine'>): boolean {
  return isExcludedModeLine(candidate.rawXlogLine)
}

function getRequiredField(record: Record<string, string>, key: string): string {
  const value = record[key]

  if (!value) {
    throw new Error(`Missing required xlog field: ${key}`)
  }

  return value
}

function parseOptionalIntegerField(record: Record<string, string>, key: string): number | null {
  const value = record[key]

  if (!value) {
    return null
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid integer xlog field: ${key}=${value}`)
  }

  return parsed
}

export function normalizeXlogTimestamp(value: string): string {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/)

  if (!match) {
    throw new Error(`Invalid xlog timestamp: ${value}`)
  }

  const [, year, zeroBasedMonth, day, hour, minute, second] = match
  const monthIndex = Number(zeroBasedMonth)

  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error(`Invalid xlog timestamp: ${value}`)
  }

  const timestamp = new Date(
    Date.UTC(
      Number(year),
      monthIndex,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  )

  if (
    timestamp.getUTCFullYear() !== Number(year) ||
    timestamp.getUTCMonth() !== monthIndex ||
    timestamp.getUTCDate() !== Number(day) ||
    timestamp.getUTCHours() !== Number(hour) ||
    timestamp.getUTCMinutes() !== Number(minute) ||
    timestamp.getUTCSeconds() !== Number(second)
  ) {
    throw new Error(`Invalid xlog timestamp: ${value}`)
  }

  return timestamp.toISOString()
}

export function parseXlogLine(line: string, ctx: ParseXlogContext): CandidateGame {
  const record = parseXlogRecord(line)

  if (isExcludedModeRecord(record)) {
    throw new Error('Excluded game mode candidate')
  }

  const sourceVersionLabel = getRequiredField(record, 'v')
  const playerName = getRequiredField(record, 'name')
  const xl = parseOptionalIntegerField(record, 'xl')
  const startedAtRaw = getRequiredField(record, 'start')
  const endedAtRaw = getRequiredField(record, 'end')
  const endMessage = getRequiredField(record, 'tmsg')
  const version = getBucketForSourceVersion(ctx.serverId, sourceVersionLabel)
  const startedAt = normalizeXlogTimestamp(startedAtRaw)
  const endedAt = normalizeXlogTimestamp(endedAtRaw)

  return {
    candidateId: createHash('sha1')
      .update(`${ctx.serverId}:${playerName}:${startedAtRaw}:${endedAtRaw}:${sourceVersionLabel}`)
      .digest('hex'),
    serverId: ctx.serverId,
    version,
    sourceVersionLabel,
    playerName,
    xl,
    endMessage,
    startedAt,
    endedAt,
    logfileUrl: ctx.logfileUrl,
    rawXlogLine: line,
    discoveredAt: ctx.discoveredAt ?? new Date().toISOString(),
    sampledBootstrapAt: null,
    sampledIncrementalAt: null,
  }
}
