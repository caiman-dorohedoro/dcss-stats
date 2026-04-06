import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getServerManifest } from '../config/manifest'
import { morgueFetchRepo } from '../db/repos'
import type { Database } from '../db/openDb'
import type { CandidateGame, MorgueFetchRow } from '../types'
import { buildMorgueUrl } from './buildMorgueUrl'

type FetchLike = typeof fetch

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
}

function getLocalMorguePath(rootDir: string, candidate: CandidateGame, morgueUrl: string) {
  return path.resolve(
    rootDir,
    candidate.serverId,
    candidate.version,
    candidate.playerName.toLowerCase(),
    path.basename(morgueUrl),
  )
}

export async function fetchMorgue(
  db: Database,
  input: {
    candidate: CandidateGame
    rootDir: string
    fetchImpl?: FetchLike
    now?: () => string
  },
): Promise<MorgueFetchRow> {
  const cached = morgueFetchRepo.get(db, input.candidate.candidateId)

  if (cached && (cached.fetchStatus === 'success' || cached.fetchStatus === 'not_found')) {
    return cached
  }

  const manifest = getServerManifest(input.candidate.serverId)
  const morgueUrl = buildMorgueUrl(input.candidate, manifest)
  const now = input.now?.() ?? new Date().toISOString()
  const fetchImpl = input.fetchImpl ?? fetch

  try {
    const response = await fetchImpl(morgueUrl, {
      signal: AbortSignal.timeout(5000),
    })

    if (response.status === 404) {
      const row: MorgueFetchRow = {
        candidateId: input.candidate.candidateId,
        morgueUrl,
        fetchStatus: 'not_found',
        httpStatus: 404,
        localPath: null,
        lastError: null,
        fetchedAt: now,
      }
      morgueFetchRepo.upsert(db, row)
      return row
    }

    if (!response.ok) {
      const row: MorgueFetchRow = {
        candidateId: input.candidate.candidateId,
        morgueUrl,
        fetchStatus: 'error',
        httpStatus: response.status,
        localPath: null,
        lastError: `Unexpected HTTP status ${response.status}`,
        fetchedAt: now,
      }
      morgueFetchRepo.upsert(db, row)
      return row
    }

    const text = await response.text()
    const localPath = getLocalMorguePath(input.rootDir, input.candidate, morgueUrl)

    await mkdir(path.dirname(localPath), { recursive: true })
    await writeFile(localPath, text, 'utf8')

    const row: MorgueFetchRow = {
      candidateId: input.candidate.candidateId,
      morgueUrl,
      fetchStatus: 'success',
      httpStatus: response.status,
      localPath,
      lastError: null,
      fetchedAt: now,
    }
    morgueFetchRepo.upsert(db, row)
    return row
  } catch (error) {
    const row: MorgueFetchRow = {
      candidateId: input.candidate.candidateId,
      morgueUrl,
      fetchStatus: isTimeoutError(error) ? 'timeout' : 'error',
      httpStatus: null,
      localPath: null,
      lastError: error instanceof Error ? error.message : String(error),
      fetchedAt: now,
    }
    morgueFetchRepo.upsert(db, row)
    return row
  }
}
