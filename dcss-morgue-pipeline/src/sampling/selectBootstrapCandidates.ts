import type { CandidateGame } from '../types'
import { isExcludedModeCandidate } from '../discovery/parseXlogLine'

function compareCandidates(left: CandidateGame, right: CandidateGame) {
  return left.candidateId.localeCompare(right.candidateId)
}

export function selectBootstrapCandidates(
  candidates: CandidateGame[],
  options: {
    perBucket: number
    minXl?: number
  },
): CandidateGame[] {
  const buckets = new Map<string, CandidateGame[]>()

  for (const candidate of candidates.filter(
    (item) =>
      !isExcludedModeCandidate(item)
      && (options.minXl === undefined || (item.xl !== null && item.xl >= options.minXl)),
  )) {
    const bucketKey = `${candidate.serverId}:${candidate.version}`
    const bucket = buckets.get(bucketKey) ?? []
    bucket.push(candidate)
    buckets.set(bucketKey, bucket)
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([, bucket]) => bucket.sort(compareCandidates).slice(0, options.perBucket))
}
