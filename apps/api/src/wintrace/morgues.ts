import path from 'node:path'
import fse from 'fs-extra'
import { logger } from '~/utils'
import { downloadTextFile } from './download'
import { RequestThrottle } from './requestThrottle'
import { WinTraceServerConfig, WinTraceSourceConfig } from './serverConfigs'
import { toMorgueTimestampFromLogfile } from './timestamps'
import { WinIndexEntry } from './winIndex'

export type MorgueFetchStatus = 'cached' | 'downloaded' | 'missing' | 'unavailable'

export type MorgueTextResult = {
  status: MorgueFetchStatus
  remoteUrl: string | null
  localPath: string
  text: string | null
}

export type MorgueFetchProgress = {
  current: number
  total: number
}

const joinUrlPath = (baseUrl: string, suffix: string) => {
  if (!suffix) {
    return baseUrl
  }

  return `${baseUrl.replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`
}

const formatProgress = (progress?: MorgueFetchProgress) => {
  return progress ? ` [${progress.current}/${progress.total}]` : ''
}

export const getWinTraceMorgueFileName = (win: Pick<WinIndexEntry, 'player' | 'end'>) => {
  return `morgue-${win.player}-${toMorgueTimestampFromLogfile(win.end)}.txt`
}

export const getWinTraceMorgueBaseUrl = ({
  serverConfig,
  sourceConfig,
}: {
  serverConfig: WinTraceServerConfig
  sourceConfig: WinTraceSourceConfig
}) => {
  if (!serverConfig.morgueUrl) {
    return null
  }

  return sourceConfig.morgueUrlPrefix
    ? joinUrlPath(serverConfig.morgueUrl, sourceConfig.morgueUrlPrefix)
    : serverConfig.morgueUrl
}

export const getWinTraceMorgueRemoteUrl = ({
  serverConfig,
  sourceConfig,
  win,
}: {
  serverConfig: WinTraceServerConfig
  sourceConfig: WinTraceSourceConfig
  win: WinIndexEntry
}) => {
  const baseUrl = getWinTraceMorgueBaseUrl({
    serverConfig,
    sourceConfig,
  })

  if (!baseUrl) {
    return null
  }

  return `${joinUrlPath(baseUrl, win.player)}/${getWinTraceMorgueFileName(win)}`
}

export const getWinTraceMorgueLocalPath = ({
  serverConfig,
  sourceConfig,
  win,
  cacheDir = path.resolve(process.cwd(), 'wintrace-cache'),
}: {
  serverConfig: WinTraceServerConfig
  sourceConfig: WinTraceSourceConfig
  win: WinIndexEntry
  cacheDir?: string
}) => {
  return path.resolve(
    cacheDir,
    'morgues',
    serverConfig.abbreviation,
    sourceConfig.sourceBucket,
    win.player.toLowerCase(),
    getWinTraceMorgueFileName(win),
  )
}

const readCachedMorgueText = async (localPath: string): Promise<MorgueTextResult | null> => {
  if (!(await fse.pathExists(localPath))) {
    return null
  }

  const text = await fse.readFile(localPath, 'utf8')

  return {
    status: text.length > 0 ? 'cached' : 'missing',
    remoteUrl: null,
    localPath,
    text: text.length > 0 ? text : null,
  }
}

export const fetchWinTraceMorgueText = async ({
  serverConfig,
  sourceConfig,
  win,
  cacheDir,
  timeoutMs = 5_000,
  forceRefresh = false,
  requestThrottle,
  progress,
  downloadText = downloadTextFile,
}: {
  serverConfig: WinTraceServerConfig
  sourceConfig: WinTraceSourceConfig
  win: WinIndexEntry
  cacheDir?: string
  timeoutMs?: number
  forceRefresh?: boolean
  requestThrottle?: RequestThrottle
  progress?: MorgueFetchProgress
  downloadText?: typeof downloadTextFile
}): Promise<MorgueTextResult> => {
  const localPath = getWinTraceMorgueLocalPath({
    serverConfig,
    sourceConfig,
    win,
    cacheDir,
  })

  if (!forceRefresh) {
    const cached = await readCachedMorgueText(localPath)

    if (cached) {
      logger(`wintrace: morgue${formatProgress(progress)} ${cached.status} ${localPath}`)
      return cached
    }
  }

  const remoteUrl = getWinTraceMorgueRemoteUrl({
    serverConfig,
    sourceConfig,
    win,
  })

  if (!remoteUrl) {
    logger(`wintrace: morgue${formatProgress(progress)} unavailable ${win.player}`)
    return {
      status: 'unavailable',
      remoteUrl: null,
      localPath,
      text: null,
    }
  }

  try {
    const runDownload = async () => {
      logger(`wintrace: morgue${formatProgress(progress)} downloading ${remoteUrl}`)

      return downloadText({
        url: remoteUrl,
        timeoutMs,
        skipLog: true,
      })
    }
    const result = requestThrottle
      ? await requestThrottle.run(
          {
            key: serverConfig.abbreviation,
          },
          runDownload,
        )
      : await runDownload()

    await fse.ensureDir(path.dirname(localPath))

    if (result.ok && result.text !== null) {
      await fse.writeFile(localPath, result.text)

      logger(`wintrace: morgue${formatProgress(progress)} downloaded ${remoteUrl}`)

      return {
        status: 'downloaded',
        remoteUrl,
        localPath,
        text: result.text,
      }
    }

    if (result.status === 404) {
      await fse.writeFile(localPath, '')

      logger(`wintrace: morgue${formatProgress(progress)} missing ${remoteUrl}`)

      return {
        status: 'missing',
        remoteUrl,
        localPath,
        text: null,
      }
    }
  } catch (error) {
    logger(`wintrace: morgue${formatProgress(progress)} failed ${remoteUrl} (${String(error)})`)
  }

  return {
    status: 'unavailable',
    remoteUrl,
    localPath,
    text: null,
  }
}
