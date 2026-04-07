import { describe, expect, it } from 'vitest'
import type { CandidateGame } from '../../src/types'
import { selectIncrementalCandidates } from '../../src/sampling/selectIncrementalCandidates'

function seedCandidate(
  candidateId: string,
  serverId: CandidateGame['serverId'],
  version: CandidateGame['version'],
  discoveredAt: string,
  xl: CandidateGame['xl'] = 12,
): CandidateGame {
  return {
    candidateId,
    serverId,
    version,
    sourceVersionLabel: version === 'trunk' ? 'git' : version,
    playerName: candidateId,
    xl,
    endMessage: 'ok',
    startedAt: '2026-04-05T00:00:00.000Z',
    endedAt: '2026-04-05T01:00:00.000Z',
    logfileUrl: `https://example.test/${serverId}/${version}`,
    rawXlogLine: candidateId,
    discoveredAt,
    sampledBootstrapAt: null,
    sampledIncrementalAt: null,
  }
}

describe('selectIncrementalCandidates', () => {
  it('filters by discovery checkpoint and keeps per-bucket caps', () => {
    const selected = selectIncrementalCandidates(
      [
        seedCandidate('old-1', 'CAO', '0.34', '2026-04-05T00:00:00.000Z'),
        seedCandidate('new-1', 'CAO', '0.34', '2026-04-05T06:00:00.000Z'),
        seedCandidate('new-2', 'CAO', '0.34', '2026-04-05T07:00:00.000Z'),
        seedCandidate('new-3', 'CAO', 'trunk', '2026-04-05T06:30:00.000Z'),
      ],
      {
        since: '2026-04-05T05:59:59.000Z',
        perBucket: 1,
      },
    )

    expect(selected.map((candidate) => candidate.candidateId)).toEqual(['new-1', 'new-3'])
  })

  it('applies the same min-xl filter during incremental selection', () => {
    const selected = selectIncrementalCandidates(
      [
        seedCandidate('new-low', 'CAO', '0.34', '2026-04-05T06:00:00.000Z', 9),
        seedCandidate('new-high', 'CAO', '0.34', '2026-04-05T06:10:00.000Z', 12),
        seedCandidate('new-trunk', 'CAO', 'trunk', '2026-04-05T06:20:00.000Z', 15),
      ],
      {
        since: '2026-04-05T05:59:59.000Z',
        perBucket: 1,
        minXl: 10,
      },
    )

    expect(selected.map((candidate) => candidate.candidateId)).toEqual(['new-high', 'new-trunk'])
  })
})
