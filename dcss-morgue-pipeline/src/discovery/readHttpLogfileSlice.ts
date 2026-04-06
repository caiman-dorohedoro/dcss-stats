import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { PoliteFetch } from '../net/politeFetch'
import type { ReadBackfillSlice, ReadLogfileSlice } from './syncLogfile'

type HttpSlice = {
  text: string
  byteOffset: number
}

function getSliceText(text: string, byteOffset: number): string {
  if (byteOffset <= 0) {
    return text
  }

  const buffer = Buffer.from(text, 'utf8')

  if (byteOffset > buffer.length) {
    throw new Error(
      `Remote logfile is shorter than the saved offset (${byteOffset} > ${buffer.length})`,
    )
  }

  return buffer.subarray(byteOffset).toString('utf8')
}

async function cacheLogfileSlice(
  rootDir: string,
  input: {
    serverId: string
    version: string
    byteOffset: number
    text: string
  },
) {
  const dirPath = path.resolve(rootDir, input.serverId, input.version)
  const filePath = path.resolve(dirPath, `${String(input.byteOffset).padStart(12, '0')}.log`)

  await mkdir(dirPath, { recursive: true })
  await writeFile(filePath, input.text, 'utf8')
}

type CachedSliceEntry = {
  byteOffset: number
  cachePath: string
}

async function listCachedSliceEntries(
  rootDir: string,
  input: { serverId: string; version: string },
): Promise<CachedSliceEntry[]> {
  const dirPath = path.resolve(rootDir, input.serverId, input.version)
  const entries = await readdir(dirPath).catch(() => [])
  return entries
    .filter((entry) => /^\d+\.log$/.test(entry))
    .sort()
    .map((entry) => ({
      byteOffset: Number.parseInt(entry.replace(/\.log$/, ''), 10),
      cachePath: path.resolve(dirPath, entry),
    }))
    .filter((entry) => Number.isFinite(entry.byteOffset))
}

async function readCachedSlice(entry: CachedSliceEntry) {
  const text = await readFile(entry.cachePath, 'utf8')

  return {
    text,
    byteOffset: entry.byteOffset,
    cachePath: entry.cachePath,
  }
}

async function readLatestCachedSlice(rootDir: string, input: { serverId: string; version: string }) {
  const entries = await listCachedSliceEntries(rootDir, input)
  const latestEntry = entries.at(-1)

  if (!latestEntry) {
    return null
  }

  return readCachedSlice(latestEntry)
}

async function readPriorCachedSlice(
  rootDir: string,
  input: { serverId: string; version: string; beforeByteExclusive: number },
) {
  const entries = await listCachedSliceEntries(rootDir, input)
  const priorEntry = [...entries]
    .reverse()
    .find((entry) => entry.byteOffset < input.beforeByteExclusive)

  if (!priorEntry) {
    return null
  }

  return readCachedSlice(priorEntry)
}

export async function getLatestCachedSliceOffset(
  rootDir: string,
  input: { serverId: string; version: string },
): Promise<number | null> {
  const entries = await listCachedSliceEntries(rootDir, input)
  return entries.at(-1)?.byteOffset ?? null
}

function createIdentityHeaders(): Headers {
  return new Headers({
    'accept-encoding': 'identity',
  })
}

function parseContentLength(response: Response): number | null {
  const header = response.headers.get('content-length')

  if (!header) {
    return null
  }

  const value = Number.parseInt(header, 10)
  return Number.isFinite(value) && value >= 0 ? value : null
}

function trimInitialTailText(input: {
  requestedStart: number
  targetStart: number
  text: string
}): HttpSlice {
  if (input.requestedStart === input.targetStart) {
    return {
      text: input.text,
      byteOffset: input.targetStart,
    }
  }

  if (input.text.length === 0) {
    return {
      text: '',
      byteOffset: input.targetStart,
    }
  }

  const probeByte = input.text[0]
  const remainder = input.text.slice(1)

  if (probeByte === '\n') {
    return {
      text: remainder,
      byteOffset: input.targetStart,
    }
  }

  const firstNewlineIndex = remainder.indexOf('\n')

  if (firstNewlineIndex === -1) {
    return {
      text: '',
      byteOffset: input.targetStart + Buffer.byteLength(remainder, 'utf8'),
    }
  }

  const committedStart = firstNewlineIndex + 1

  return {
    text: remainder.slice(committedStart),
    byteOffset: input.targetStart + Buffer.byteLength(remainder.slice(0, committedStart), 'utf8'),
  }
}

