import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CANONICAL_SPELL_PATH_CANDIDATES = [
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../crawl/crawl-ref/source/spl-data.h',
  ),
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../crawl/crawl-ref/source/spl-data.h',
  ),
] as const

let cachedCanonicalSpellNames: string[] | null = null

export function loadCanonicalSpellNamesFromCrawl(): string[] {
  if (cachedCanonicalSpellNames) {
    return cachedCanonicalSpellNames
  }

  const spellDataPath = CANONICAL_SPELL_PATH_CANDIDATES.find((candidatePath) => existsSync(candidatePath))

  if (!spellDataPath) {
    cachedCanonicalSpellNames = []
    return cachedCanonicalSpellNames
  }

  const spellDataText = readFileSync(spellDataPath, 'utf8')
  const matches = spellDataText.matchAll(/SPELL_[A-Z0-9_]+,\s+"([^"]+)"/g)
  const uniqueNames = new Set<string>()

  for (const match of matches) {
    const name = match[1]?.trim()

    if (!name) {
      continue
    }

    uniqueNames.add(name)
  }

  cachedCanonicalSpellNames = [...uniqueNames]
  return cachedCanonicalSpellNames
}
