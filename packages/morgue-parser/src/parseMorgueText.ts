import type { ParseMorgueTextOptions, ParseMorgueTextResult } from './types'
import { extractBaseStats } from './extractBaseStats'
import { extractEquipment } from './extractEquipment'
import { extractMagicModifiers } from './extractMagicModifiers'
import { extractSkills } from './extractSkills'
import { extractSpells } from './extractSpells'
import { ParseFailure, validateStrict } from './validateStrict'

export function parseMorgueText(text: string, options: ParseMorgueTextOptions = {}): ParseMorgueTextResult {
  try {
    const record = validateStrict({
      ...extractBaseStats(text, { speciesNames: options.speciesNames }),
      ...extractEquipment(text),
      ...extractSkills(text),
      ...extractMagicModifiers(text),
      spells: extractSpells(text, {
        canonicalSpellNames: options.canonicalSpellNames,
      }),
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
