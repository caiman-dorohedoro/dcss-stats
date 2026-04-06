import { data as seedData } from '../../../apps/api/prisma/seedData'
import {
  ACTIVE_SERVER_IDS,
  type LogfileManifest,
  type MorgueRule,
  type ServerId,
  type ServerManifest,
  type TargetVersion,
} from '../types'

type SeedServer = (typeof seedData.servers)[number]
type SeedLogfile = SeedServer['logfiles'][number]

const TARGET_BUCKETS = ['0.34', 'trunk'] as const satisfies readonly TargetVersion[]

const SOURCE_LABELS_BY_BUCKET: Record<TargetVersion, readonly string[]> = {
  '0.34': ['0.34'],
  trunk: ['git', 'trunk'],
}

const seedServersById = new Map(
  seedData.servers.map((server) => [server.abbreviation, server] as const),
)

function getSeedServer(serverId: ServerId): SeedServer {
  const server = seedServersById.get(serverId)

  if (!server) {
    throw new Error(`Missing server definition for ${serverId}`)
  }

  return server
}

function getLogfileForBucket(server: SeedServer, bucket: TargetVersion): SeedLogfile {
  const logfile = server.logfiles.find((candidate) =>
    SOURCE_LABELS_BY_BUCKET[bucket].includes(candidate.version),
  )

  if (!logfile) {
    throw new Error(`Missing ${bucket} logfile for ${server.abbreviation}`)
  }

  return logfile
}

function toLogfileManifest(server: SeedServer, bucket: TargetVersion): LogfileManifest {
  const logfile = getLogfileForBucket(server, bucket)

  return {
    url: new URL(logfile.path, server.baseUrl).toString(),
    sourceVersionLabel: logfile.version,
  }
}

function toMorgueRule(server: SeedServer): MorgueRule {
  if (server.morgueUrl.includes('/rawdata')) {
    return {
      kind: 'rawdata-player-dir',
      baseUrl: server.morgueUrl,
    }
  }

  return {
    kind: 'morgue-player-dir',
    baseUrl: server.morgueUrl,
  }
}

function buildServerManifest(serverId: ServerId): ServerManifest {
  const server = getSeedServer(serverId)

  return {
    id: serverId,
    host: new URL(server.baseUrl).hostname,
    buckets: TARGET_BUCKETS,
    logfiles: {
      '0.34': toLogfileManifest(server, '0.34'),
      trunk: toLogfileManifest(server, 'trunk'),
    },
    morgueRule: toMorgueRule(server),
  }
}

export const SERVER_MANIFEST = Object.freeze(
  Object.fromEntries(ACTIVE_SERVER_IDS.map((serverId) => [serverId, buildServerManifest(serverId)])) as Record<
    ServerId,
    ServerManifest
  >,
)

export function getServerManifest(serverId: ServerId): ServerManifest {
  return SERVER_MANIFEST[serverId]
}

export function getBucketForSourceVersion(
  serverId: ServerId,
  sourceVersionLabel: string,
): TargetVersion {
  if (sourceVersionLabel === 'git' || sourceVersionLabel === 'trunk') {
    return 'trunk'
  }

  const versionMatch = sourceVersionLabel.match(/^0\.(\d+)(?:[.-].*)?$/)

  if (versionMatch) {
    const minorVersion = Number.parseInt(versionMatch[1], 10)

    if (minorVersion === 34) {
      return '0.34'
    }

    if (minorVersion > 34) {
      return 'trunk'
    }
  }

  throw new Error(`Unsupported source version for ${serverId}: ${sourceVersionLabel}`)
}

export { ACTIVE_SERVER_IDS }
