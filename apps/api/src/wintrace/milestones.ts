import { parseRawGameFromLine } from '~/parser/utils'
import { createWinTraceGameId, getVersionMinorFromFullVersion } from './winIndex'

export type MilestoneInput = {
  serverAbbreviation: string
  sourceBucket: string
  milestonesPath: string
  line: string
}

export type MilestoneEntry = {
  gameId: string
  serverAbbreviation: string
  sourceBucket: string
  milestonesPath: string
  player: string
  start: string
  time: string
  xl: number
  type: string
  milestone: string
  god: string | null
  fullVersion: string | null
  longVersion: string | null
  versionMinor: string | null
}

export type ReligionTraceEntry = [xl: number, god: string | null]

export type ReligionTraceBuildResult = {
  religionTrace: ReligionTraceEntry[]
  warnings: string[]
}

const religionStateMilestoneTypes = new Set(['begin', 'god.worship', 'god.renounce'])

export const isReligionStateMilestone = (entry: Pick<MilestoneEntry, 'type'>) => {
  return religionStateMilestoneTypes.has(entry.type)
}

export const collapseReligionTrace = (trace: ReligionTraceEntry[]) => {
  const collapsed: ReligionTraceEntry[] = []

  for (const [xl, god] of trace) {
    const previous = collapsed.at(-1)

    if (!previous) {
      collapsed.push([xl, god])
      continue
    }

    if (previous[0] === xl) {
      previous[1] = god
      continue
    }

    if (previous[1] === god) {
      continue
    }

    collapsed.push([xl, god])
  }

  return collapsed
}

export const parseMilestoneLine = ({
  serverAbbreviation,
  sourceBucket,
  milestonesPath,
  line,
}: MilestoneInput): MilestoneEntry | null => {
  const raw = parseRawGameFromLine(line)

  const player = raw.name
  const start = raw.start
  const time = raw.time
  const type = raw.type
  const milestone = raw.milestone
  const xlString = raw.xl

  if (!player || !start || !time || !type || !milestone || !xlString) {
    return null
  }

  const xl = parseInt(xlString, 10)

  if (isNaN(xl)) {
    return null
  }

  const fullVersion = raw.v ?? null

  return {
    gameId: createWinTraceGameId({
      serverAbbreviation,
      player,
      start,
    }),
    serverAbbreviation,
    sourceBucket,
    milestonesPath,
    player,
    start,
    time,
    xl,
    type,
    milestone,
    god: raw.god ?? null,
    fullVersion,
    longVersion: raw.vlong ?? null,
    versionMinor: fullVersion ? getVersionMinorFromFullVersion(fullVersion) : null,
  }
}

export const buildReligionTrace = ({
  milestones,
  finalGod,
}: {
  milestones: MilestoneEntry[]
  finalGod: string | null
}): ReligionTraceBuildResult => {
  const warnings: string[] = []
  const religionTrace: ReligionTraceEntry[] = []

  const relevantMilestones = milestones
    .filter(isReligionStateMilestone)
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time))

  let currentGod: string | null = null

  for (const milestone of relevantMilestones) {
    if (milestone.type === 'god.renounce') {
      if (currentGod !== null) {
        religionTrace.push([milestone.xl, null])
        currentGod = null
      } else if (religionTrace.length === 0) {
        religionTrace.push([milestone.xl, null])
      }

      continue
    }

    if (!milestone.god) {
      if (milestone.type !== 'begin') {
        warnings.push(`missing-god:${milestone.type}:${milestone.time}`)
      }
      continue
    }

    if (currentGod === milestone.god) {
      continue
    }

    religionTrace.push([milestone.xl, milestone.god])
    currentGod = milestone.god
  }

  const lastKnownGod = religionTrace.at(-1)?.[1] ?? null
  const collapsedReligionTrace = collapseReligionTrace(religionTrace)
  const collapsedLastKnownGod = collapsedReligionTrace.at(-1)?.[1] ?? null

  if (finalGod && collapsedReligionTrace.length === 0) {
    warnings.push(`missing-religion-events:${finalGod}`)
  } else if (finalGod !== collapsedLastKnownGod) {
    warnings.push(`final-god-mismatch:${collapsedLastKnownGod ?? 'null'}->${finalGod ?? 'null'}`)
  }

  return {
    religionTrace: collapsedReligionTrace,
    warnings,
  }
}
