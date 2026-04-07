import type { SkillLevelsSnapshot, SkillsSnapshot } from './types'
import { splitSections } from './splitSections'

const SKILL_NAME_MAP = {
  fighting: 'fighting',
  'maces & flails': 'macesFlails',
  axes: 'axes',
  polearms: 'polearms',
  staves: 'staves',
  'unarmed combat': 'unarmedCombat',
  throwing: 'throwing',
  'short blades': 'shortBlades',
  'long blades': 'longBlades',
  'ranged weapons': 'rangedWeapons',
  armour: 'armour',
  dodging: 'dodging',
  shields: 'shields',
  stealth: 'stealth',
  spellcasting: 'spellcasting',
  conjurations: 'conjurations',
  hexes: 'hexes',
  summonings: 'summonings',
  necromancy: 'necromancy',
  forgecraft: 'forgecraft',
  translocations: 'translocations',
  transmutations: 'transmutations',
  alchemy: 'alchemy',
  'fire magic': 'fireMagic',
  'ice magic': 'iceMagic',
  'air magic': 'airMagic',
  'earth magic': 'earthMagic',
  'poison magic': 'poisonMagic',
  invocations: 'invocations',
  evocations: 'evocations',
  shapeshifting: 'shapeshifting',
} as const

const DEFAULT_SKILL_LEVELS: SkillLevelsSnapshot = {
  fighting: 0,
  macesFlails: 0,
  axes: 0,
  polearms: 0,
  staves: 0,
  unarmedCombat: 0,
  throwing: 0,
  shortBlades: 0,
  longBlades: 0,
  rangedWeapons: 0,
  armour: 0,
  dodging: 0,
  shields: 0,
  stealth: 0,
  spellcasting: 0,
  conjurations: 0,
  hexes: 0,
  summonings: 0,
  necromancy: 0,
  forgecraft: 0,
  translocations: 0,
  transmutations: 0,
  alchemy: 0,
  fireMagic: 0,
  iceMagic: 0,
  airMagic: 0,
  earthMagic: 0,
  poisonMagic: 0,
  invocations: 0,
  evocations: 0,
  shapeshifting: 0,
}

function parseSkillLines(text: string) {
  const section = splitSections(text).skills

  return section
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(
        /^(?:[O+*-]\s+)?Level\s+([0-9]+(?:\.[0-9])?)(?:\(([0-9]+(?:\.[0-9])?)\))?\s+(.+?)$/,
      )

      if (!match) {
        throw new Error(`Could not parse skill line: ${line}`)
      }

      return {
        name: match[3].trim(),
        level: Number(match[1]),
        effectiveLevel: match[2] ? Number(match[2]) : Number(match[1]),
      }
    })
}

export function extractSkills(text: string): SkillsSnapshot {
  const parsed = parseSkillLines(text)
  const skills: SkillLevelsSnapshot = { ...DEFAULT_SKILL_LEVELS }
  const effectiveSkills: SkillLevelsSnapshot = { ...DEFAULT_SKILL_LEVELS }

  for (const entry of parsed) {
    const normalizedName = SKILL_NAME_MAP[entry.name.toLowerCase() as keyof typeof SKILL_NAME_MAP]

    // Ignore unknown skill labels so parser stays forward-compatible with
    // future Crawl skill table changes.
    if (!normalizedName) {
      continue
    }

    skills[normalizedName] = entry.level
    effectiveSkills[normalizedName] = entry.effectiveLevel
  }

  return { skills, effectiveSkills }
}
