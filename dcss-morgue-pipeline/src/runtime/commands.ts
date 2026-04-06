import { writeAuditBundle } from '../audit/writeAuditBundle'
import { migrate, openDb } from '../db/repos'
import { createHttpLogfileReader } from '../discovery/readHttpLogfileSlice'
import { fetchMorgue as defaultFetchMorgue } from '../fetch/fetchMorgue'
import { createPoliteFetch } from '../net/politeFetch'
import { runBootstrap, type PipelineOptions, type PipelineSummary } from '../pipeline/runBootstrap'
import { runIncremental } from '../pipeline/runIncremental'
import type { ServerId } from '../types'
import { ensureRuntimePaths, resetRuntimeDataDir, resolveRuntimePaths } from './paths'

export type RuntimeCommandOptions = {
  dataDir?: string
  serverIds?: readonly ServerId[]
  minDelayMs?: number
  timeoutMs?: number
  fresh?: boolean
}

export type BootstrapCommandOptions = RuntimeCommandOptions &
  Pick<PipelineOptions, 'perBucket'> & {
    dryRun: boolean
  }

export type IncrementalCommandOptions = RuntimeCommandOptions &
  Pick<PipelineOptions, 'perBucket'> & {
    since?: string
    dryRun: boolean
  }

export type AuditCommandOptions = RuntimeCommandOptions & {
  sampleSize: number
}

const DEFAULT_MIN_DELAY_MS = 2000
const DEFAULT_TIMEOUT_MS = 10000

async function withRuntime<T>(
  options: RuntimeCommandOptions,
  run: (input: {
    paths: ReturnType<typeof resolveRuntimePaths>
    politeFetch: ReturnType<typeof createPoliteFetch>
    db: ReturnType<typeof openDb>
  }) => Promise<T>,
): Promise<T> {
  const paths = resolveRuntimePaths(options.dataDir)

  if (options.fresh) {
    await resetRuntimeDataDir(paths)
  }

  await ensureRuntimePaths(paths)

  const politeFetch = createPoliteFetch({
    minDelayMs: options.minDelayMs ?? DEFAULT_MIN_DELAY_MS,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  })
  const db = openDb(paths.dbPath)

  try {
    migrate(db)
    return await run({ paths, politeFetch, db })
  } finally {
    db.close()
  }
}

export async function runBootstrapCommand(
  options: BootstrapCommandOptions,
): Promise<PipelineSummary> {
  return withRuntime(options, async ({ db, paths, politeFetch }) =>
    runBootstrap({
      db,
      options: {
        perBucket: options.perBucket,
        dryRun: options.dryRun,
        serverIds: options.serverIds,
      },
      paths,
      readLogfileSlice: createHttpLogfileReader({
        logfilesDir: paths.logfilesDir,
        fetchImpl: politeFetch,
      }),
      fetchMorgue: (targetDb, input) =>
        defaultFetchMorgue(targetDb, {
          ...input,
          fetchImpl: politeFetch,
        }),
    }),
  )
}

export async function runIncrementalCommand(
  options: IncrementalCommandOptions,
): Promise<PipelineSummary> {
  return withRuntime(options, async ({ db, paths, politeFetch }) =>
    runIncremental({
      db,
      options: {
        perBucket: options.perBucket,
        since: options.since,
        dryRun: options.dryRun,
        serverIds: options.serverIds,
      },
      paths,
      readLogfileSlice: createHttpLogfileReader({
        logfilesDir: paths.logfilesDir,
        fetchImpl: politeFetch,
      }),
      fetchMorgue: (targetDb, input) =>
        defaultFetchMorgue(targetDb, {
          ...input,
          fetchImpl: politeFetch,
        }),
    }),
  )
}

export async function runAuditCommand(options: AuditCommandOptions): Promise<string> {
  return withRuntime(options, async ({ db, paths }) =>
    writeAuditBundle(
      {
        db,
        options: {
          perBucket: 0,
          serverIds: options.serverIds,
        },
        paths,
      },
      { sampleSize: options.sampleSize },
    ),
  )
}