async function fetchFromKnownOffset(
  fetchImpl: PoliteFetch,
  logfileUrl: string,
  byteOffset: number,
): Promise<HttpSlice> {
  const headers = createIdentityHeaders()

  if (byteOffset > 0) {
    headers.set('range', `bytes=${byteOffset}-`)
  }

  const response = await fetchImpl(logfileUrl, { headers })

  if (response.status === 416) {
    return { text: '', byteOffset }
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch logfile ${logfileUrl}: HTTP ${response.status}`)
  }

  const bodyText = await response.text()
  const text = response.status === 206 ? bodyText : getSliceText(bodyText, byteOffset)

  return {
    text,
    byteOffset,
  }
}

async function fetchInitialTail(
  fetchImpl: PoliteFetch,
  logfileUrl: string,
  initialTailBytes: number,
): Promise<HttpSlice> {
  const headResponse = await fetchImpl(logfileUrl, {
    method: 'HEAD',
    headers: createIdentityHeaders(),
  })

  if (!headResponse.ok) {
    throw new Error(`Failed to inspect logfile ${logfileUrl}: HTTP ${headResponse.status}`)
  }

  const totalLength = parseContentLength(headResponse)

  if (totalLength === null || totalLength <= initialTailBytes) {
    return fetchFromKnownOffset(fetchImpl, logfileUrl, 0)
  }

  const targetStart = Math.max(0, totalLength - initialTailBytes)
  const requestedStart = Math.max(0, targetStart - 1)
  const headers = createIdentityHeaders()

  headers.set('range', `bytes=${requestedStart}-`)

  const response = await fetchImpl(logfileUrl, { headers })

  if (!response.ok) {
    throw new Error(`Failed to fetch logfile ${logfileUrl}: HTTP ${response.status}`)
  }

  if (response.status !== 206) {
    throw new Error(
      `Initial discovery requires range support for oversized logfile ${logfileUrl}`,
    )
  }

  const text = await response.text()
  return trimInitialTailText({
    requestedStart,
    targetStart,
    text,
  })
}

async function fetchBackfillChunk(
  fetchImpl: PoliteFetch,
  logfileUrl: string,
  beforeByteExclusive: number,
  chunkBytes: number,
): Promise<HttpSlice | null> {
  if (beforeByteExclusive <= 0) {
    return null
  }

  const targetStart = Math.max(0, beforeByteExclusive - chunkBytes)
  const requestedStart = Math.max(0, targetStart - 1)
  const headers = createIdentityHeaders()
  headers.set('range', `bytes=${requestedStart}-${beforeByteExclusive - 1}`)

  const response = await fetchImpl(logfileUrl, { headers })

  if (response.status === 416) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Failed to backfill logfile ${logfileUrl}: HTTP ${response.status}`)
  }

  const bodyText = await response.text()
  const text =
    response.status === 206
      ? bodyText
      : Buffer.from(bodyText, 'utf8')
          .subarray(requestedStart, beforeByteExclusive)
          .toString('utf8')

  return trimInitialTailText({
    requestedStart,
    targetStart,
    text,
  })
}

export function createHttpLogfileReader(options: {
  logfilesDir: string
  fetchImpl: PoliteFetch
  initialTailBytes?: number
  log?: (message: string) => void
}): ReadLogfileSlice {
  const initialTailBytes = options.initialTailBytes ?? 1_048_576

  return async (input) => {
    if (input.byteOffset === 0) {
      const cached = await readLatestCachedSlice(options.logfilesDir, {
        serverId: input.serverId,
        version: input.version,
      })

      if (cached) {
        options.log?.(
          `[logfile] reusing cached slice ${input.serverId}/${input.version} @${cached.byteOffset} from ${cached.cachePath}`,
        )

        return {
          text: cached.text,
          byteOffset: cached.byteOffset,
        }
      }
    }

    options.log?.(
      input.byteOffset === 0
        ? `[logfile] fetching tail slice for ${input.serverId}/${input.version} from ${input.logfileUrl}`
        : `[logfile] fetching range for ${input.serverId}/${input.version} from ${input.logfileUrl} starting at byte ${input.byteOffset}`,
    )

    const slice =
      input.byteOffset === 0
        ? await fetchInitialTail(options.fetchImpl, input.logfileUrl, initialTailBytes)
        : await fetchFromKnownOffset(options.fetchImpl, input.logfileUrl, input.byteOffset)

    await cacheLogfileSlice(options.logfilesDir, {
      serverId: input.serverId,
      version: input.version,
      byteOffset: slice.byteOffset,
      text: slice.text,
    })

    return slice
  }
}

export function createHttpLogfileBackfillReader(options: {
  logfilesDir: string
  fetchImpl: PoliteFetch
  backfillChunkBytes: number
  log?: (message: string) => void
}): ReadBackfillSlice {
  return async (input) => {
    const cached = await readPriorCachedSlice(options.logfilesDir, {
      serverId: input.serverId,
      version: input.version,
      beforeByteExclusive: input.beforeByteExclusive,
    })

    if (cached) {
      options.log?.(
        `[logfile] reusing cached backfill slice ${input.serverId}/${input.version} @${cached.byteOffset} from ${cached.cachePath}`,
      )

      return {
        text: cached.text,
        byteOffset: cached.byteOffset,
      }
    }

    options.log?.(
      `[logfile] fetching backfill chunk for ${input.serverId}/${input.version} from ${input.logfileUrl} before byte ${input.beforeByteExclusive}`,
    )

    const slice = await fetchBackfillChunk(
      options.fetchImpl,
      input.logfileUrl,
      input.beforeByteExclusive,
      options.backfillChunkBytes,
    )

    if (!slice) {
      return null
    }

    await cacheLogfileSlice(options.logfilesDir, {
      serverId: input.serverId,
      version: input.version,
      byteOffset: slice.byteOffset,
      text: slice.text,
    })

    return slice
  }
}
