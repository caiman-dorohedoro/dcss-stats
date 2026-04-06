import type { SkillsSnapshot } from './types'
import { splitSections } from './splitSections'

const SKILL_NAME_MAP = {
  fighting: 'fighting',
  'short blades': 'shortBlades',
  'long blades': 'longBlades',
  axes: 'axes',
  'maces & flails': 'macesFlails',
  polearms: 'polearms',
  staves: 'staves',
  'ranged weapons': 'rangedWeapons',
  throwing: 'throwing',
  armour: 'armourSkill',
  dodging: 'dodgingSkill',
  stealth: 'stealth',
  shields: 'shieldSkill',
  'unarmed combat': 'unarmedCombat',
  spellcasting: 'spellcasting',
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
  alchemy: 'alchemy',
  invocations: 'invocations',
  evocations: 'evocations',
  shapeshifting: 'shapeshifting',
} as const

const DEFAULT_SKILLS: SkillsSnapshot = {
  armourSkill: 0,
  dodgingSkill: 0,
  shieldSkill: 0,
  spellcasting: 0,
  fighting: 0,
  shortBlades: 0,
  longBlades: 0,
  axes: 0,
  macesFlails: 0,
  polearms: 0,
  staves: 0,
  rangedWeapons: 0,
  throwing: 0,
  stealth: 0,
  unarmedCombat: 0,
  conjurations: 0,
  hexes: 0,
  summonings: 0,
  necromancy: 0,
  translocations: 0,
  transmutations: 0,
  fireMagic: 0,
  iceMagic: 0,
  airMagic: 0,
  earthMagic: 0,
  poisonMagic: 0,
  forgecraft: 0,
  alchemy: 0,
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
        /^(?:[O+*-]\s+)?Level\s+([0-9]+(?:\.[0-9])?)(?:\([0-9]+(?:\.[0-9])?\))?\s+(.+?)$/,
      )

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
  const skills: SkillsSnapshot = { ...DEFAULT_SKILLS }

  for (const entry of parsed) {
    const normalizedName = SKILL_NAME_MAP[entry.name.toLowerCase() as keyof typeof SKILL_NAME_MAP]

    // Ignore unknown skill labels so parser stays forward-compatible with
    // future Crawl skill table changes.
    if (!normalizedName) {
      continue
    }

    skills[normalizedName] = entry.level
  }

  return skills
}
