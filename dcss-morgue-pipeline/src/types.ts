export type TargetVersion = '0.34' | 'trunk'
export type MorgueVersion = string

export type ServerId = (typeof ACTIVE_SERVER_IDS)[number]

export type LogfileManifest = {
  url: string
  sourceVersionLabel: string
}

export type MorgueRule =
  | {
      kind: 'morgue-player-dir'
      baseUrl: string
    }
  | {
      kind: 'rawdata-player-dir'
      baseUrl: string
    }

export type ServerManifest = {
  id: ServerId
  host: string
  buckets: readonly TargetVersion[]
  logfiles: Record<TargetVersion, LogfileManifest>
  morgueRule: MorgueRule
}

export type LogfileOffsetRow = {
  serverId: ServerId
  version: TargetVersion
  logfileUrl: string
  byteOffset: number
  updatedAt: string
}

export type CandidateGame = {
  candidateId: string
  serverId: ServerId
  version: TargetVersion
  sourceVersionLabel: string
  playerName: string
  endMessage: string
  startedAt: string
  endedAt: string
  logfileUrl: string
  rawXlogLine: string
  discoveredAt: string
  sampledBootstrapAt: string | null
  sampledIncrementalAt: string | null
}

export type BaseStatsSnapshot = {
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

export type EquipmentItemSnapshot = {
  rawName: string
  displayName: string
  objectClass: EquipmentObjectClass
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
  helmet: string | undefined
  gloves: string | undefined
  footwear: string | undefined
  bootsOrBarding: boolean
  cloak: string | undefined
  orb: string | undefined
  amulet: string | undefined
  rings: string[]
  bodyArmourDetails?: EquipmentItemSnapshot
  shieldDetails?: EquipmentItemSnapshot
  helmetDetails?: EquipmentItemSnapshot
  glovesDetails?: EquipmentItemSnapshot
  footwearDetails?: EquipmentItemSnapshot
  cloakDetails?: EquipmentItemSnapshot
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

export type ParsedMorgueRecord = BaseStatsSnapshot &
  EquipmentSnapshot &
  SkillsSnapshot & {
    candidateId: string
    serverId: ServerId
    playerName: string
    sourceVersionLabel: string
    endedAt: string
    morgueUrl: string
    spells: SpellSnapshot[]
    mutations: MutationEntrySnapshot[]
  }

export type ParseFailureRecord = {
  reason: string
  detail: string | null
}

export type MorgueFetchStatus = 'success' | 'not_found' | 'timeout' | 'invalid' | 'error'

export type MorgueFetchRow = {
  candidateId: string
  morgueUrl: string
  fetchStatus: MorgueFetchStatus
  httpStatus: number | null
  localPath: string | null
  lastError: string | null
  fetchedAt: string
}

export type ParseSuccessRow = {
  candidateId: string
  parseStatus: 'success'
  parsedJson: unknown
  failureCode: null
  failureDetail: null
  parsedAt: string
}

export type ParseFailureRow = {
  candidateId: string
  parseStatus: 'failure'
  parsedJson: null
  failureCode: string
  failureDetail: string | null
  parsedAt: string
}

export type ParseResultRow = ParseSuccessRow | ParseFailureRow

export const ACTIVE_SERVER_IDS = [
  'CBRG',
  'CNC',
  'CDI',
  'CXC',
  'CBR2',
  'CAO',
  'LLD',
  'CPO',
] as const
