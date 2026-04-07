import { pathToFileURL } from 'node:url'
import { ACTIVE_SERVER_IDS, type ServerId } from './types'
import {
  runAuditCommand as defaultRunAuditCommand,
  runBootstrapCommand as defaultRunBootstrapCommand,
  runIncrementalCommand as defaultRunIncrementalCommand,
  type AuditCommandOptions,
  type BootstrapCommandOptions,
  type IncrementalCommandOptions,
} from './runtime/commands'

export type CliResult = {
  exitCode: number
  stdout: string
}

export type CliDependencies = {
  runBootstrapCommand?: (options: BootstrapCommandOptions) => Promise<{
    selectedCandidates: number
    parsedSuccesses: number
    parsedFailures: number
  }>
  runIncrementalCommand?: (options: IncrementalCommandOptions) => Promise<{
    selectedCandidates: number
    parsedSuccesses: number
    parsedFailures: number
  }>
  runAuditCommand?: (options: AuditCommandOptions) => Promise<string>
}

const USAGE = `Usage: dcss-morgue <command> [options]
Commands:
  bootstrap
  incremental
  audit`

const BOOTSTRAP_USAGE = `Usage: dcss-morgue bootstrap [options]
Options:
  --per-bucket <n>     Candidates per (server, version) bucket. Default: 10
  --min-xl <n>         Only sample candidates with xlog XL >= n
  --server <ids>       Comma-separated server ids. Default: all active servers
  --data-dir <path>    Override runtime data directory
  --fresh              Clear DB, morgues, and audit before running, but keep logfile cache
  --fresh-logfiles     Also clear cached logfile slices. Implies --fresh
  --initial-tail-bytes <n>  Tail bytes to read when a logfile bucket is first seen. Default: 1048576
  --backfill-chunk-bytes <n>  Older logfile bytes to fetch per backfill step. Default: initial-tail-bytes
  --dry-run            Discover and sample, but skip morgue fetch/parse
  --verbose            Print discovery, fetch, and parse progress logs
  --min-delay-ms <n>   Minimum delay per host. Default: 2000
  --timeout-ms <n>     HTTP timeout in milliseconds. Default: 10000`

const INCREMENTAL_USAGE = `Usage: dcss-morgue incremental [options]
Options:
  --per-bucket <n>     Candidates per (server, version) bucket. Default: 10
  --min-xl <n>         Only sample candidates with xlog XL >= n
  --since <iso8601>    Lower bound for discovered_at. Default: now minus 6 hours
  --server <ids>       Comma-separated server ids. Default: all active servers
  --data-dir <path>    Override runtime data directory
  --fresh              Clear DB, morgues, and audit before running, but keep logfile cache
  --fresh-logfiles     Also clear cached logfile slices. Implies --fresh
  --initial-tail-bytes <n>  Tail bytes to read when a logfile bucket is first seen. Default: 1048576
  --dry-run            Discover and sample, but skip morgue fetch/parse
  --verbose            Print discovery, fetch, and parse progress logs
  --min-delay-ms <n>   Minimum delay per host. Default: 2000
  --timeout-ms <n>     HTTP timeout in milliseconds. Default: 10000`

const AUDIT_USAGE = `Usage: dcss-morgue audit [options]
Options:
  --sample-size <n>    Number of audit rows to write. Default: 20
  --data-dir <path>    Override runtime data directory`

function getDefaultSinceIso(now = new Date()): string {
  return new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()
}

function parseIntegerOption(flag: string, value: string | undefined): number {
  if (!value) {
    throw new Error(`Missing value for ${flag}`)
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer for ${flag}`)
  }

  return parsed
}

function parseStringOption(flag: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}`)
  }

  return value
}

function parseServerIds(value: string | undefined): ServerId[] {
  if (!value) {
    throw new Error('Missing value for --server')
  }

  const requested = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  if (requested.length === 0) {
    throw new Error('Expected at least one server id for --server')
  }

  const invalid = requested.filter(
    (candidate): candidate is string => !ACTIVE_SERVER_IDS.includes(candidate as ServerId),
  )

  if (invalid.length > 0) {
    throw new Error(`Unknown server id(s): ${invalid.join(', ')}`)
  }

  return requested as ServerId[]
}

