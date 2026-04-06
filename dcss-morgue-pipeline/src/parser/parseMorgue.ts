import type { ParseFailureRecord, ParsedMorgueRecord, ServerId } from '../types'
import { extractBaseStats } from './extractBaseStats'
import { extractEquipment } from './extractEquipment'
import { extractMagicModifiers } from './extractMagicModifiers'
import { extractSkills } from './extractSkills'
import { extractSpells } from './extractSpells'
import { ParseFailure, validateStrict } from './validateStrict'

export type ParseMorgueMeta = {
  candidateId: string
  serverId: ServerId
  playerName: string
  sourceVersionLabel: string
  endedAt: string
  morgueUrl: string
}

export type ParseMorgueResult =
  | {
      ok: true
      record: ParsedMorgueRecord
    }
  | {
      ok: false
      failure: ParseFailureRecord
    }

export function parseMorgue(text: string, meta: ParseMorgueMeta): ParseMorgueResult {
  try {
    const record = validateStrict({
      ...meta,
      ...extractBaseStats(text),
      ...extractEquipment(text),
      ...extractSkills(text),
      ...extractMagicModifiers(text),
      spells: extractSpells(text),
    })

    return {
      ok: true,
      record,
    }
  } catch (error) {
    if (error instanceof ParseFailure) {
      return {
        ok: false,
        failure: {
          reason: error.reason,
          detail: error.detail,
        },
      }
    }

    return {
      ok: false,
      failure: {
        reason: 'unsupported_morgue_layout',
        detail: error instanceof Error ? error.message : String(error),
      },
    }
  }
}
