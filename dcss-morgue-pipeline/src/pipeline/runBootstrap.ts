import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ACTIVE_SERVER_IDS, getServerManifest } from '../config/manifest'
import { candidateRepo, migrate, offsetRepo, parseResultRepo } from '../db/repos'
import type { Database } from '../db/openDb'
import { discoverCandidates as defaultDiscoverCandidates } from '../discovery/discoverCandidates'
import { backfillLogfile, type ReadBackfillSlice, type ReadLogfileSlice } from '../discovery/syncLogfile'
import { fetchMorgue as defaultFetchMorgue } from '../fetch/fetchMorgue'
import { parseMorgue as defaultParseMorgue } from '../parser/parseMorgue'
import { selectBootstrapCandidates } from '../sampling/selectBootstrapCandidates'
import { isExcludedModeCandidate } from '../discovery/parseXlogLine'
import type { CandidateGame, ParseFailureRecord, ParseResultRow, ServerId, TargetVersion } from '../types'

export type PipelineSummary = {
  selectedCandidates: number
  parsedSuccesses: number
  parsedFailures: number
}

export type PipelineOptions = {
  perBucket: number
  since?: string
  minXl?: number
  serverIds?: readonly ServerId[]
  dryRun?: boolean
}

export type PipelineContext = {
  db: Database
  options: PipelineOptions
  paths?: {
    morguesDir?: string
    auditDir?: string
  }
  now?: () => string
  readLogfileSlice?: ReadLogfileSlice
  readBackfillSlice?: ReadBackfillSlice
  discoverCandidates?: () => Promise<unknown>
  fetchMorgue?: typeof defaultFetchMorgue
  parseMorgue?: typeof defaultParseMorgue
  readMorgueText?: (localPath: string) => Promise<string>
  log?: (message: string) => void
}

function getNow(ctx: PipelineContext): string {
  return ctx.now?.() ?? new Date().toISOString()
}

function filterCandidatesByServerIds(
  candidates: CandidateGame[],
  serverIds: readonly ServerId[] | undefined,
): CandidateGame[] {
  if (!serverIds || serverIds.length === 0) {
    return candidates
  }

  const allowed = new Set(serverIds)
  return candidates.filter((candidate) => allowed.has(candidate.serverId))
}

function getBucketKey(candidate: Pick<CandidateGame, 'serverId' | 'version'>): string {
  return `${candidate.serverId}:${candidate.version}`
}

function getBootstrapEligibleCounts(
  db: Database,
  serverIds: readonly ServerId[] | undefined,
  minXl: number | undefined,
): Map<string, number> {
  const counts = new Map<string, number>()

  for (const candidate of filterCandidatesByServerIds(candidateRepo.listBootstrapEligible(db), serverIds)) {
    if (isExcludedModeCandidate(candidate)) {
      continue
    }

    if (minXl !== undefined && (candidate.xl === null || candidate.xl < minXl)) {
      continue
    }

    const bucketKey = getBucketKey(candidate)
    counts.set(bucketKey, (counts.get(bucketKey) ?? 0) + 1)
  }

  return counts
}

