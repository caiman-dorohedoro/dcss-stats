import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractBaseStats } from '../../src/parser/extractBaseStats'

function loadFixture(name: string) {
  return readFileSync(
    path.resolve(process.cwd(), `test/fixtures/morgue/success/${name}`),
    'utf8',
  )
}

describe('extractBaseStats', () => {
  it('extracts version/species/str/int/dex from a reordered morgue', () => {
    const parsed = extractBaseStats(loadFixture('reordered-sections.txt'))

    expect(parsed).toEqual({
      version: '0.34.1',
      species: 'Djinni',
      speciesVariant: null,
      background: 'Fire Elementalist',
      xl: 7,
      ac: 4,
      ev: 11,
      sh: 0,
      strength: 8,
      intelligence: 19,
      dexterity: 14,
    })
  })

  it('extracts base stats from a 0.34 webtiles quit morgue', () => {
    const parsed = extractBaseStats(loadFixture('cao-0.34-webtiles-quit.txt'))

    expect(parsed).toEqual({
      version: '0.34.0',
      species: 'Barachi',
      speciesVariant: null,
      background: 'Hunter',
      xl: 1,
      ac: 3,
      ev: 11,
      sh: 0,
      strength: 12,
      intelligence: 9,
      dexterity: 15,
    })
  })

  it('extracts base stats from a trunk webtiles death morgue', () => {
    const parsed = extractBaseStats(loadFixture('cao-trunk-webtiles-death.txt'))

    expect(parsed).toEqual({
      version: '0.35-a0-181-g84ebf06',
      species: 'Minotaur',
      speciesVariant: null,
      background: 'Berserker',
      xl: 9,
      ac: 14,
      ev: 6,
      sh: 0,
      strength: 25,
      intelligence: 4,
      dexterity: 11,
    })
  })

  it('prefers the full began-as line when the title line uses species/background abbreviations', () => {
    const parsed = extractBaseStats(loadFixture('demonspawn-abbrev-title.txt'))

    expect(parsed).toEqual({
      version: '0.34.0',
      species: 'Demonspawn',
      speciesVariant: null,
      background: 'Necromancer',
      xl: 3,
      ac: 4,
      ev: 11,
      sh: 0,
      strength: 8,
      intelligence: 17,
      dexterity: 13,
    })
  })

  it('normalizes colored draconian descriptors while preserving the variant', () => {
    const parsed = extractBaseStats(loadFixture('colored-draconian.txt'))

    expect(parsed).toEqual({
      version: '0.35-a0-257-gf9e06672e4',
      species: 'Draconian',
      speciesVariant: 'White Draconian',
      background: 'Summoner',
      xl: 12,
      ac: 11,
      ev: 11,
      sh: 0,
      strength: 16,
      intelligence: 25,
      dexterity: 19,
    })
  })
})
