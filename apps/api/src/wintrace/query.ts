import { ReligionTraceEntry } from './milestones'
import { SerializedSkillTrace, WinTraceRecord } from './types'

type SkillAtXl = {
  skillId: string
  level: number
}

const getLatestTraceValueAtXl = <T>(trace: Array<[xl: number, value: T]>, xl: number, fallback: T) => {
  let currentValue = fallback

  for (const [traceXl, value] of trace) {
    if (traceXl > xl) {
      break
    }

    currentValue = value
  }

  return currentValue
}

export const getGodAtXl = (religionTrace: ReligionTraceEntry[], xl: number) => {
  return getLatestTraceValueAtXl<string | null>(religionTrace, xl, null)
}

export const getSkillLevelAtXl = ({
  skills,
  skillId,
  xl,
}: {
  skills: SerializedSkillTrace
  skillId: string
  xl: number
}) => {
  return getLatestTraceValueAtXl<number>(skills[skillId] ?? [], xl, 0)
}

export const getSkillLevelsAtXl = ({
  skills,
  xl,
}: {
  skills: SerializedSkillTrace
  xl: number
}) => {
  const entries = Object.keys(skills)
    .sort()
    .map<[string, number]>((skillId) => [
      skillId,
      getSkillLevelAtXl({
        skills,
        skillId,
        xl,
      }),
    ])
    .filter((entry) => entry[1] > 0)

  return Object.fromEntries(entries)
}

export const wasSkillTrainedAtXl = ({
  skills,
  skillId,
  xl,
}: {
  skills: SerializedSkillTrace
  skillId: string
  xl: number
}) => {
  return (skills[skillId] ?? []).some(([traceXl]) => traceXl === xl)
}

export const getSkillsTrainedAtXl = ({
  skills,
  xl,
}: {
  skills: SerializedSkillTrace
  xl: number
}): SkillAtXl[] => {
  return Object.keys(skills)
    .filter((skillId) =>
      wasSkillTrainedAtXl({
        skills,
        skillId,
        xl,
      }),
    )
    .map((skillId) => ({
      skillId,
      level: getSkillLevelAtXl({
        skills,
        skillId,
        xl,
      }),
    }))
    .sort((left, right) => right.level - left.level || left.skillId.localeCompare(right.skillId))
}

export const wasSkillTrainedInWindow = ({
  skills,
  skillId,
  fromXl,
  toXl,
}: {
  skills: SerializedSkillTrace
  skillId: string
  fromXl: number
  toXl: number
}) => {
  return (skills[skillId] ?? []).some(([traceXl]) => traceXl >= fromXl && traceXl <= toXl)
}

export const filterWinTraceRecords = ({
  records,
  versionMinor,
  race,
  className,
  finalGod,
  godAtXl,
  xl,
}: {
  records: WinTraceRecord[]
  versionMinor?: string
  race?: string
  className?: string
  finalGod?: string | null
  godAtXl?: string | null
  xl?: number
}) => {
  return records.filter((record) => {
    if (versionMinor && record.versionMinor !== versionMinor) {
      return false
    }

    if (race && record.race !== race) {
      return false
    }

    if (className && record.class !== className) {
      return false
    }

    if (finalGod !== undefined && record.finalGod !== finalGod) {
      return false
    }

    if (xl !== undefined && godAtXl !== undefined && getGodAtXl(record.religionTrace, xl) !== godAtXl) {
      return false
    }

    return true
  })
}
