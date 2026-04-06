import type { CandidateGame, ServerManifest } from '../types'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatUtcMorgueTimestamp(endedAt: string): string {
  const timestamp = new Date(endedAt)

  if (Number.isNaN(timestamp.valueOf())) {
    throw new Error(`Invalid endedAt timestamp: ${endedAt}`)
  }

  return [
    timestamp.getUTCFullYear(),
    pad(timestamp.getUTCMonth() + 1),
    pad(timestamp.getUTCDate()),
  ].join('') +
    '-' +
    [pad(timestamp.getUTCHours()), pad(timestamp.getUTCMinutes()), pad(timestamp.getUTCSeconds())].join('')
}

export function buildMorgueUrl(candidate: CandidateGame, server: ServerManifest): string {
  const fileName = `morgue-${candidate.playerName}-${formatUtcMorgueTimestamp(candidate.endedAt)}.txt`

  if (server.morgueRule.kind === 'rawdata-player-dir') {
    return `${server.morgueRule.baseUrl}/${candidate.playerName}/${fileName}`
  }

  return `${server.morgueRule.baseUrl}/${candidate.playerName}/${fileName}`
}
