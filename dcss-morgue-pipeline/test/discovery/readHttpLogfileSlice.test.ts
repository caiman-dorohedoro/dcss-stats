import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  createHttpLogfileBackfillReader,
  createHttpLogfileReader,
} from '../../src/discovery/readHttpLogfileSlice'

describe('createHttpLogfileReader', () => {
  it('uses a tail range for the first read and skips a leading partial record', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'dcss-log-slice-'))
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: {
            'content-length': '20',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response('xpartial\nline-a\nline-b\n', {
          status: 206,
        }),
      )
    const reader = createHttpLogfileReader({
      logfilesDir: rootDir,
      fetchImpl,
      initialTailBytes: 8,
    })

    const result = await reader({
      serverId: 'CAO',
      version: '0.34',
      logfileUrl: 'https://crawl.akrasiac.org/logfile',
      byteOffset: 0,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      text: 'line-a\nline-b\n',
      byteOffset: 20,
    })
    await expect(
      readFile(path.resolve(rootDir, 'CAO', '0.34', '000000000020.log'), 'utf8'),
    ).resolves.toBe('line-a\nline-b\n')
  })

  it('uses range requests for incremental reads and caches the returned slice', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'dcss-log-slice-'))
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('line-2\nline-3\n', {
        status: 206,
      }),
    )
    const reader = createHttpLogfileReader({
      logfilesDir: rootDir,
      fetchImpl,
    })

    const result = await reader({
      serverId: 'CAO',
      version: '0.34',
      logfileUrl: 'https://crawl.akrasiac.org/logfile',
      byteOffset: 7,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ text: 'line-2\nline-3\n', byteOffset: 7 })
    await expect(
      readFile(path.resolve(rootDir, 'CAO', '0.34', '000000000007.log'), 'utf8'),
    ).resolves.toBe('line-2\nline-3\n')
  })

  it('reuses a cached initial slice instead of refetching when byteOffset is zero', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'dcss-log-slice-'))
    const cacheDir = path.resolve(rootDir, 'CAO', '0.34')

    await mkdir(cacheDir, { recursive: true })
    await writeFile(path.resolve(cacheDir, '000000000020.log'), 'cached-a\ncached-b\n', 'utf8')

    const fetchImpl = vi.fn()
    const reader = createHttpLogfileReader({
      logfilesDir: rootDir,
      fetchImpl,
    })

    const result = await reader({
      serverId: 'CAO',
      version: '0.34',
      logfileUrl: 'https://crawl.akrasiac.org/logfile',
      byteOffset: 0,
    })

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result).toEqual({
      text: 'cached-a\ncached-b\n',
      byteOffset: 20,
    })
  })

  it('reuses the nearest older cached slice for backfill', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'dcss-log-slice-'))
    const cacheDir = path.resolve(rootDir, 'CAO', '0.34')

    await mkdir(cacheDir, { recursive: true })
    await writeFile(path.resolve(cacheDir, '000000000020.log'), 'older-a\nolder-b\n', 'utf8')
    await writeFile(path.resolve(cacheDir, '000000000050.log'), 'newer-a\nnewer-b\n', 'utf8')

    const fetchImpl = vi.fn()
    const reader = createHttpLogfileBackfillReader({
      logfilesDir: rootDir,
      fetchImpl,
      backfillChunkBytes: 16,
    })

    const result = await reader({
      serverId: 'CAO',
      version: '0.34',
      logfileUrl: 'https://crawl.akrasiac.org/logfile',
      beforeByteExclusive: 50,
    })

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result).toEqual({
      text: 'older-a\nolder-b\n',
      byteOffset: 20,
    })
  })

  it('fetches and caches an older logfile chunk when no cached backfill slice exists', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'dcss-log-slice-'))
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('\nline-a\nline-b\n', {
        status: 206,
      }),
    )
    const reader = createHttpLogfileBackfillReader({
      logfilesDir: rootDir,
      fetchImpl,
      backfillChunkBytes: 8,
    })

    const result = await reader({
      serverId: 'CAO',
      version: '0.34',
      logfileUrl: 'https://crawl.akrasiac.org/logfile',
      beforeByteExclusive: 20,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      text: 'line-a\nline-b\n',
      byteOffset: 12,
    })
    await expect(
      readFile(path.resolve(rootDir, 'CAO', '0.34', '000000000012.log'), 'utf8'),
    ).resolves.toBe('line-a\nline-b\n')
  })
})