function parseIsoTimestamp(flag: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}`)
  }

  const timestamp = new Date(value)

  if (Number.isNaN(timestamp.valueOf())) {
    throw new Error(`Invalid ISO-8601 timestamp for ${flag}`)
  }

  return timestamp.toISOString()
}

function formatPipelineSummary(
  label: 'Bootstrap' | 'Incremental',
  summary: {
    selectedCandidates: number
    parsedSuccesses: number
    parsedFailures: number
  },
  dryRun: boolean,
): string {
  const lines = [
    `${label} completed.`,
    `Selected candidates: ${summary.selectedCandidates}`,
  ]

  if (dryRun) {
    lines.push('Dry run enabled: skipped morgue fetch and parse.')
    return lines.join('\n')
  }

  lines.push(`Parsed successes: ${summary.parsedSuccesses}`)
  lines.push(`Parsed failures: ${summary.parsedFailures}`)
  return lines.join('\n')
}

function parseCommonOptionBag(args: string[]): {
  parsed: {
    dataDir?: string
    dryRun: boolean
    fresh: boolean
    freshLogfiles: boolean
    minDelayMs?: number
    timeoutMs?: number
    initialTailBytes?: number
    serverIds?: ServerId[]
    verbose: boolean
  }
  rest: string[]
} {
  const parsed: {
    dataDir?: string
    dryRun: boolean
    fresh: boolean
    freshLogfiles: boolean
    minDelayMs?: number
    timeoutMs?: number
    initialTailBytes?: number
    serverIds?: ServerId[]
    verbose: boolean
  } = {
    dryRun: false,
    fresh: false,
    freshLogfiles: false,
    verbose: false,
  }
  const rest: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index]

    if (current === '--data-dir') {
      parsed.dataDir = parseStringOption(current, args[index + 1])
      index += 1
      continue
    }

    if (current === '--server') {
      parsed.serverIds = parseServerIds(args[index + 1])
      index += 1
      continue
    }

    if (current === '--dry-run') {
      parsed.dryRun = true
      continue
    }

    if (current === '--fresh') {
      parsed.fresh = true
      continue
    }

    if (current === '--fresh-logfiles') {
      parsed.fresh = true
      parsed.freshLogfiles = true
      continue
    }

    if (current === '--min-delay-ms') {
      parsed.minDelayMs = parseIntegerOption(current, args[index + 1])
      index += 1
      continue
    }

    if (current === '--timeout-ms') {
      parsed.timeoutMs = parseIntegerOption(current, args[index + 1])
      index += 1
      continue
    }

    if (current === '--initial-tail-bytes') {
      parsed.initialTailBytes = parseIntegerOption(current, args[index + 1])
      index += 1
      continue
    }

    if (current === '--verbose') {
      parsed.verbose = true
      continue
    }

    rest.push(current)
  }

  return { parsed, rest }
}

function parseBootstrapOptions(args: string[]): BootstrapCommandOptions {
  const common = parseCommonOptionBag(args)
  let perBucket = 10
  let minXl: number | undefined
  let backfillChunkBytes: number | undefined

  for (let index = 0; index < common.rest.length; index += 1) {
    const current = common.rest[index]

    if (current === '--per-bucket') {
      perBucket = parseIntegerOption(current, common.rest[index + 1])
      index += 1
      continue
    }

    if (current === '--min-xl') {
      minXl = parseIntegerOption(current, common.rest[index + 1])
      index += 1
      continue
    }

    if (current === '--backfill-chunk-bytes') {
      backfillChunkBytes = parseIntegerOption(current, common.rest[index + 1])
      index += 1
      continue
    }

    throw new Error(`Unknown bootstrap option: ${current}`)
  }

  return {
    perBucket,
    minXl,
    dataDir: common.parsed.dataDir,
    dryRun: common.parsed.dryRun,
    fresh: common.parsed.fresh,
    freshLogfiles: common.parsed.freshLogfiles,
    minDelayMs: common.parsed.minDelayMs,
    timeoutMs: common.parsed.timeoutMs,
    initialTailBytes: common.parsed.initialTailBytes,
    backfillChunkBytes,
    serverIds: common.parsed.serverIds,
    verbose: common.parsed.verbose,
  }
}

function parseIncrementalOptions(args: string[]): IncrementalCommandOptions {
  const common = parseCommonOptionBag(args)
  let perBucket = 10
  let minXl: number | undefined
  let since = getDefaultSinceIso()

  for (let index = 0; index < common.rest.length; index += 1) {
    const current = common.rest[index]

    if (current === '--per-bucket') {
      perBucket = parseIntegerOption(current, common.rest[index + 1])
      index += 1
      continue
    }

    if (current === '--min-xl') {
      minXl = parseIntegerOption(current, common.rest[index + 1])
      index += 1
      continue
    }

    if (current === '--since') {
      since = parseIsoTimestamp(current, common.rest[index + 1])
      index += 1
      continue
    }

    throw new Error(`Unknown incremental option: ${current}`)
  }

  return {
    perBucket,
    minXl,
    since,
    dataDir: common.parsed.dataDir,
    dryRun: common.parsed.dryRun,
    fresh: common.parsed.fresh,
    freshLogfiles: common.parsed.freshLogfiles,
    minDelayMs: common.parsed.minDelayMs,
    timeoutMs: common.parsed.timeoutMs,
    initialTailBytes: common.parsed.initialTailBytes,
    serverIds: common.parsed.serverIds,
    verbose: common.parsed.verbose,
  }
}

function parseAuditOptions(args: string[]): AuditCommandOptions {
  const common = parseCommonOptionBag(args)
  let sampleSize = 20

  for (let index = 0; index < common.rest.length; index += 1) {
    const current = common.rest[index]

    if (current === '--sample-size') {
      sampleSize = parseIntegerOption(current, common.rest[index + 1])
      index += 1
      continue
    }

    throw new Error(`Unknown audit option: ${current}`)
  }

  return {
    sampleSize,
    dataDir: common.parsed.dataDir,
    minDelayMs: common.parsed.minDelayMs,
    timeoutMs: common.parsed.timeoutMs,
    serverIds: common.parsed.serverIds,
  }
}

export async function runCli(
  args: string[],
  deps: CliDependencies = {},
): Promise<CliResult> {
  if (args.length === 0) {
    return { exitCode: 1, stdout: USAGE }
  }

  const [command, ...rest] = args

  try {
    if (command === 'bootstrap') {
      if (rest.includes('--help')) {
        return {
          exitCode: 0,
          stdout: BOOTSTRAP_USAGE,
        }
      }

      const options = parseBootstrapOptions(rest)
      const summary = await (deps.runBootstrapCommand ?? defaultRunBootstrapCommand)(options)

      return {
        exitCode: 0,
        stdout: formatPipelineSummary('Bootstrap', summary, options.dryRun),
      }
    }

    if (command === 'incremental') {
      if (rest.includes('--help')) {
        return {
          exitCode: 0,
          stdout: INCREMENTAL_USAGE,
        }
      }

      const options = parseIncrementalOptions(rest)
      const summary = await (deps.runIncrementalCommand ?? defaultRunIncrementalCommand)(options)

      return {
        exitCode: 0,
        stdout: formatPipelineSummary('Incremental', summary, options.dryRun),
      }
    }

    if (command === 'audit') {
      if (rest.includes('--help')) {
        return {
          exitCode: 0,
          stdout: AUDIT_USAGE,
        }
      }

      const options = parseAuditOptions(rest)
      const bundlePath = await (deps.runAuditCommand ?? defaultRunAuditCommand)(options)

      return {
        exitCode: 0,
        stdout: `Audit bundle written to ${bundlePath}`,
      }
    }

    return { exitCode: 1, stdout: USAGE }
  } catch (error) {
    return {
      exitCode: 1,
      stdout: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  const result = await runCli(process.argv.slice(2))

  if (result.stdout) {
    console.log(result.stdout)
  }

  process.exitCode = result.exitCode
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
