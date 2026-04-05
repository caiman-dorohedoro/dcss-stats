import { data as seedData } from '../../prisma/seedData'

export type MilestonesPathStatus = 'explicit' | 'inferred' | 'missing'

export type WinTraceSourceConfig = {
  sourceBucket: string
  logfilePath: string
  milestonesPath: string | null
  milestonesPathStatus: MilestonesPathStatus
  morgueUrlPrefix?: string
}

export type WinTraceServerConfig = {
  name: string
  abbreviation: string
  url: string
  baseUrl: string
  morgueUrl: string | null
  isDormant: boolean
  sources: WinTraceSourceConfig[]
}

type SeedServer = (typeof seedData.servers)[number]
type SeedLogfile = SeedServer['logfiles'][number]

const explicitMilestonesPathByLogfilePath = new Map<string, string>([
  ['/allgames-svn.txt', '/milestones-svn.txt'],
  ['/allgames.txt', '/milestones.txt'],
  ['/dcss-logfiles-trunk', '/dcss-milestones-trunk'],
])

export const inferMilestonesPath = (logfilePath: string) => {
  const explicit = explicitMilestonesPathByLogfilePath.get(logfilePath)

  if (explicit) {
    return {
      path: explicit,
      status: 'explicit' as const,
    }
  }

  const patternReplacements: Array<[RegExp, string]> = [
    [/\/logfile$/, '/milestones'],
    [/^\/logfile(.+)$/, '/milestones$1'],
    [/logfile-/, 'milestones-'],
    [/allgames-/, 'milestones-'],
    [/dcss-logfiles-/, 'dcss-milestones-'],
  ]

  for (const [pattern, replacement] of patternReplacements) {
    if (!pattern.test(logfilePath)) {
      continue
    }

    return {
      path: logfilePath.replace(pattern, replacement),
      status: 'inferred' as const,
    }
  }

  return {
    path: null,
    status: 'missing' as const,
  }
}

const normalizeSourceConfig = (logfile: SeedLogfile): WinTraceSourceConfig => {
  const milestones = inferMilestonesPath(logfile.path)

  return {
    sourceBucket: logfile.version,
    logfilePath: logfile.path,
    milestonesPath: milestones.path,
    milestonesPathStatus: milestones.status,
    ...(logfile.morgueUrlPrefix ? { morgueUrlPrefix: logfile.morgueUrlPrefix } : {}),
  }
}

const normalizeServerConfig = (server: SeedServer): WinTraceServerConfig => {
  return {
    name: server.name,
    abbreviation: server.abbreviation,
    url: server.url,
    baseUrl: server.baseUrl,
    morgueUrl: server.morgueUrl ?? null,
    isDormant: 'isDormant' in server ? server.isDormant : false,
    sources: server.logfiles.map(normalizeSourceConfig),
  }
}

export const winTraceServerConfigs = seedData.servers.map(normalizeServerConfig)

export const getWinTraceServerConfig = (abbreviation: string) => {
  return winTraceServerConfigs.find(
    (server) => server.abbreviation.toLowerCase() === abbreviation.toLowerCase(),
  )
}
