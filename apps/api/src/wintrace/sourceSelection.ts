import { WinTraceServerConfig } from './serverConfigs'

const versionSourceBucketRegExp = /^\d+\.\d+$/

const parseVersionParts = (value: string) => {
  if (!versionSourceBucketRegExp.test(value)) {
    return null
  }

  const [major, minor] = value.split('.').map(Number)

  if (!Number.isFinite(major) || !Number.isFinite(minor)) {
    return null
  }

  return {
    major,
    minor,
  }
}

export const compareVersionSourceBuckets = (left: string, right: string) => {
  const leftParts = parseVersionParts(left)
  const rightParts = parseVersionParts(right)

  if (!leftParts || !rightParts) {
    return 0
  }

  return leftParts.major - rightParts.major || leftParts.minor - rightParts.minor
}

export const isCurrentGitSourceBucket = (sourceBucket: string) => {
  return sourceBucket === 'git' || sourceBucket === 'trunk'
}

export const shouldIncludeSourceBucket = ({
  sourceBucket,
  minSourceVersion,
  explicitSourceBuckets = [],
}: {
  sourceBucket: string
  minSourceVersion?: string | null
  explicitSourceBuckets?: string[]
}) => {
  if (explicitSourceBuckets.length > 0) {
    return explicitSourceBuckets.includes(sourceBucket.toLowerCase())
  }

  if (isCurrentGitSourceBucket(sourceBucket)) {
    return true
  }

  if (!minSourceVersion) {
    return true
  }

  if (!parseVersionParts(sourceBucket)) {
    return false
  }

  return compareVersionSourceBuckets(sourceBucket, minSourceVersion) >= 0
}

export const filterServerConfigsBySources = ({
  serverConfigs,
  minSourceVersion = '0.30',
  explicitSourceBuckets = [],
}: {
  serverConfigs: WinTraceServerConfig[]
  minSourceVersion?: string | null
  explicitSourceBuckets?: string[]
}) => {
  const normalizedExplicitSourceBuckets = explicitSourceBuckets.map((value) => value.toLowerCase())

  return serverConfigs
    .map((serverConfig) => ({
      ...serverConfig,
      sources: serverConfig.sources.filter((sourceConfig) =>
        shouldIncludeSourceBucket({
          sourceBucket: sourceConfig.sourceBucket,
          minSourceVersion,
          explicitSourceBuckets: normalizedExplicitSourceBuckets,
        }),
      ),
    }))
    .filter((serverConfig) => serverConfig.sources.length > 0)
}
