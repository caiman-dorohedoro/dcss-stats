import { candidateRepo, offsetRepo } from '../db/repos'
import type { Database } from '../db/openDb'
import type { ServerId, TargetVersion } from '../types'
import { parseXlogLine } from './parseXlogLine'

export type ReadLogfileSliceInput = {
  serverId: ServerId
  version: TargetVersion
  logfileUrl: string
  byteOffset: number
}

export type ReadLogfileSlice = (
  input: ReadLogfileSliceInput,
) => Promise<{
  text: string
  byteOffset?: number
}>

export type SyncInput = {
  serverId: ServerId
  version: TargetVersion
  logfileUrl: string
  readLogfileSlice: ReadLogfileSlice
  now?: () => string
}

export type SyncResult = {
  previousOffset: number
  nextOffset: number
  processedLines: number
  insertedCandidates: number
  rejectedLines: number
  skippedTrailingPartialLine: boolean
}

function getCommittedSlice(text: string) {
  const lastNewlineIndex = text.lastIndexOf('\n')

  if (lastNewlineIndex === -1) {
    return {
      committedText: '',
      lines: [] as string[],
      completeByteLength: 0,
      skippedTrailingPartialLine: text.length > 0,
    }
  }

  const committedText = text.slice(0, lastNewlineIndex + 1)

  return {
    committedText,
    lines: committedText
      .split('\n')
      .slice(0, -1)
      .filter((line) => line.trim().length > 0),
    completeByteLength: Buffer.byteLength(committedText, 'utf8'),
    skippedTrailingPartialLine: lastNewlineIndex !== text.length - 1,
  }
}

export async function syncLogfile(db: Database, input: SyncInput): Promise<SyncResult> {
  const previousOffset =
    offsetRepo.get(db, input.serverId, input.version, input.logfileUrl)?.byteOffset ?? 0
  const slice = await input.readLogfileSlice({
    serverId: input.serverId,
    version: input.version,
    logfileUrl: input.logfileUrl,
    byteOffset: previousOffset,
  })
  const effectiveOffset = slice.byteOffset ?? previousOffset
  const now = input.now?.() ?? new Date().toISOString()
  const { lines, completeByteLength, skippedTrailingPartialLine } = getCommittedSlice(slice.text)
  const countBeforeInsert = candidateRepo.count(db)
  const parsedCandidates = []
  let rejectedLines = 0

  for (const line of lines) {
    try {
      parsedCandidates.push(
        parseXlogLine(line, {
          serverId: input.serverId,
          logfileUrl: input.logfileUrl,
          discoveredAt: now,
        }),
      )
    } catch {
      rejectedLines += 1
    }
  }

  if (parsedCandidates.length > 0) {
    candidateRepo.insertMany(db, parsedCandidates)
  }

  const nextOffset = effectiveOffset + completeByteLength

  if (completeByteLength > 0) {
    offsetRepo.upsert(db, {
      serverId: input.serverId,
      version: input.version,
      logfileUrl: input.logfileUrl,
      byteOffset: nextOffset,
      updatedAt: now,
    })
  }

  return {
    previousOffset,
    nextOffset,
    processedLines: lines.length,
    insertedCandidates: candidateRepo.count(db) - countBeforeInsert,
    rejectedLines,
    skippedTrailingPartialLine,
  }
}
