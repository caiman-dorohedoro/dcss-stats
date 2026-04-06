export type TargetVersion = '0.34' | 'trunk'

export type BaseStatsSnapshot = {
  playerName: string | null
  version: TargetVersion
  species: string
  ac: number
  ev: number
  sh: number
  strength: number
  intelligence: number
  dexterity: number
}

export type EquipmentSnapshot = {
  bodyArmour: string | undefined
  shield: string | undefined
  helmet: boolean
  gloves: boolean
  bootsOrBarding: boolean
  cloak: boolean
}

export type SkillsSnapshot = {
  armourSkill: number
  dodgingSkill: number
  shieldSkill: number
  spellcasting: number
  schoolSkills: Record<string, number>
}

export type SpellSnapshot = {
  name: string
  failurePercent: number
  memorized: boolean
}

export type MagicModifiersSnapshot = {
  wizardry: number | undefined
  channel: number | undefined
  wildMagic: number | undefined
}

export type ParsedMorgueTextRecord = BaseStatsSnapshot & {
  bodyArmour: string
  shield: string
  helmet: boolean
  gloves: boolean
  bootsOrBarding: boolean
  cloak: boolean
  armourSkill: number
  dodgingSkill: number
  shieldSkill: number
  spellcasting: number
  schoolSkills: Record<string, number>
  spells: SpellSnapshot[]
  wizardry: number
  channel: number
  wildMagic: number
}

export type ParseFailureRecord = {
  reason: string
  detail: string | null
}

export type ParseMorgueTextOptions = {
  speciesNames?: readonly string[]
  canonicalSpellNames?: readonly string[]
}

export type ParseMorgueTextResult =
  | {
      ok: true
      record: ParsedMorgueTextRecord
    }
  | {
      ok: false
      failure: ParseFailureRecord
    }