async function runBootstrapBackfillPhase(ctx: PipelineContext) {
  if (!ctx.readBackfillSlice) {
    return
  }

  const targetServerIds = ctx.options.serverIds ?? ACTIVE_SERVER_IDS
  const bucketStates = new Map<
    string,
    {
      serverId: ServerId
      version: TargetVersion
      logfileUrl: string
      cursorBeforeByteExclusive: number
    }
  >()

  for (const serverId of targetServerIds) {
    const manifest = getServerManifest(serverId)

    for (const version of manifest.buckets) {
      const offset = offsetRepo.get(ctx.db, serverId, version, manifest.logfiles[version].url)?.byteOffset ?? 0
      bucketStates.set(`${serverId}:${version}`, {
        serverId,
        version,
        logfileUrl: manifest.logfiles[version].url,
        cursorBeforeByteExclusive: offset,
      })
    }
  }

  while (true) {
    const eligibleCounts = getBootstrapEligibleCounts(ctx.db, ctx.options.serverIds, ctx.options.minXl)
    const underfilled = [...bucketStates.values()].filter(
      (bucket) =>
        (eligibleCounts.get(`${bucket.serverId}:${bucket.version}`) ?? 0) < ctx.options.perBucket &&
        bucket.cursorBeforeByteExclusive > 0,
    )

    if (underfilled.length === 0) {
      return
    }

    let madeProgress = false

    for (const bucket of underfilled) {
      const bucketKey = `${bucket.serverId}:${bucket.version}`
      const before = bucket.cursorBeforeByteExclusive
      ctx.log?.(
        `[backfill] ${bucket.serverId}/${bucket.version} eligible=${eligibleCounts.get(bucketKey) ?? 0} target=${ctx.options.perBucket}; reading older logfile chunk before byte ${before}`,
      )

      const result = await backfillLogfile(ctx.db, {
        serverId: bucket.serverId,
        version: bucket.version,
        logfileUrl: bucket.logfileUrl,
        beforeByteExclusive: before,
        readBackfillSlice: ctx.readBackfillSlice,
        now: ctx.now,
      })

      if (!result) {
        bucket.cursorBeforeByteExclusive = 0
        continue
      }

      bucket.cursorBeforeByteExclusive = result.nextBeforeByteExclusive
      ctx.log?.(
        `[backfill] ${bucket.serverId}/${bucket.version} cursor ${result.previousBeforeByteExclusive} -> ${result.nextBeforeByteExclusive}; lines=${result.processedLines}, inserted=${result.insertedCandidates}, rejected=${result.rejectedLines}`,
      )

      if (
        result.nextBeforeByteExclusive < result.previousBeforeByteExclusive ||
        result.insertedCandidates > 0
      ) {
        madeProgress = true
      }
    }

    if (!madeProgress) {
      return
    }
  }
}

export async function runDiscoveryPhase(ctx: PipelineContext) {
  if (ctx.discoverCandidates) {
    await ctx.discoverCandidates()
    return
  }

  if (!ctx.readLogfileSlice) {
    return
  }

  await defaultDiscoverCandidates({
    db: ctx.db,
    readLogfileSlice: ctx.readLogfileSlice,
    now: ctx.now,
    serverIds: ctx.options.serverIds,
    log: ctx.log,
  })
}

