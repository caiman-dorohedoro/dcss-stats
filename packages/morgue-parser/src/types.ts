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
export type EquipmentObjectClass = 'armour' | 'jewellery'
export type EquipmentEquipState = 'worn' | 'haunted'

export type EquipmentItemSnapshot = {
  rawName: string
  displayName: string
  objectClass: EquipmentObjectClass
  equipState: EquipmentEquipState
  isCursed: boolean
  baseType: string | null
  enchant: number | null
  artifactKind: ArtifactKind
  ego: string | null
  subtypeEffect: string | null
  propertiesText: string | null
  properties: string[]
  intrinsicProperties: string[]
  egoProperties: string[]
  artifactProperties: string[]
}

export type EquipmentSnapshot = {
  bodyArmour: string | undefined
  shield: string | undefined
  helmets: string[]
  gloves: string[]
  footwear: string[]
  bootsOrBarding: boolean
  cloaks: string[]
  orb: string | undefined
  amulet: string | undefined
  rings: string[]
  bodyArmourDetails?: EquipmentItemSnapshot
  shieldDetails?: EquipmentItemSnapshot
  helmetDetails?: EquipmentItemSnapshot[]
  glovesDetails?: EquipmentItemSnapshot[]
  footwearDetails?: EquipmentItemSnapshot[]
  cloakDetails?: EquipmentItemSnapshot[]
  orbDetails?: EquipmentItemSnapshot
  amuletDetails?: EquipmentItemSnapshot
  ringDetails?: EquipmentItemSnapshot[]
}

export type SkillLevelsSnapshot = {
  fighting: number
  macesFlails: number
  axes: number
  polearms: number
  staves: number
  unarmedCombat: number
  throwing: number
  shortBlades: number
  longBlades: number
  rangedWeapons: number
  armour: number
  dodging: number
  shields: number
  stealth: number
  spellcasting: number
  conjurations: number
  hexes: number
  summonings: number
  necromancy: number
  forgecraft: number
  translocations: number
  transmutations: number
  alchemy: number
  fireMagic: number
  iceMagic: number
  airMagic: number
  earthMagic: number
  poisonMagic: number
  invocations: number
  evocations: number
  shapeshifting: number
}

export type SkillsSnapshot = {
  skills: SkillLevelsSnapshot
  effectiveSkills: SkillLevelsSnapshot
}

export type SpellSnapshot = {
  name: string
  failurePercent: number
  memorized: boolean
}

export type MutationEntrySnapshot = {
  name: string
  level: number | null
}

export type MutationSnapshot = {
  mutations: MutationEntrySnapshot[]
}

export type ParsedMorgueTextRecord = BaseStatsSnapshot & {
  bodyArmour: string
  shield: string
  helmets: string[]
  gloves: string[]
  footwear: string[]
  bootsOrBarding: boolean
  cloaks: string[]
  orb: string
  amulet: string
  rings: string[]
  bodyArmourDetails?: EquipmentItemSnapshot
  shieldDetails?: EquipmentItemSnapshot
  helmetDetails?: EquipmentItemSnapshot[]
  glovesDetails?: EquipmentItemSnapshot[]
  footwearDetails?: EquipmentItemSnapshot[]
  cloakDetails?: EquipmentItemSnapshot[]
  orbDetails?: EquipmentItemSnapshot
  amuletDetails?: EquipmentItemSnapshot
  ringDetails?: EquipmentItemSnapshot[]
  skills: SkillLevelsSnapshot
  effectiveSkills: SkillLevelsSnapshot
  spells: SpellSnapshot[]
  mutations: MutationEntrySnapshot[]
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
