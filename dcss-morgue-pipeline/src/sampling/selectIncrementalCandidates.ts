import type { CandidateGame } from '../types'
import { selectBootstrapCandidates } from './selectBootstrapCandidates'

export function selectIncrementalCandidates(
  candidates: CandidateGame[],
  options: {
    since: string
    perBucket: number
    minXl?: number
  },
): CandidateGame[] {
  return selectBootstrapCandidates(
    candidates.filter((candidate) => candidate.discoveredAt >= options.since),
    { perBucket: options.perBucket, minXl: options.minXl },
  )
}
