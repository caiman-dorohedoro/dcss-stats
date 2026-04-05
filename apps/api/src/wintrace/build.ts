import { logger } from '~/utils'
import { buildWinTraceBundles } from './bundles'
import { getEnabledWinTraceServerConfigs, ingestWinTraceServers } from './pipeline'
import { createRequestThrottle } from './requestThrottle'
import { filterServerConfigsBySources } from './sourceSelection'

const parseBooleanFlag = (flagName: string) => {
  return process.argv.includes(flagName)
}

const parseStringOption = (optionName: string) => {
  const entry = process.argv.find((argument) => argument.startsWith(`${optionName}=`))
  return entry?.slice(optionName.length + 1)
}

const parseNumberOption = (optionName: string, fallback: number) => {
  const value = parseStringOption(optionName)
  const parsed = value ? Number(value) : NaN

  return Number.isFinite(parsed) ? parsed : fallback
}

const parseListOption = (optionName: string) => {
  const value = parseStringOption(optionName)

  return value
    ? value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : []
}

const toMiB = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)}MiB`

const main = async () => {
  const revision = parseNumberOption('--revision', Date.now())
  const latestCount = parseNumberOption('--latest-count', 2)
  const timeoutMs = parseNumberOption('--timeout-ms', 15_000)
  const concurrency = parseNumberOption('--concurrency', 6)
  const requestConcurrency = parseNumberOption('--request-concurrency', 1)
  const requestIntervalMs = parseNumberOption('--request-interval-ms', 1_000)
  const requestIntervalCap = parseNumberOption('--request-interval-cap', 1)
  const minSourceVersion = parseStringOption('--min-source-version') ?? '0.30'
  const maxWinsPerSource = parseNumberOption('--max-wins-per-source', 0)
  const maxTotalWins = parseNumberOption('--max-total-wins', 0)
  const includeDormant = parseBooleanFlag('--include-dormant')
  const outputDir = parseStringOption('--output-dir')
  const cacheDir = parseStringOption('--cache-dir')
  const requestedServers = parseListOption('--servers').map((value) => value.toLowerCase())
  const explicitSourceBuckets = parseListOption('--source-buckets').map((value) => value.toLowerCase())
  const requestThrottle = createRequestThrottle({
    concurrencyPerKey: requestConcurrency,
    intervalMs: requestIntervalMs,
    intervalCap: requestIntervalCap,
  })
  const tailTargetWins = maxWinsPerSource > 0 ? maxWinsPerSource : 50
  const tailLogfileBytes =
    parseNumberOption('--logfile-tail-bytes', 0) || Math.max(2 * 1024 * 1024, tailTargetWins * 128 * 1024)
  const tailMilestonesBytes =
    parseNumberOption('--milestones-tail-bytes', 0) ||
    Math.max(8 * 1024 * 1024, tailTargetWins * 512 * 1024)
  const selectedServers = getEnabledWinTraceServerConfigs({
    includeDormant,
  }).filter((serverConfig) => {
    return requestedServers.length === 0
      ? true
      : requestedServers.includes(serverConfig.abbreviation.toLowerCase())
  })
  const serverConfigs = filterServerConfigsBySources({
    serverConfigs: selectedServers,
    minSourceVersion,
    explicitSourceBuckets,
  })

  logger(
    `wintrace: starting build revision=${revision} servers=${serverConfigs.length} includeDormant=${includeDormant} minSourceVersion=${minSourceVersion} throttle=${requestIntervalCap}/${requestIntervalMs}ms maxWinsPerSource=${maxWinsPerSource || 'all'} maxTotalWins=${maxTotalWins || 'all'} tailLogfile=${toMiB(tailLogfileBytes)} tailMilestones=${toMiB(tailMilestonesBytes)}`,
  )

  const ingestResults = await ingestWinTraceServers({
    serverConfigs,
    timeoutMs,
    requestThrottle,
    tailLogfileBytes,
    tailMilestonesBytes,
    targetWins: tailTargetWins,
  })
  const built = await buildWinTraceBundles({
    ingestResults,
    revision,
    outputDir,
    cacheDir,
    latestCount,
    timeoutMs,
    concurrency,
    requestThrottle,
    maxWinsPerSource: maxWinsPerSource > 0 ? maxWinsPerSource : undefined,
    maxTotalWins: maxTotalWins > 0 ? maxTotalWins : undefined,
  })

  logger(
    `wintrace: finished build revision=${revision} records=${built.records.length} skipped=${built.skipped.length}`,
  )
  logger(`wintrace: manifest ${built.manifestPath}`)
  logger(`wintrace: report ${built.reportPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
