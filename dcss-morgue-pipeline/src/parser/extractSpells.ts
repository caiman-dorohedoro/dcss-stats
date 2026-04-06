import type { SpellSnapshot } from '../types'
import { ParseFailure } from './validateStrict'
import { splitSections } from './splitSections'

type ModernSpellColumns = {
  typeStart: number
  failureStart: number
  levelStart: number
}

function parseLegacySpellLine(line: string): SpellSnapshot {
  const match = line.match(/^(?<memorized>\*?)\s*(?<name>.+?)\s+(?<failure>\d+)%$/)

  if (!match?.groups) {
    throw new ParseFailure('spell_section_parse_failed', `Could not parse spell line: ${line}`)
  }

  return {
    name: match.groups.name.trim(),
    failurePercent: Number(match.groups.failure),
    memorized: match.groups.memorized === '*',
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
    .replace(/^[a-z] -\s*/, '')
    .trim()
  const failureField = line.slice(columns.failureStart, columns.levelStart).trim()
  const levelField = line.slice(columns.levelStart).trim()

  if (!name) {
    return null
  }

  if (!/^\d+%$/.test(failureField) || !/^\d+$/.test(levelField)) {
    const fallbackMatch = line.match(/(?<failure>\d+)%\s+(?<level>\d+)\s*$/)

    if (!fallbackMatch?.groups) {
      return null
    }

    return {
      name,
      failurePercent: Number(fallbackMatch.groups.failure),
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

export function extractSpells(text: string): SpellSnapshot[] {
  return dedupeSpells([...parseLegacySpellSection(text), ...parseModernSpellSections(text)])
}
