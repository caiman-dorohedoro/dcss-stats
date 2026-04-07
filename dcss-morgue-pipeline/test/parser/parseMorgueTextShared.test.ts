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

function loadFullFixture(name: string) {
  return readFileSync(
    path.resolve(process.cwd(), `test/fixtures/morgue/full/${name}`),
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
      expect(result.record.mutations).toEqual([
        { name: 'amphibious', level: null },
        { name: 'frog-like legs', level: 1 },
        { name: '+LOS', level: null },
      ])
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

  it('restores truncated spell names through parseMorgueText defaults', () => {
    const result = parseMorgueText(loadFullFixture('morgue-knorpule3000-20260405-001540.txt'))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.record.spells).toContainEqual({
        name: "Lehudib's Crystal Spear",
        failurePercent: 7,
        memorized: true,
      })
      expect(result.record.spells).toContainEqual({
        name: "Nazja's Percussive Tempering",
        failurePercent: 1,
        memorized: true,
      })
      expect(result.record.spells).toContainEqual({
        name: "Lee's Rapid Deconstruction",
        failurePercent: 1,
        memorized: true,
      })
      expect(result.record.spells).toContainEqual({
        name: "Brom's Barrelling Boulder",
        failurePercent: 0,
        memorized: false,
      })
      expect(result.record.spells).toContainEqual({
        name: "Iskenderun's Battlesphere",
        failurePercent: 1,
        memorized: false,
      })
      expect(result.record.spells).toContainEqual({
        name: "Iskenderun's Mystic Blast",
        failurePercent: 1,
        memorized: false,
      })
    }
  })

  it('normalizes uppercase spell hotkeys and legacy parenthesized mutations from full morgues', () => {
    const spellResult = parseMorgueText(loadFullFixture('morgue-jkt-20260404-065348.txt'))
    const mutationResult = parseMorgueText(loadFullFixture('morgue-exant-20260406-220016.txt'))

    expect(spellResult.ok).toBe(true)
    if (spellResult.ok) {
      expect(spellResult.record.spells).toContainEqual({
        name: "Dragon's Call",
        failurePercent: 4,
        memorized: true,
      })
    }

    expect(mutationResult.ok).toBe(true)
    if (mutationResult.ok) {
      expect(mutationResult.record.mutations).toContainEqual({
        name: 'nimble swimmer',
        level: 1,
      })
    }
  })
})
