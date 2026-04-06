export type MorgueVersion = string

export type BaseStatsSnapshot = {
  playerName: string | null
  version: MorgueVersion
  species: string
  ac: number
  ev: number
  sh: number
  strength: number
  intelligence: number
  dexterity: number
}

export type ArtifactKind = 'normal' | 'randart' | 'unrand'

export type EquipmentItemSnapshot = {
  rawName: string
  displayName: string
  artifactKind: ArtifactKind
  modifiersText: string | null
  modifiers: string[]
}

export type EquipmentSnapshot = {
  bodyArmour: string | undefined
  shield: string | undefined
  footwear: string | undefined
  orb: string | undefined
  amulet: string | undefined
  rings: string[]
  bodyArmourDetails?: EquipmentItemSnapshot
  shieldDetails?: EquipmentItemSnapshot
  footwearDetails?: EquipmentItemSnapshot
  orbDetails?: EquipmentItemSnapshot
  amuletDetails?: EquipmentItemSnapshot
  ringDetails?: EquipmentItemSnapshot[]
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
}

export type MutationSnapshot = {
  mutations: string[]
}

export type ParsedMorgueTextRecord = BaseStatsSnapshot & {
  bodyArmour: string
  shield: string
  footwear: string
  orb: string
  amulet: string
  rings: string[]
  bodyArmourDetails?: EquipmentItemSnapshot
  shieldDetails?: EquipmentItemSnapshot
  footwearDetails?: EquipmentItemSnapshot
  orbDetails?: EquipmentItemSnapshot
  amuletDetails?: EquipmentItemSnapshot
  ringDetails?: EquipmentItemSnapshot[]
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
  mutations: string[]
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
