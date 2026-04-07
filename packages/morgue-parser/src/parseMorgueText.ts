import type { ParseMorgueTextOptions, ParseMorgueTextResult } from './types'
import { extractBaseStats } from './extractBaseStats'
import { extractEquipment } from './extractEquipment'
import { extractMutations } from './extractMutations'
import { extractSkills } from './extractSkills'
import { extractSpells } from './extractSpells'
import { ParseFailure, validateStrict } from './validateStrict'

export function parseMorgueText(text: string, options: ParseMorgueTextOptions = {}): ParseMorgueTextResult {
  try {
    const record = validateStrict({
      ...extractBaseStats(text, { speciesNames: options.speciesNames }),
      ...extractEquipment(text),
      ...extractSkills(text),
      ...extractMutations(text),
      spells: extractSpells(text, {
        canonicalSpellNames: options.canonicalSpellNames,
      }),
    })

    const orderedRecord = {
      playerName: record.playerName,
      version: record.version,
      species: record.species,
      ac: record.ac,
      ev: record.ev,
      sh: record.sh,
      strength: record.strength,
      intelligence: record.intelligence,
      dexterity: record.dexterity,
      bodyArmour: record.bodyArmour,
      shield: record.shield,
      helmet: record.helmet,
      gloves: record.gloves,
      footwear: record.footwear,
      bootsOrBarding: record.bootsOrBarding,
      cloak: record.cloak,
      orb: record.orb,
      amulet: record.amulet,
      rings: record.rings,
      bodyArmourDetails: record.bodyArmourDetails,
      shieldDetails: record.shieldDetails,
      helmetDetails: record.helmetDetails,
      glovesDetails: record.glovesDetails,
      footwearDetails: record.footwearDetails,
      cloakDetails: record.cloakDetails,
      orbDetails: record.orbDetails,
      amuletDetails: record.amuletDetails,
      ringDetails: record.ringDetails,
      skills: record.skills,
      spells: record.spells,
      mutations: record.mutations,
    }

    return {
      ok: true,
      record: orderedRecord,
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