export async function executeSelectedCandidates(
  ctx: PipelineContext,
  selectedCandidateIds: string[],
): Promise<PipelineSummary> {
  const fetchMorgue = ctx.fetchMorgue ?? defaultFetchMorgue
  const parseMorgue = ctx.parseMorgue ?? defaultParseMorgue
  const readMorgueText =
    ctx.readMorgueText ?? ((localPath: string) => readFile(localPath, 'utf8'))
  const candidates = candidateRepo
    .listAll(ctx.db)
    .filter((candidate) => selectedCandidateIds.includes(candidate.candidateId))
  const candidateIndex = new Map(
    selectedCandidateIds.map((candidateId, index) => [candidateId, index] as const),
  )
  const orderedCandidates = [...candidates].sort(
    (left, right) =>
      (candidateIndex.get(left.candidateId) ?? Number.MAX_SAFE_INTEGER) -
      (candidateIndex.get(right.candidateId) ?? Number.MAX_SAFE_INTEGER),
  )

  const candidatesByHost = new Map<string, CandidateGame[]>()
  for (const candidate of orderedCandidates) {
    const host = getServerManifest(candidate.serverId).host
    const hostCandidates = candidatesByHost.get(host) ?? []
    hostCandidates.push(candidate)
    candidatesByHost.set(host, hostCandidates)
  }

  async function processCandidate(
    candidate: CandidateGame,
    index: number,
  ): Promise<{ success: boolean }> {
    ctx.log?.(
      `[candidate ${index + 1}/${orderedCandidates.length}] ${candidate.serverId}/${candidate.version} ${candidate.playerName} ended ${candidate.endedAt}`,
    )
    const fetchRow = await fetchMorgue(ctx.db, {
      candidate,
      rootDir: ctx.paths?.morguesDir ?? path.resolve(process.cwd(), 'data/morgues'),
      now: ctx.now,
    })

    if (fetchRow.fetchStatus !== 'success' || !fetchRow.localPath) {
      ctx.log?.(
        `[fetch] failed ${candidate.playerName}: ${fetchRow.lastError ?? fetchRow.fetchStatus} (${fetchRow.morgueUrl})`,
      )
      parseResultRepo.upsertFailure(ctx.db, {
        candidateId: candidate.candidateId,
        failureCode: 'morgue_fetch_failed',
        failureDetail: fetchRow.lastError ?? fetchRow.fetchStatus,
        parsedAt: getNow(ctx),
      })
      return { success: false }
    }

    ctx.log?.(`[fetch] success ${candidate.playerName}: ${fetchRow.morgueUrl}`)

    const text = await readMorgueText(fetchRow.localPath)
    const result = parseMorgue(text, {
      candidateId: candidate.candidateId,
      serverId: candidate.serverId,
      playerName: candidate.playerName,
      sourceVersionLabel: candidate.sourceVersionLabel,
      endedAt: candidate.endedAt,
      morgueUrl: fetchRow.morgueUrl,
    })

    if (result.ok) {
      ctx.log?.(
        `[parse] success ${candidate.playerName}: species=${result.record.species}, ac=${result.record.ac}, ev=${result.record.ev}, sh=${result.record.sh}, spells=${result.record.spells.length}`,
      )
      parseResultRepo.upsertSuccess(ctx.db, {
        candidateId: candidate.candidateId,
        parsedJson: result.record,
        parsedAt: getNow(ctx),
      })
      return { success: true }
    }

    ctx.log?.(
      `[parse] failure ${candidate.playerName}: ${result.failure.reason}${result.failure.detail ? ` (${result.failure.detail})` : ''}`,
    )
    parseResultRepo.upsertFailure(ctx.db, {
      candidateId: candidate.candidateId,
      failureCode: result.failure.reason,
      failureDetail: result.failure.detail,
      parsedAt: getNow(ctx),
    })
    return { success: false }
  }

  const workerResults = await Promise.all(
    [...candidatesByHost.values()].map(async (hostCandidates) => {
      let successes = 0
      let failures = 0

      for (const candidate of hostCandidates) {
        const result = await processCandidate(
          candidate,
          candidateIndex.get(candidate.candidateId) ?? 0,
        )
        if (result.success) {
          successes += 1
        } else {
          failures += 1
        }
      }

      return { successes, failures }
    }),
  )

  const parsedSuccesses = workerResults.reduce((sum, result) => sum + result.successes, 0)
  const parsedFailures = workerResults.reduce((sum, result) => sum + result.failures, 0)

  return {
    selectedCandidates: orderedCandidates.length,
    parsedSuccesses,
    parsedFailures,
  }
}

export function splitParseResults(results: ParseResultRow[]): {
  successes: ParseResultRow[]
  failures: ParseResultRow[]
} {
  return {
    successes: results.filter((result) => result.parseStatus === 'success'),
    failures: results.filter((result) => result.parseStatus === 'failure'),
  }
}

export function toFailureRecord(failure: ParseFailureRecord): ParseFailureRecord {
  return failure
}

export async function runBootstrap(ctx: PipelineContext): Promise<PipelineSummary> {
  migrate(ctx.db)
  await runDiscoveryPhase(ctx)
  await runBootstrapBackfillPhase(ctx)

  const selected = selectBootstrapCandidates(
    filterCandidatesByServerIds(candidateRepo.listBootstrapEligible(ctx.db), ctx.options.serverIds),
    {
      perBucket: ctx.options.perBucket,
      minXl: ctx.options.minXl,
    },
  )
  ctx.log?.(`[bootstrap] selected ${selected.length} candidates`)
  if (ctx.options.dryRun) {
    return {
      selectedCandidates: selected.length,
      parsedSuccesses: 0,
      parsedFailures: 0,
    }
  }

  const sampledAt = getNow(ctx)

  candidateRepo.markBootstrapSampled(
    ctx.db,
    selected.map((candidate) => candidate.candidateId),
    sampledAt,
  )

  return executeSelectedCandidates(
    ctx,
    selected.map((candidate) => candidate.candidateId),
  )
}
