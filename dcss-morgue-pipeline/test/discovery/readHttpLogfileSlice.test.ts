import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createHttpLogfileReader } from '../../src/discovery/readHttpLogfileSlice'

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
})
