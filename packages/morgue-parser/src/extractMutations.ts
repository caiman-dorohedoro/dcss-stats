import type { MutationEntrySnapshot, MutationSnapshot } from './types'
import { splitSections } from './splitSections'

const STOP_LINE_PATTERNS = [/^}:/, /^[a-z]:/i, /^\d+:/, /^You /, /^[A-Z][^,]*:$/]

function collectAbilityLine(header: string): string {
  const lines = header.split('\n')
  const startIndex = lines.findIndex((line) => /^A:\s*/.test(line))

  if (startIndex === -1) {
    return ''
  }

  const collected = [lines[startIndex].replace(/^A:\s*/, '').trim()]

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim()

    if (!line || STOP_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
      break
    }

    collected.push(line)
  }

  return collected.join(' ').replace(/\s+/g, ' ').trim()
}

function parseMutationEntry(entry: string): MutationEntrySnapshot {
  const normalizedEntry = entry.replace(/^\((.*)\)$/, '$1').trim()
  const leveledMatch = normalizedEntry.match(/^(.*\S)\s+(\d+)$/)

  if (leveledMatch) {
    return {
      name: leveledMatch[1].trim(),
      level: Number.parseInt(leveledMatch[2], 10),
    }
  }

  return {
    name: normalizedEntry,
    level: null,
  }
}

export function extractMutations(text: string): MutationSnapshot {
  const abilityLine = collectAbilityLine(splitSections(text).header)

  if (!abilityLine) {
    return { mutations: [] }
  }

  return {
    mutations: abilityLine
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => parseMutationEntry(entry)),
  }
}
