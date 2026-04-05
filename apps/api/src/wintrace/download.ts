import { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { gunzipSync } from 'node:zlib'
import unbzip2Stream from 'unbzip2-stream'
import { logger } from '~/utils'

const bzip2Magic = Buffer.from('BZh')
const gzipMagic = Buffer.from([0x1f, 0x8b])

export type CompressionType = 'none' | 'gzip' | 'bzip2'

export type DownloadTextFileResult = {
  url: string
  status: number
  ok: boolean
  bytes: number
  compression: CompressionType
  contentType: string | null
  contentRange: string | null
  isPartial: boolean
  text: string | null
}

const startsWith = (value: Buffer, prefix: Buffer) =>
  value.byteLength >= prefix.byteLength && value.subarray(0, prefix.byteLength).equals(prefix)

const decompressBzip2 = async (input: Buffer) => {
  const chunks: Buffer[] = []

  await pipeline(
    Readable.from(input),
    unbzip2Stream(),
    new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk))
        callback()
      },
    }),
  )

  return Buffer.concat(chunks)
}

export const detectCompression = (input: Buffer, sourceUrl: string, contentType?: string | null) => {
  const normalizedUrl = sourceUrl.toLowerCase()
  const normalizedContentType = contentType?.toLowerCase() ?? ''

  if (
    startsWith(input, bzip2Magic) ||
    normalizedUrl.endsWith('.bz2') ||
    normalizedContentType.includes('bzip2') ||
    normalizedContentType.includes('x-bzip')
  ) {
    return 'bzip2' as const
  }

  if (
    startsWith(input, gzipMagic) ||
    normalizedUrl.endsWith('.gz') ||
    normalizedContentType.includes('gzip')
  ) {
    return 'gzip' as const
  }

  return 'none' as const
}

export const decodeTextPayload = async ({
  input,
  sourceUrl,
  contentType,
}: {
  input: Buffer
  sourceUrl: string
  contentType?: string | null
}) => {
  const compression = detectCompression(input, sourceUrl, contentType)

  const decoded =
    compression === 'gzip'
      ? gunzipSync(input)
      : compression === 'bzip2'
        ? await decompressBzip2(input)
        : input

  return {
    compression,
    text: decoded.toString('utf8'),
  }
}

export const downloadTextFile = async ({
  url,
  timeoutMs = 15_000,
  skipLog = false,
  headers,
}: {
  url: string
  timeoutMs?: number
  skipLog?: boolean
  headers?: HeadersInit
}): Promise<DownloadTextFileResult> => {
  if (!skipLog) {
    logger(`wintrace: downloading ${url}`)
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers,
  })

  const contentType = response.headers.get('content-type')
  const contentRange = response.headers.get('content-range')
  const buffer = Buffer.from(await response.arrayBuffer())

  if (!response.ok) {
    return {
      url,
      status: response.status,
      ok: false,
      bytes: buffer.byteLength,
      compression: 'none',
      contentType,
      contentRange,
      isPartial: response.status === 206 || contentRange !== null,
      text: null,
    }
  }

  const decoded = await decodeTextPayload({
    input: buffer,
    sourceUrl: url,
    contentType,
  })

  return {
    url,
    status: response.status,
    ok: true,
    bytes: buffer.byteLength,
    compression: decoded.compression,
    contentType,
    contentRange,
    isPartial: response.status === 206 || contentRange !== null,
    text: decoded.text,
  }
}
