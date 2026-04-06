import type { SkillsSnapshot } from '../types'
import { splitSections } from './splitSections'

const SCHOOL_NAME_MAP: Record<string, string> = {
  conjurations: 'conjurations',
  hexes: 'hexes',
  summonings: 'summonings',
  necromancy: 'necromancy',
  translocations: 'translocations',
  transmutations: 'transmutations',
  'fire magic': 'fireMagic',
  'ice magic': 'iceMagic',
  'air magic': 'airMagic',
  'earth magic': 'earthMagic',
  'poison magic': 'poisonMagic',
  forgecraft: 'forgecraft',
}

function parseSkillLines(text: string) {
  const section = splitSections(text).skills

  return section
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(?:[+*-]\s*)?Level\s+([0-9]+(?:\.[0-9])?)\s+(.+?)$/)

      if (!match) {
        throw new Error(`Could not parse skill line: ${line}`)
      }

      return {
        name: match[2].trim(),
        level: Number(match[1]),
      }
    })
}

export function extractSkills(text: string): SkillsSnapshot {
  const parsed = parseSkillLines(text)
  const skillMap = new Map(parsed.map((entry) => [entry.name.toLowerCase(), entry.level] as const))

  const schoolSkills = Object.fromEntries(
    Object.entries(SCHOOL_NAME_MAP)
      .filter(([name]) => skillMap.has(name))
      .map(([name, normalizedName]) => [normalizedName, skillMap.get(name) ?? 0]),
  )

  return {
    armourSkill: skillMap.get('armour') ?? 0,
    dodgingSkill: skillMap.get('dodging') ?? 0,
    shieldSkill: skillMap.get('shields') ?? 0,
    spellcasting: skillMap.get('spellcasting') ?? 0,
    schoolSkills,
  }
}
