import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractSpells } from '../../src/parser/extractSpells'

function loadFixture(name: string) {
  return readFileSync(
    path.resolve(process.cwd(), `test/fixtures/morgue/success/${name}`),
    'utf8',
  )
}

describe('extractSpells', () => {
  it('extracts all listed spells and failure percentages, including unmemorized entries', () => {
    const spells = extractSpells(loadFixture('spell-list-full.txt'))

    expect(spells).toContainEqual({
      name: 'Fireball',
      failurePercent: 12,
      memorized: false,
    })
  })

  it('extracts memorized and spell-library entries from the modern spell table layout', () => {
    const spells = extractSpells(loadFixture('spell-library-table-full.txt'))

    expect(spells).toContainEqual({
      name: 'Flame Wave',
      failurePercent: 3,
      memorized: true,
    })

    expect(spells).toContainEqual({
      name: 'Fireball',
      failurePercent: 12,
      memorized: false,
    })

    expect(spells).toContainEqual({
      name: 'Blink',
      failurePercent: 22,
      memorized: false,
    })
  })

  it('extracts failure percentages from a realistic spell library table', () => {
    const spells = extractSpells(loadFixture('spell-library-table-realistic.txt'))

    expect(spells).toContainEqual({
      name: 'Sandblast',
      failurePercent: 0,
      memorized: false,
    })

    expect(spells).toContainEqual({
      name: 'Fireball',
      failurePercent: 13,
      memorized: false,
    })

    expect(spells).toContainEqual({
      name: 'Freezing Cloud',
      failurePercent: 32,
      memorized: false,
    })

    expect(spells).toContainEqual({
      name: "Iskenderun's Mystic Bla",
      failurePercent: 17,
      memorized: false,
    })
  })
})
