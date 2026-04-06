import {
  canonicalizeSpellNames,
  extractSpells as extractSpellsCore,
} from '../../../packages/morgue-parser/src/index'
import type { SpellSnapshot } from '../types'
import { loadCanonicalSpellNamesFromCrawl } from './loadCanonicalSpellNamesFromCrawl'

export { canonicalizeSpellNames }

export function extractSpells(
  text: string,
  options?: {
    canonicalSpellNames?: readonly string[]
  },
): SpellSnapshot[] {
  return extractSpellsCore(text, {
    canonicalSpellNames: options?.canonicalSpellNames ?? loadCanonicalSpellNamesFromCrawl(),
  })
}
