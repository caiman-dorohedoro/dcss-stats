import { DEFAULT_CANONICAL_SPELL_NAMES } from './canonicalSpellNames'
import type { SpellSnapshot } from './types'
import { ParseFailure } from './validateStrict'
import { splitSections } from './splitSections'

type ModernSpellColumns = {
  typeStart: number
  failureStart: number
  levelStart: number
}

export function canonicalizeSpellNames(
  spells: SpellSnapshot[],
  canonicalSpellNames: readonly string[] = [],
): SpellSnapshot[] {
  if (canonicalSpellNames.length === 0) {
    return spells
  }

  const exactNameMap = new Map(canonicalSpellNames.map((name) => [name.toLowerCase(), name] as const))

  return spells.map((spell) => {
    const normalizedName = spell.name.toLowerCase()
    const exact = exactNameMap.get(normalizedName)

    if (exact) {
      return {
        ...spell,
        name: exact,
      }
    }

    const prefixMatches = canonicalSpellNames.filter((candidate) =>
      candidate.toLowerCase().startsWith(normalizedName),
    )

    if (prefixMatches.length !== 1) {
      return spell
    }

    return {
      ...spell,
      name: prefixMatches[0],
    }
  })
}

function parseLegacySpellLine(line: string): SpellSnapshot {
  const match = line.match(/^(\*?)\s*(.+?)\s+(\d+)%$/)

  if (!match) {
    throw new ParseFailure('spell_section_parse_failed', `Could not parse spell line: ${line}`)
  }

  return {
    name: match[2].trim(),
    failurePercent: Number(match[3]),
    memorized: match[1] === '*',
  }
}

function parseLegacySpellSection(text: string): SpellSnapshot[] {
  const section = splitSections(text).spells

  if (!section) {
    return []
  }

  return section
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(parseLegacySpellLine)
}

function isModernSpellHeader(line: string): boolean {
  return /^(Your Spells|Spells)\s+Type\s+Power\s+Damage\s+Failure\s+Level$/.test(line)
}

function getModernSpellColumns(line: string): ModernSpellColumns | null {
  if (!isModernSpellHeader(line.trim())) {
    return null
  }

  const typeStart = line.indexOf('Type')
  const failureStart = line.indexOf('Failure')
  const levelStart = line.indexOf('Level')

  if (typeStart === -1 || failureStart === -1 || levelStart === -1) {
    return null
  }

  return {
    typeStart,
    failureStart,
    levelStart,
  }
}

function parseModernSpellLine(
  line: string,
  columns: ModernSpellColumns,
  memorized: boolean,
): SpellSnapshot | null {
  if (line.length < columns.failureStart) {
    return null
  }

  const name = line
    .slice(0, columns.typeStart)
    .replace(/^[A-Za-z0-9] -\s*/, '')
    .trim()
  const failureField = line.slice(columns.failureStart, columns.levelStart).trim()
  const levelField = line.slice(columns.levelStart).trim()

  if (!name) {
    return null
  }

  if (!/^\d+%$/.test(failureField) || !/^\d+$/.test(levelField)) {
    const fallbackMatch = line.match(/(\d+)%\s+(\d+)\s*$/)

    if (!fallbackMatch) {
      return null
    }

    return {
      name,
      failurePercent: Number(fallbackMatch[1]),
      memorized,
    }
  }

  return {
    name,
    failurePercent: Number(failureField.slice(0, -1)),
    memorized,
  }
}

function collectModernSpellRows(lines: string[], startIndex: number, memorized: boolean): SpellSnapshot[] {
  const spells: SpellSnapshot[] = []
  let columns: ModernSpellColumns | null = null

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      if (spells.length > 0) {
        break
      }
      continue
    }

    if (!columns) {
      columns = getModernSpellColumns(line)
      if (columns) {
        continue
      }
    }

    if (isModernSpellHeader(trimmed)) {
      continue
    }

    if (
      /^(You knew the following spells:|Your spell library contain(?:ed|s) the following spells:?)/.test(
        trimmed,
      )
    ) {
      break
    }

    if (!columns) {
      continue
    }

    const spell = parseModernSpellLine(line, columns, memorized)

    if (!spell) {
      if (spells.length > 0) {
        break
      }
      continue
    }

    spells.push(spell)
  }

  return spells
}

function parseModernSpellSections(text: string): SpellSnapshot[] {
  const lines = text.split('\n')
  const spells: SpellSnapshot[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()

    if (trimmed === 'You knew the following spells:') {
      spells.push(...collectModernSpellRows(lines, index + 1, true))
      continue
    }

    if (/^Your spell library contain(?:ed|s) the following spells:?$/.test(trimmed)) {
      spells.push(...collectModernSpellRows(lines, index + 1, false))
    }
  }

  return spells
}

function dedupeSpells(spells: SpellSnapshot[]): SpellSnapshot[] {
  const merged = new Map<string, SpellSnapshot>()

  for (const spell of spells) {
    const key = spell.name.toLowerCase()
    const existing = merged.get(key)

    if (!existing) {
      merged.set(key, spell)
      continue
    }

    merged.set(key, {
      ...spell,
      memorized: existing.memorized || spell.memorized,
      failurePercent: existing.memorized && !spell.memorized ? existing.failurePercent : spell.failurePercent,
    })
  }

  return [...merged.values()]
}

export function extractSpells(
  text: string,
  options?: {
    canonicalSpellNames?: readonly string[]
  },
): SpellSnapshot[] {
  const canonicalSpellNames = [
    ...new Set([...DEFAULT_CANONICAL_SPELL_NAMES, ...(options?.canonicalSpellNames ?? [])]),
  ]

  return canonicalizeSpellNames(
    dedupeSpells([...parseLegacySpellSection(text), ...parseModernSpellSections(text)]),
    canonicalSpellNames,
  )
}
