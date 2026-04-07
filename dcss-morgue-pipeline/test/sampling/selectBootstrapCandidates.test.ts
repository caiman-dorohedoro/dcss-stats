import { describe, expect, it } from 'vitest'
import type { CandidateGame } from '../../src/types'
import { selectBootstrapCandidates } from '../../src/sampling/selectBootstrapCandidates'

function seedCandidate(
  candidateId: string,
  serverId: CandidateGame['serverId'],
  version: CandidateGame['version'],
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
    discoveredAt: '2026-04-05T02:00:00.000Z',
    sampledBootstrapAt: null,
    sampledIncrementalAt: null,
  }
}

describe('selectBootstrapCandidates', () => {
  it('selects an even bootstrap sample across server/version buckets', () => {
    const candidates = [
      seedCandidate('cao34-1', 'CAO', '0.34'),
      seedCandidate('cao34-2', 'CAO', '0.34'),
      seedCandidate('cao34-3', 'CAO', '0.34'),
      seedCandidate('caogit-1', 'CAO', 'trunk'),
      seedCandidate('caogit-2', 'CAO', 'trunk'),
      seedCandidate('caogit-3', 'CAO', 'trunk'),
      seedCandidate('cbrg34-1', 'CBRG', '0.34'),
      seedCandidate('cbrg34-2', 'CBRG', '0.34'),
      seedCandidate('cbrg34-3', 'CBRG', '0.34'),
      seedCandidate('cbrggit-1', 'CBRG', 'trunk'),
      seedCandidate('cbrggit-2', 'CBRG', 'trunk'),
      seedCandidate('cbrggit-3', 'CBRG', 'trunk'),
    ]

    const selected = selectBootstrapCandidates(candidates, { perBucket: 2 })
    const counts = selected.reduce<Record<string, number>>((acc, candidate) => {
      const key = `${candidate.serverId}:${candidate.version}`
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    expect(counts).toEqual({
      'CAO:0.34': 2,
      'CAO:trunk': 2,
      'CBRG:0.34': 2,
      'CBRG:trunk': 2,
    })
  })

  it('filters excluded-mode candidates before applying per-bucket caps', () => {
    const selected = selectBootstrapCandidates(
      [
        {
          ...seedCandidate('cao34-wiz', 'CAO', '0.34'),
          rawXlogLine:
            'name=wizard:start=20260305000102S:v=0.34:end=20260305010203S:tmsg=ok:wizmode=1',
        },
        {
          ...seedCandidate('cao34-explore', 'CAO', '0.34'),
          rawXlogLine:
            'name=explorer:start=20260305000102S:v=0.34:end=20260305010203S:tmsg=entered explore mode:ktyp=exploremode',
        },
        seedCandidate('cao34-real', 'CAO', '0.34'),
        seedCandidate('cao34-real-2', 'CAO', '0.34'),
      ],
      { perBucket: 2 },
    )

    expect(selected.map((candidate) => candidate.candidateId)).toEqual([
      'cao34-real',
      'cao34-real-2',
    ])
  })

  it('filters candidates below a requested minimum xl', () => {
    const selected = selectBootstrapCandidates(
      [
        seedCandidate('cao34-low', 'CAO', '0.34', 9),
        seedCandidate('cao34-high', 'CAO', '0.34', 10),
        seedCandidate('caogit-high', 'CAO', 'trunk', 15),
        seedCandidate('caogit-missing', 'CAO', 'trunk', null),
      ],
      { perBucket: 2, minXl: 10 },
    )

    expect(selected.map((candidate) => candidate.candidateId)).toEqual([
      'cao34-high',
      'caogit-high',
    ])
  })
})
