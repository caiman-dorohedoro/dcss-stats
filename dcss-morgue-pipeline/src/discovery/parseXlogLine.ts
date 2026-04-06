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

export function isWizardModeRecord(record: Record<string, string>): boolean {
  if (
    isTruthyFlag(record.wizmode) ||
    isTruthyFlag(record.wizard) ||
    isTruthyFlag(record.debug) ||
    ['wizard', 'wizmode'].includes((record.type ?? '').trim().toLowerCase()) ||
    ['wizard', 'wizmode'].includes((record.mode ?? '').trim().toLowerCase()) ||
    ['wizard', 'wizmode'].includes((record.game_mode ?? '').trim().toLowerCase()) ||
    ['wizard', 'wizmode'].includes((record.ktyp ?? '').trim().toLowerCase())
  ) {
    return true
  }

  return ['tmsg', 'vmsg'].some((field) =>
    (record[field] ?? '').toLowerCase().includes('wizard mode'),
  )
}

export function isWizardModeLine(line: string): boolean {
  return isWizardModeRecord(parseXlogRecord(line))
}

export function isWizardModeCandidate(candidate: Pick<CandidateGame, 'rawXlogLine'>): boolean {
  return isWizardModeLine(candidate.rawXlogLine)
}

function getRequiredField(record: Record<string, string>, key: string): string {
  const value = record[key]

  if (!value) {
    throw new Error(`Missing required xlog field: ${key}`)
  }

  return value
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

  if (isWizardModeRecord(record)) {
    throw new Error('Wizard mode candidate excluded')
  }

  const sourceVersionLabel = getRequiredField(record, 'v')
  const playerName = getRequiredField(record, 'name')
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
