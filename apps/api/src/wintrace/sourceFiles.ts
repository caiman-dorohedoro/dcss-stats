import { downloadTextFile } from './download'
import { buildReligionTrace, MilestoneEntry, parseMilestoneLine } from './milestones'
import { parseWinIndexLine, WinIndexEntry } from './winIndex'

type WinIndexTextInput = {
  serverAbbreviation: string
  sourceBucket: string
  logfilePath: string
  text: string
  dropFirstLine?: boolean
}

type MilestonesTextInput = {
  serverAbbreviation: string
  sourceBucket: string
  milestonesPath: string
  text: string
  dropFirstLine?: boolean
}

const notNull = <T>(value: T | null): value is T => value !== null

export const resolveSourceUrl = (baseUrl: string, path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  return new URL(path, baseUrl).toString()
}

export const downloadSourceText = async ({
  baseUrl,
  path,
  timeoutMs,
  tailBytes,
}: {
  baseUrl: string
  path: string
  timeoutMs?: number
  tailBytes?: number
}) => {
  return downloadTextFile({
    url: resolveSourceUrl(baseUrl, path),
    timeoutMs,
    headers: tailBytes ? { Range: `bytes=-${tailBytes}` } : undefined,
  })
}

const splitSourceLines = ({
  text,
  dropFirstLine = false,
}: {
  text: string
  dropFirstLine?: boolean
}) => {
  const lines = text.split('\n')

  return (dropFirstLine ? lines.slice(1) : lines).filter((line) => line.trim().length > 0)
}

export const parseWinIndexText = ({
  serverAbbreviation,
  sourceBucket,
  logfilePath,
  text,
  dropFirstLine = false,
}: WinIndexTextInput) => {
  return splitSourceLines({
    text,
    dropFirstLine,
  })
    .map((line) =>
      parseWinIndexLine({
        serverAbbreviation,
        sourceBucket,
        logfilePath,
        line,
      }),
    )
    .filter(notNull)
}

export const parseMilestonesText = ({
  serverAbbreviation,
  sourceBucket,
  milestonesPath,
  text,
  dropFirstLine = false,
}: MilestonesTextInput) => {
  return splitSourceLines({
    text,
    dropFirstLine,
  })
    .map((line) =>
      parseMilestoneLine({
        serverAbbreviation,
        sourceBucket,
        milestonesPath,
        line,
      }),
    )
    .filter(notNull)
}

export const groupMilestonesByGameId = (milestones: MilestoneEntry[]) => {
  const grouped = new Map<string, MilestoneEntry[]>()

  for (const milestone of milestones) {
    const current = grouped.get(milestone.gameId)

    if (current) {
      current.push(milestone)
    } else {
      grouped.set(milestone.gameId, [milestone])
    }
  }

  return grouped
}

export const buildReligionTraceIndex = ({
  wins,
  milestones,
}: {
  wins: WinIndexEntry[]
  milestones: MilestoneEntry[]
}) => {
  const milestonesByGameId = groupMilestonesByGameId(milestones)

  return new Map(
    wins.map((win) => [
      win.gameId,
      buildReligionTrace({
        milestones: milestonesByGameId.get(win.gameId) ?? [],
        finalGod: win.finalGod,
      }),
    ]),
  )
}
