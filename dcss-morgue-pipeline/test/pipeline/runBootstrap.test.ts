import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { candidateRepo, createInMemoryDb, parseResultRepo } from '../../src/db/repos'
import { writeAuditBundle } from '../../src/audit/writeAuditBundle'
import { runBootstrap } from '../../src/pipeline/runBootstrap'
import type { CandidateGame, MorgueFetchRow } from '../../src/types'

function seedCandidate(
  candidateId: string,
  serverId: CandidateGame['serverId'],
  version: CandidateGame['version'],
): CandidateGame {
  return {
    candidateId,
    serverId,
    version,
    sourceVersionLabel: version === 'trunk' ? 'git' : version,
    playerName: candidateId,
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

describe('runBootstrap', () => {
  it('runs bootstrap discovery -> sampling -> fetch -> parse -> store', async () => {
    const db = createInMemoryDb()
    const auditDir = await mkdtemp(path.join(os.tmpdir(), 'dcss-audit-'))

    const summary = await runBootstrap({
      db,
      options: { perBucket: 2 },
      paths: {
        auditDir,
        morguesDir: auditDir,
      },
      now: () => '2026-04-05T08:00:00.000Z',
      discoverCandidates: async () => {
        candidateRepo.insertMany(db, [
          seedCandidate('cao34-a', 'CAO', '0.34'),
          seedCandidate('cao34-b', 'CAO', '0.34'),
          seedCandidate('caogit-a', 'CAO', 'trunk'),
          seedCandidate('caogit-b', 'CAO', 'trunk'),
          seedCandidate('cbrg34-a', 'CBRG', '0.34'),
          seedCandidate('cbrg34-b', 'CBRG', '0.34'),
          seedCandidate('cbrggit-a', 'CBRG', 'trunk'),
          seedCandidate('cbrggit-b', 'CBRG', 'trunk'),
        ])
      },
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
      parseMorgue: (_text, meta) => {
        const ok = meta.candidateId.endsWith('-a')
        if (ok) {
          return {
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
              ac: 4,
              ev: 11,
              sh: 0,
              strength: 8,
              intelligence: 19,
              dexterity: 14,
              bodyArmour: 'robe',
              shield: 'none',
              helmet: false,
              gloves: false,
              bootsOrBarding: false,
              cloak: false,
              armourSkill: 2.3,
              dodgingSkill: 8.1,
              shieldSkill: 0,
              spellcasting: 12.4,
              schoolSkills: {},
              spells: [],
              wizardry: 1,
              channel: 0,
              wildMagic: 0,
            },
          }
        }

        return {
          ok: false as const,
          failure: {
            reason: 'wizardry_parse_failed',
            detail: 'synthetic failure',
          },
        }
      },
    })

    expect(summary.selectedCandidates).toBe(8)
    expect(summary.parsedSuccesses + summary.parsedFailures).toBe(8)
    expect(parseResultRepo.listAll(db)).toHaveLength(8)

    const auditPath = await writeAuditBundle(
      {
        db,
        options: { perBucket: 2 },
        paths: { auditDir },
        now: () => '2026-04-05T08:00:00.000Z',
      },
      { sampleSize: 4 },
    )

    expect(path.basename(auditPath)).toMatch(/^audit-.*\.json$/)
  })
})
