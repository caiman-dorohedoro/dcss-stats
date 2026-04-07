import { writeAuditBundle } from '../audit/writeAuditBundle'
import { migrate, openDb } from '../db/repos'
import {
  createHttpLogfileBackfillReader,
  createHttpLogfileReader,
} from '../discovery/readHttpLogfileSlice'
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
  initialTailBytes?: number
  fresh?: boolean
  freshLogfiles?: boolean
  verbose?: boolean
}

export type BootstrapCommandOptions = RuntimeCommandOptions &
  Pick<PipelineOptions, 'perBucket' | 'minXl'> & {
    backfillChunkBytes?: number
    dryRun: boolean
  }

export type IncrementalCommandOptions = RuntimeCommandOptions &
  Pick<PipelineOptions, 'perBucket' | 'minXl'> & {
    since?: string
    dryRun: boolean
  }

export type AuditCommandOptions = RuntimeCommandOptions & {
  sampleSize: number
}

const DEFAULT_MIN_DELAY_MS = 2000
const DEFAULT_TIMEOUT_MS = 10000
const DEFAULT_INITIAL_TAIL_BYTES = 1_048_576

async function withRuntime<T>(
  options: RuntimeCommandOptions,
  run: (input: {
    paths: ReturnType<typeof resolveRuntimePaths>
    politeFetch: ReturnType<typeof createPoliteFetch>
    db: ReturnType<typeof openDb>
    log?: (message: string) => void
  }) => Promise<T>,
): Promise<T> {
  const paths = resolveRuntimePaths(options.dataDir)
  const log = options.verbose ? (message: string) => console.error(message) : undefined

  if (options.fresh) {
    await resetRuntimeDataDir(paths, {
      clearLogfiles: options.freshLogfiles,
    })
    log?.(
      options.freshLogfiles
        ? `[runtime] fresh run: cleared database, morgues, audit, and logfile cache in ${paths.dataDir}`
        : `[runtime] fresh run: cleared database, morgues, and audit in ${paths.dataDir}; preserving logfile cache`,
    )
  }

  await ensureRuntimePaths(paths)

  const politeFetch = createPoliteFetch({
    minDelayMs: options.minDelayMs ?? DEFAULT_MIN_DELAY_MS,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  })
  const db = openDb(paths.dbPath)

  try {
    migrate(db)
    return await run({ paths, politeFetch, db, log })
  } finally {
    db.close()
  }
}

export async function runBootstrapCommand(
  options: BootstrapCommandOptions,
): Promise<PipelineSummary> {
  return withRuntime(options, async ({ db, paths, politeFetch, log }) =>
    runBootstrap({
      db,
      options: {
        perBucket: options.perBucket,
        minXl: options.minXl,
        dryRun: options.dryRun,
        serverIds: options.serverIds,
      },
      paths,
      log,
      readLogfileSlice: createHttpLogfileReader({
        logfilesDir: paths.logfilesDir,
        fetchImpl: politeFetch,
        initialTailBytes: options.initialTailBytes ?? DEFAULT_INITIAL_TAIL_BYTES,
        log,
      }),
      readBackfillSlice: createHttpLogfileBackfillReader({
        logfilesDir: paths.logfilesDir,
        fetchImpl: politeFetch,
        backfillChunkBytes:
          options.backfillChunkBytes ??
          options.initialTailBytes ??
          DEFAULT_INITIAL_TAIL_BYTES,
        log,
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
  return withRuntime(options, async ({ db, paths, politeFetch, log }) =>
    runIncremental({
      db,
      options: {
        perBucket: options.perBucket,
        minXl: options.minXl,
        since: options.since,
        dryRun: options.dryRun,
        serverIds: options.serverIds,
      },
      paths,
      log,
      readLogfileSlice: createHttpLogfileReader({
        logfilesDir: paths.logfilesDir,
        fetchImpl: politeFetch,
        initialTailBytes: options.initialTailBytes ?? DEFAULT_INITIAL_TAIL_BYTES,
        log,
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
