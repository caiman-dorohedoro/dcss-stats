import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { candidateRepo, createInMemoryDb, migrate, offsetRepo } from '../../src/db/repos'
import { syncLogfile } from '../../src/discovery/syncLogfile'

const fixturePath = path.resolve(process.cwd(), 'test/fixtures/xlog/cao-034.txt')

describe('syncLogfile', () => {
  it('only advances offset after complete newline-terminated records are persisted', async () => {
    const db = createInMemoryDb()
    migrate(db)

    let currentText = (await readFile(fixturePath, 'utf8')).replace(/\n$/, '')

    const readLogfileSlice = async ({ byteOffset }: { byteOffset: number }) => ({
      text: currentText.slice(byteOffset),
    })

    const first = await syncLogfile(db, {
      serverId: 'CAO',
      version: '0.34',
      logfileUrl: 'http://crawl.akrasiac.org/logfile34',
      readLogfileSlice,
      now: () => '2026-04-05T03:00:00.000Z',
    })

    const firstLine =
      'name=alice:start=20260405000102:v=0.34:end=20260405010203:tmsg=slain by an orc:: warrior\n'

    expect(first.processedLines).toBe(1)
    expect(first.insertedCandidates).toBe(1)
    expect(first.rejectedLines).toBe(0)
    expect(first.skippedTrailingPartialLine).toBe(true)
    expect(first.nextOffset).toBe(Buffer.byteLength(firstLine, 'utf8'))
    expect(candidateRepo.count(db)).toBe(1)
    expect(offsetRepo.get(db, 'CAO', '0.34', 'http://crawl.akrasiac.org/logfile34')?.byteOffset).toBe(
      Buffer.byteLength(firstLine, 'utf8'),
    )

    currentText += 'th the Orb\n'

    const second = await syncLogfile(db, {
      serverId: 'CAO',
      version: '0.34',
      logfileUrl: 'http://crawl.akrasiac.org/logfile34',
      readLogfileSlice,
      now: () => '2026-04-05T04:00:00.000Z',
    })

    expect(second.processedLines).toBe(1)
    expect(second.insertedCandidates).toBe(1)
    expect(second.rejectedLines).toBe(0)
    expect(second.skippedTrailingPartialLine).toBe(false)
    expect(second.nextOffset).toBe(Buffer.byteLength(currentText, 'utf8'))
    expect(candidateRepo.count(db)).toBe(2)
  })

  it('stores an absolute offset when the reader jumps to a logfile tail', async () => {
    const db = createInMemoryDb()
    migrate(db)

    const tailText =
      'name=alice:start=20260405000102:v=0.34:end=20260405010203:tmsg=slain by an orc\n'

    const result = await syncLogfile(db, {
      serverId: 'CAO',
      version: '0.34',
      logfileUrl: 'http://crawl.akrasiac.org/logfile34',
      readLogfileSlice: async () => ({
        text: tailText,
        byteOffset: 1_000,
      }),
      now: () => '2026-04-05T05:00:00.000Z',
    })

    expect(result.previousOffset).toBe(0)
    expect(result.nextOffset).toBe(1_000 + Buffer.byteLength(tailText, 'utf8'))
    expect(result.rejectedLines).toBe(0)
    expect(offsetRepo.get(db, 'CAO', '0.34', 'http://crawl.akrasiac.org/logfile34')?.byteOffset).toBe(
      1_000 + Buffer.byteLength(tailText, 'utf8'),
    )
    expect(candidateRepo.count(db)).toBe(1)
  })

  it('skips wizard mode candidates without stopping sync', async () => {
    const db = createInMemoryDb()
    migrate(db)

    const text = [
      'name=alice:start=20260305000102S:v=0.34:end=20260305010203S:tmsg=ok:wizmode=1',
      'name=bob:start=20260305030405S:v=0.34:end=20260305040506S:tmsg=ok',
      '',
    ].join('\n')

    const result = await syncLogfile(db, {
      serverId: 'CAO',
      version: '0.34',
      logfileUrl: 'http://crawl.akrasiac.org/logfile34',
      readLogfileSlice: async () => ({ text }),
      now: () => '2026-04-05T06:00:00.000Z',
    })

    expect(result.processedLines).toBe(2)
    expect(result.insertedCandidates).toBe(1)
    expect(result.rejectedLines).toBe(1)
    expect(candidateRepo.count(db)).toBe(1)
    expect(candidateRepo.listAll(db)[0]?.playerName).toBe('bob')
  })
})
