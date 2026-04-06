import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractSpells, parseMorgueText } from '../../../packages/morgue-parser/src/index'

function loadFixture(name: string) {
  return readFileSync(
    path.resolve(process.cwd(), `test/fixtures/morgue/success/${name}`),
    'utf8',
  )
}

describe('parseMorgueText shared parser', () => {
  it('parses browser-safe structured data directly from morgue text', () => {
    const result = parseMorgueText(loadFixture('cao-0.34-webtiles-quit.txt'))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.record.playerName).toBe('EnsignRicky')
      expect(result.record.species).toBe('Barachi')
      expect(result.record.ac).toBe(3)
      expect(result.record.ev).toBe(11)
      expect(result.record.sh).toBe(0)
      expect(result.record.spells).toEqual([])
    }
  })

  it('restores canonical spell names when callers provide a browser-safe spell vocabulary', () => {
    const spells = extractSpells(loadFixture('spell-library-table-realistic.txt'), {
      canonicalSpellNames: [
        "Iskenderun's Mystic Blast",
        'Construct Spike Launcher',
        "Eringya's Surprising Crocodile",
        "Borgnjor's Revivification",
      ],
    })

    expect(spells).toContainEqual({
      name: "Iskenderun's Mystic Blast",
      failurePercent: 17,
      memorized: false,
    })
  })
})
