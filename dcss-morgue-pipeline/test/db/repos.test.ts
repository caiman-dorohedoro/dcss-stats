import { describe, expect, it } from 'vitest'
import type { CandidateGame } from '../../src/types'
import {
  candidateRepo,
  createInMemoryDb,
  migrate,
  morgueFetchRepo,
  offsetRepo,
  parseResultRepo,
} from '../../src/db/repos'

function seedCandidate(overrides: Partial<CandidateGame> = {}): CandidateGame {
  return {
    candidateId: 'candidate-1',
    serverId: 'CAO',
    version: '0.34',
    sourceVersionLabel: '0.34',
    playerName: 'alice',
    xl: 7,
    endMessage: 'slain by an orc',
    startedAt: '2026-04-05T00:00:00.000Z',
    endedAt: '2026-04-05T01:00:00.000Z',
    logfileUrl: 'http://crawl.akrasiac.org/logfile34',
    rawXlogLine: 'name=alice:v=0.34',
    discoveredAt: '2026-04-05T02:00:00.000Z',
    sampledBootstrapAt: null,
    sampledIncrementalAt: null,
    ...overrides,
  }
}

describe('offsetRepo', () => {
  it('stores and retrieves byte offsets by server/version/url', () => {
    const db = createInMemoryDb()
    migrate(db)

    offsetRepo.upsert(db, {
      serverId: 'CAO',
      version: '0.34',
      logfileUrl: 'http://example/logfile34',
      byteOffset: 128,
      updatedAt: '2026-04-05T00:00:00.000Z',
    })

    expect(offsetRepo.get(db, 'CAO', '0.34', 'http://example/logfile34')).toEqual({
      serverId: 'CAO',
      version: '0.34',
      logfileUrl: 'http://example/logfile34',
      byteOffset: 128,
      updatedAt: '2026-04-05T00:00:00.000Z',
    })
  })

  it('stores candidates, fetch rows, and parse result rows idempotently', () => {
    const db = createInMemoryDb()
    migrate(db)

    const candidate = seedCandidate()

    candidateRepo.insertMany(db, [candidate, candidate])
    expect(candidateRepo.count(db)).toBe(1)
    expect(candidateRepo.get(db, candidate.candidateId)).toEqual(candidate)

    morgueFetchRepo.upsert(db, {
      candidateId: candidate.candidateId,
      morgueUrl: 'http://crawl.akrasiac.org/rawdata/alice/morgue-alice-20260405-010000.txt',
      fetchStatus: 'not_found',
      httpStatus: 404,
      localPath: null,
      lastError: null,
      fetchedAt: '2026-04-05T03:00:00.000Z',
    })

    expect(morgueFetchRepo.get(db, candidate.candidateId)).toEqual({
      candidateId: candidate.candidateId,
      morgueUrl: 'http://crawl.akrasiac.org/rawdata/alice/morgue-alice-20260405-010000.txt',
      fetchStatus: 'not_found',
      httpStatus: 404,
      localPath: null,
      lastError: null,
      fetchedAt: '2026-04-05T03:00:00.000Z',
    })

    parseResultRepo.upsertSuccess(db, {
      candidateId: candidate.candidateId,
      parsedJson: { species: 'Djinni', shield: 'none' },
      parsedAt: '2026-04-05T04:00:00.000Z',
    })

    expect(parseResultRepo.get(db, candidate.candidateId)).toEqual({
      candidateId: candidate.candidateId,
      parseStatus: 'success',
      parsedJson: { species: 'Djinni', shield: 'none' },
      failureCode: null,
      failureDetail: null,
      parsedAt: '2026-04-05T04:00:00.000Z',
    })

    parseResultRepo.upsertFailure(db, {
      candidateId: candidate.candidateId,
      failureCode: 'wizardry_parse_failed',
      failureDetail: 'Could not determine wizardry from modifiers section',
      parsedAt: '2026-04-05T05:00:00.000Z',
    })

    expect(parseResultRepo.get(db, candidate.candidateId)).toEqual({
      candidateId: candidate.candidateId,
      parseStatus: 'failure',
      parsedJson: null,
      failureCode: 'wizardry_parse_failed',
      failureDetail: 'Could not determine wizardry from modifiers section',
      parsedAt: '2026-04-05T05:00:00.000Z',
    })
  })
})
