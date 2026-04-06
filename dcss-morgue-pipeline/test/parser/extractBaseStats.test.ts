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
      version: '0.34',
      species: 'Djinni',
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
      version: '0.34',
      species: 'Barachi',
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
      version: 'trunk',
      species: 'Minotaur',
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
      version: '0.34',
      species: 'Demonspawn',
      ac: 4,
      ev: 11,
      sh: 0,
      strength: 8,
      intelligence: 17,
      dexterity: 13,
    })
  })
})
