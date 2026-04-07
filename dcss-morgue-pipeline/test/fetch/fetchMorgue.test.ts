import { mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { candidateRepo, createInMemoryDb, migrate } from '../../src/db/repos'
import { fetchMorgue } from '../../src/fetch/fetchMorgue'
import type { CandidateGame } from '../../src/types'

function seedCandidate(candidateId: string): CandidateGame {
  return {
    candidateId,
    serverId: 'CAO',
    version: '0.34',
    sourceVersionLabel: '0.34',
    playerName: 'alice',
    xl: 7,
    endMessage: 'ok',
    startedAt: '2026-04-05T00:00:00.000Z',
    endedAt: '2026-04-05T01:02:03.000Z',
    logfileUrl: 'http://crawl.akrasiac.org/logfile34',
    rawXlogLine: 'name=alice',
    discoveredAt: '2026-04-05T02:00:00.000Z',
    sampledBootstrapAt: null,
    sampledIncrementalAt: null,
  }
}

describe('fetchMorgue', () => {
  it('stores 404s once and returns cached misses', async () => {
    const db = createInMemoryDb()
    migrate(db)
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'dcss-morgue-'))
    let callCount = 0
    const candidate = seedCandidate('candidate-404')

    candidateRepo.insertMany(db, [candidate])

    const fetchImpl: typeof fetch = async () => {
      callCount += 1
      return new Response('', { status: 404 })
    }

    const first = await fetchMorgue(db, {
      candidate,
      rootDir,
      fetchImpl,
      now: () => '2026-04-05T03:00:00.000Z',
    })

    const second = await fetchMorgue(db, {
      candidate,
      rootDir,
      fetchImpl,
      now: () => '2026-04-05T04:00:00.000Z',
    })

    expect(first.fetchStatus).toBe('not_found')
    expect(second.fetchStatus).toBe('not_found')
    expect(callCount).toBe(1)
  })

  it('writes successful morgues to disk', async () => {
    const db = createInMemoryDb()
    migrate(db)
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'dcss-morgue-'))
    const candidate = seedCandidate('candidate-success')

    candidateRepo.insertMany(db, [candidate])

    const row = await fetchMorgue(db, {
      candidate,
      rootDir,
      fetchImpl: async () => new Response('MORGUE DATA', { status: 200 }),
      now: () => '2026-04-05T03:00:00.000Z',
    })

    expect(row.fetchStatus).toBe('success')
    expect(row.localPath).toBeTruthy()
    expect(await readFile(row.localPath!, 'utf8')).toBe('MORGUE DATA')
  })
})
