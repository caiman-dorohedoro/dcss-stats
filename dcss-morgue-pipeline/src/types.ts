export type TargetVersion = '0.34' | 'trunk'

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
  version: TargetVersion
  species: string
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
    wizardry: number
    channel: number
    wildMagic: number
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
  'CUE',
  'CBR2',
  'CAO',
  'LLD',
  'CPO',
] as const
