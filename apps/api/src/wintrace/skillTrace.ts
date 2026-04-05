import { skills as knownSkills } from '~/app/constants'

export type DenseSkillTrace = Record<string, number[]>
export type SparseSkillTrace = Record<string, Array<[xl: number, level: number]>>

const skillHeadingRegExp = /^Skill\s*XL:\s*\|(.+)\|/
const skillLineRegExp = /^(.+?)\s+\|(.+)\|(?:\s+.*)?$/
const skillColumnWidth = 3

const skillNames = knownSkills.map((skill) => skill.name)

export const skillIdByName = new Map(skillNames.map((name, index) => [name, String(index)]))
export const skillNameById = new Map(skillNames.map((name, index) => [String(index), name]))

export const getSkillTraceKey = (skillName: string) => {
  return skillIdByName.get(skillName) ?? skillName
}

export const getSkillTraceLabel = (skillId: string) => {
  return skillNameById.get(skillId) ?? skillId
}

type XlColumn = {
  xl: number
  start: number
  end: number
}

export const parseSkillHeadingColumns = (headingLine: string): XlColumn[] => {
  const headingMatch = headingLine.match(skillHeadingRegExp)

  if (!headingMatch?.[1]) {
    return []
  }

  const levelsPart = headingMatch[1]
  const matches = [...levelsPart.matchAll(/\d+/g)]

  return matches.map((match, index) => ({
    xl: Number(match[0]),
    start: index * skillColumnWidth,
    end: Math.min((index + 1) * skillColumnWidth, levelsPart.length),
  }))
}

const parseSkillLine = (line: string) => {
  const match = line.match(skillLineRegExp)

  if (!match?.[1] || !match[2]) {
    return null
  }

  return {
    skillName: match[1].trim(),
    levelsPart: match[2],
  }
}

const isSeparatorLine = (line: string) => {
  return /^[\s\-+|]+$/.test(line)
}

export const parseDenseSkillTrace = (morgueText: string): DenseSkillTrace => {
  const lines = morgueText.split('\n')
  const skillHeadingIndex = lines.findIndex((line) => skillHeadingRegExp.test(line))
  const skillHeading = lines[skillHeadingIndex]

  if (skillHeadingIndex < 0 || !skillHeading) {
    return {}
  }

  const columns = parseSkillHeadingColumns(skillHeading)

  if (columns.length === 0) {
    return {}
  }

  const denseTrace: DenseSkillTrace = {}

  for (let index = skillHeadingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]

    if (!line?.trim()) {
      if (Object.keys(denseTrace).length > 0) {
        break
      }

      continue
    }

    if (isSeparatorLine(line)) {
      continue
    }

    const parsed = parseSkillLine(line)

    if (!parsed) {
      if (Object.keys(denseTrace).length > 0) {
        break
      }

      continue
    }

    const levels: number[] = []
    let previousLevel = 0

    for (const column of columns) {
      const cell = parsed.levelsPart.slice(column.start, column.end).trim()
      const numericLevel = parseInt(cell, 10)
      const level = isNaN(numericLevel) || numericLevel === 0 ? previousLevel : numericLevel

      levels.push(level)
      previousLevel = level
    }

    if (!levels.every((level) => level === 0)) {
      denseTrace[parsed.skillName] = levels
    }
  }

  return denseTrace
}

export const toSparseSkillTrace = (denseTrace: DenseSkillTrace): SparseSkillTrace => {
  return Object.fromEntries(
    Object.entries(denseTrace)
      .map<[string, Array<[number, number]>]>(([skillName, levels]) => {
        let previousLevel = 0

        const sparseLevels = levels.flatMap((level, index) => {
          if (level === previousLevel) {
            return []
          }

          previousLevel = level
          return [[index + 1, level] as [number, number]]
        })

        return [skillName, sparseLevels]
      })
      .filter(([, levels]) => levels.length > 0),
  )
}

export const serializeSparseSkillTrace = (sparseTrace: SparseSkillTrace) => {
  return Object.fromEntries(
    Object.entries(sparseTrace).map(([skillName, trace]) => [getSkillTraceKey(skillName), trace]),
  )
}

export const parseSerializedSkillTrace = (morgueText: string) => {
  return serializeSparseSkillTrace(toSparseSkillTrace(parseDenseSkillTrace(morgueText)))
}
