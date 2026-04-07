import { describe, expect, it } from 'vitest'
import { candidateRepo, createInMemoryDb, migrate, parseResultRepo } from '../../src/db/repos'
import { runIncremental } from '../../src/pipeline/runIncremental'
import type { CandidateGame, MorgueFetchRow } from '../../src/types'

function mockSkills() {
  return {
    fighting: 0,
    macesFlails: 0,
    axes: 0,
    polearms: 0,
    staves: 0,
    unarmedCombat: 0,
    throwing: 0,
    shortBlades: 0,
    longBlades: 0,
    rangedWeapons: 0,
    armour: 2.3,
    dodging: 8.1,
    shields: 0,
    stealth: 0,
    spellcasting: 12.4,
    conjurations: 0,
    hexes: 0,
    summonings: 0,
    necromancy: 0,
    forgecraft: 0,
    translocations: 0,
    transmutations: 0,
    alchemy: 0,
    fireMagic: 0,
    iceMagic: 0,
    airMagic: 0,
    earthMagic: 0,
    poisonMagic: 0,
    invocations: 0,
    evocations: 0,
    shapeshifting: 0,
  }
}

function seedCandidate(
  candidateId: string,
  serverId: CandidateGame['serverId'],
  version: CandidateGame['version'],
  discoveredAt: string,
): CandidateGame {
  return {
    candidateId,
    serverId,
    version,
    sourceVersionLabel: version === 'trunk' ? 'git' : version,
    playerName: candidateId,
    xl: 12,
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

describe('runIncremental', () => {
  it('only samples newly discovered candidates since the checkpoint window', async () => {
    const db = createInMemoryDb()
    migrate(db)

    candidateRepo.insertMany(db, [
      seedCandidate('old-cao', 'CAO', '0.34', '2026-04-05T00:00:00.000Z'),
      seedCandidate('new-cao', 'CAO', '0.34', '2026-04-05T06:30:00.000Z'),
      seedCandidate('new-cbrg', 'CBRG', 'trunk', '2026-04-05T06:45:00.000Z'),
    ])

    const summary = await runIncremental({
      db,
      options: {
        perBucket: 1,
        since: '2026-04-05T06:00:00.000Z',
      },
      now: () => '2026-04-05T08:00:00.000Z',
      discoverCandidates: async () => undefined,
      fetchMorgue: async (_db, input): Promise<MorgueFetchRow> => ({
        candidateId: input.candidate.candidateId,
        morgueUrl: `https://example.test/${input.candidate.candidateId}.txt`,
        fetchStatus: 'success',
        httpStatus: 200,
        localPath: '/virtual/morgue.txt',
        lastError: null,
        fetchedAt: '2026-04-05T08:00:00.000Z',
      }),
      readMorgueText: async () => 'fixture',
      parseMorgue: (_text, meta) => ({
        ok: true as const,
        record: {
          candidateId: meta.candidateId,
          serverId: meta.serverId,
          playerName: meta.playerName,
          sourceVersionLabel: meta.sourceVersionLabel,
          endedAt: meta.endedAt,
          morgueUrl: meta.morgueUrl,
          version: '0.34' as const,
          species: 'Djinni',
          speciesVariant: null,
          background: null,
          xl: 7,
          ac: 4,
          ev: 11,
          sh: 0,
          strength: 8,
          intelligence: 19,
          dexterity: 14,
          bodyArmour: 'robe',
          shield: 'none',
          helmets: [],
          gloves: [],
          footwear: [],
          cloaks: [],
          orb: 'none',
          amulet: 'none',
          rings: [],
          talisman: 'none',
          form: null,
          skills: mockSkills(),
          effectiveSkills: mockSkills(),
          spells: [],
          mutations: [],
        },
      }),
    })

    expect(summary.selectedCandidates).toBe(2)
    expect(summary.parsedSuccesses).toBe(2)
    expect(summary.parsedFailures).toBe(0)
    expect(parseResultRepo.listAll(db)).toHaveLength(2)
  })
})
