import { describe, expect, it } from 'vitest'
import { getServerManifest } from '../../src/config/manifest'
import { buildMorgueUrl } from '../../src/fetch/buildMorgueUrl'
import type { CandidateGame } from '../../src/types'

function seedCandidate(
  serverId: CandidateGame['serverId'],
  version: CandidateGame['version'],
  playerName: string,
  endedAt: string,
): CandidateGame {
  return {
    candidateId: `${serverId}-${version}-${playerName}`,
    serverId,
    version,
    sourceVersionLabel: version === 'trunk' ? 'git' : version,
    playerName,
    xl: 7,
    endMessage: 'ok',
    startedAt: '2026-04-05T00:00:00.000Z',
    endedAt,
    logfileUrl: `https://example.test/${serverId}/${version}`,
    rawXlogLine: playerName,
    discoveredAt: '2026-04-05T02:00:00.000Z',
    sampledBootstrapAt: null,
    sampledIncrementalAt: null,
  }
}

describe('buildMorgueUrl', () => {
  it('builds rawdata-player-dir URLs for CAO', () => {
    expect(
      buildMorgueUrl(
        seedCandidate('CAO', '0.34', 'alice', '2026-04-05T01:02:03.000Z'),
        getServerManifest('CAO'),
      ),
    ).toBe('http://crawl.akrasiac.org/rawdata/alice/morgue-alice-20260405-010203.txt')
  })

  it('builds morgue-player-dir URLs for CBRG', () => {
    expect(
      buildMorgueUrl(
        seedCandidate('CBRG', 'trunk', 'bob', '2026-04-05T12:34:56.000Z'),
        getServerManifest('CBRG'),
      ),
    ).toBe('https://crawl-br.roguelikes.gg/morgue/bob/morgue-bob-20260405-123456.txt')
  })
})
