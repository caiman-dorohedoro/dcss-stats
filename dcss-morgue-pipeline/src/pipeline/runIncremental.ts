import { candidateRepo, migrate } from '../db/repos'
import { selectIncrementalCandidates } from '../sampling/selectIncrementalCandidates'
import {
  executeSelectedCandidates,
  runDiscoveryPhase,
  type PipelineContext,
  type PipelineSummary,
} from './runBootstrap'

export async function runIncremental(ctx: PipelineContext): Promise<PipelineSummary> {
  migrate(ctx.db)
  await runDiscoveryPhase(ctx)

  const since = ctx.options.since ?? new Date(0).toISOString()
  const selected = selectIncrementalCandidates(
    candidateRepo
      .listIncrementalEligible(ctx.db, since)
      .filter((candidate) =>
        ctx.options.serverIds?.length ? ctx.options.serverIds.includes(candidate.serverId) : true,
      ),
    {
      since,
      perBucket: ctx.options.perBucket,
      minXl: ctx.options.minXl,
    },
  )
  ctx.log?.(`[incremental] selected ${selected.length} candidates since ${since}`)
  if (ctx.options.dryRun) {
    return {
      selectedCandidates: selected.length,
      parsedSuccesses: 0,
      parsedFailures: 0,
    }
  }

  const sampledAt = ctx.now?.() ?? new Date().toISOString()

  candidateRepo.markIncrementalSampled(
    ctx.db,
    selected.map((candidate) => candidate.candidateId),
    sampledAt,
  )

  return executeSelectedCandidates(
    ctx,
    selected.map((candidate) => candidate.candidateId),
  )
}
