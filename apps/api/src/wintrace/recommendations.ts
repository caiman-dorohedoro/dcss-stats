import {
  filterWinTraceRecords,
  getSkillLevelAtXl,
  wasSkillTrainedAtXl,
  wasSkillTrainedInWindow,
} from './query'
import { WinTraceRecord } from './types'

export type SkillLevelSummary = {
  min: number
  max: number
  mean: number
  p25: number
  median: number
  p75: number
}

export type SkillRecommendation = {
  skillId: string
  sampleSize: number
  nonZeroCount: number
  nonZeroRate: number
  trainedAtXlCount: number
  trainedAtXlRate: number
  trainedNextWindowCount: number
  trainedNextWindowRate: number
  levelSummary: SkillLevelSummary
}

export type BuildSkillRecommendationsResult = {
  sampleSize: number
  xl: number
  nextWindow: number
  filters: {
    versionMinor?: string
    race?: string
    className?: string
    finalGod?: string | null
    godAtXl?: string | null
  }
  skills: SkillRecommendation[]
}

export type BuildSkillRecommendationsInput = {
  records: WinTraceRecord[]
  xl: number
  nextWindow?: number
  versionMinor?: string
  race?: string
  className?: string
  finalGod?: string | null
  godAtXl?: string | null
  skillIds?: string[]
}

export type ProgressiveRecommendationScope = 'race-class' | 'class' | 'race' | 'all'

export type BuildProgressiveSkillRecommendationsResult = BuildSkillRecommendationsResult & {
  matchedBy: ProgressiveRecommendationScope
  requestedFilters: {
    race?: string
    className?: string
  }
  sampleThreshold: number
}

const getUniqueSkillIds = (records: WinTraceRecord[]) => {
  return [...new Set(records.flatMap((record) => Object.keys(record.skills)))].sort()
}

const getQuantile = (values: number[], percentile: number) => {
  if (values.length === 0) {
    return 0
  }

  const sorted = values.slice().sort((left, right) => left - right)
  const index = (sorted.length - 1) * percentile
  const lowerIndex = Math.floor(index)
  const upperIndex = Math.ceil(index)
  const lower = sorted[lowerIndex] ?? sorted[sorted.length - 1] ?? 0
  const upper = sorted[upperIndex] ?? sorted[sorted.length - 1] ?? 0

  if (lowerIndex === upperIndex) {
    return lower
  }

  return lower + (upper - lower) * (index - lowerIndex)
}

const getLevelSummary = (levels: number[]): SkillLevelSummary => {
  const nonEmptyLevels = levels.length > 0 ? levels : [0]
  const sum = nonEmptyLevels.reduce((acc, value) => acc + value, 0)

  return {
    min: Math.min(...nonEmptyLevels),
    max: Math.max(...nonEmptyLevels),
    mean: sum / nonEmptyLevels.length,
    p25: getQuantile(nonEmptyLevels, 0.25),
    median: getQuantile(nonEmptyLevels, 0.5),
    p75: getQuantile(nonEmptyLevels, 0.75),
  }
}

export const buildSkillRecommendations = ({
  records,
  xl,
  nextWindow = 3,
  versionMinor,
  race,
  className,
  finalGod,
  godAtXl,
  skillIds,
}: BuildSkillRecommendationsInput): BuildSkillRecommendationsResult => {
  const matchingRecords = filterWinTraceRecords({
    records,
    versionMinor,
    race,
    className,
    finalGod,
    godAtXl,
    xl,
  })
  const selectedSkillIds = skillIds ?? getUniqueSkillIds(matchingRecords)
  const sampleSize = matchingRecords.length

  const skills = selectedSkillIds
    .map<SkillRecommendation>((skillId) => {
      const levels = matchingRecords.map((record) =>
        getSkillLevelAtXl({
          skills: record.skills,
          skillId,
          xl,
        }),
      )
      const nonZeroCount = levels.filter((level) => level > 0).length
      const trainedAtXlCount = matchingRecords.filter((record) =>
        wasSkillTrainedAtXl({
          skills: record.skills,
          skillId,
          xl,
        }),
      ).length
      const trainedNextWindowCount = matchingRecords.filter((record) =>
        wasSkillTrainedInWindow({
          skills: record.skills,
          skillId,
          fromXl: xl + 1,
          toXl: xl + nextWindow,
        }),
      ).length

      return {
        skillId,
        sampleSize,
        nonZeroCount,
        nonZeroRate: sampleSize > 0 ? nonZeroCount / sampleSize : 0,
        trainedAtXlCount,
        trainedAtXlRate: sampleSize > 0 ? trainedAtXlCount / sampleSize : 0,
        trainedNextWindowCount,
        trainedNextWindowRate: sampleSize > 0 ? trainedNextWindowCount / sampleSize : 0,
        levelSummary: getLevelSummary(levels),
      }
    })
    .filter((recommendation) => {
      return (
        recommendation.nonZeroCount > 0 ||
        recommendation.trainedAtXlCount > 0 ||
        recommendation.trainedNextWindowCount > 0
      )
    })
    .sort((left, right) => {
      return (
        right.trainedAtXlRate - left.trainedAtXlRate ||
        right.trainedNextWindowRate - left.trainedNextWindowRate ||
        right.levelSummary.median - left.levelSummary.median ||
        left.skillId.localeCompare(right.skillId)
      )
    })

  return {
    sampleSize,
    xl,
    nextWindow,
    filters: {
      versionMinor,
      race,
      className,
      finalGod,
      godAtXl,
    },
    skills,
  }
}

export const buildProgressiveSkillRecommendations = ({
  records,
  xl,
  nextWindow = 3,
  versionMinor,
  race,
  className,
  finalGod,
  godAtXl,
  skillIds,
  minSample = 10,
}: BuildSkillRecommendationsInput & {
  minSample?: number
}): BuildProgressiveSkillRecommendationsResult => {
  const candidates: Array<{
    matchedBy: ProgressiveRecommendationScope
    race?: string
    className?: string
  }> = []

  if (race && className) {
    candidates.push({
      matchedBy: 'race-class',
      race,
      className,
    })
  }

  if (className) {
    candidates.push({
      matchedBy: 'class',
      className,
    })
  }

  if (race) {
    candidates.push({
      matchedBy: 'race',
      race,
    })
  }

  candidates.push({
    matchedBy: 'all',
  })

  const uniqueCandidates = candidates.filter((candidate, index) => {
    return (
      candidates.findIndex((entry) => {
        return (
          entry.matchedBy === candidate.matchedBy &&
          entry.race === candidate.race &&
          entry.className === candidate.className
        )
      }) === index
    )
  })

  for (const [index, candidate] of uniqueCandidates.entries()) {
    const recommendation = buildSkillRecommendations({
      records,
      xl,
      nextWindow,
      versionMinor,
      race: candidate.race,
      className: candidate.className,
      finalGod,
      godAtXl,
      skillIds,
    })

    if (recommendation.sampleSize >= minSample || index === uniqueCandidates.length - 1) {
      return {
        ...recommendation,
        matchedBy: candidate.matchedBy,
        requestedFilters: {
          race,
          className,
        },
        sampleThreshold: minSample,
      }
    }
  }

  return {
    ...buildSkillRecommendations({
      records,
      xl,
      nextWindow,
      versionMinor,
      race,
      className,
      finalGod,
      godAtXl,
      skillIds,
    }),
    matchedBy: 'all',
    requestedFilters: {
      race,
      className,
    },
    sampleThreshold: minSample,
  }
}
