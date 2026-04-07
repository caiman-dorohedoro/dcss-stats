import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { canonicalizeSpellNames, extractSpells } from '../../src/parser/extractSpells'

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
      name: "Iskenderun's Mystic Blast",
      failurePercent: 17,
      memorized: false,
    })
  })

  it('restores canonical names when the morgue table truncates long spell names', () => {
    const parsed = extractSpells(loadFixture('spell-library-table-realistic.txt'), {
      canonicalSpellNames: [
        "Iskenderun's Mystic Blast",
        'Construct Spike Launcher',
        "Eringya's Surprising Crocodile",
        "Borgnjor's Revivification",
      ],
    })

    expect(parsed).toContainEqual({
      name: "Iskenderun's Mystic Blast",
      failurePercent: 17,
      memorized: false,
    })
  })

  it('leaves ambiguous prefixes unchanged', () => {
    const spells = canonicalizeSpellNames(
      [
        {
          name: 'Blink',
          failurePercent: 10,
          memorized: false,
        },
      ],
      ['Blink', 'Blink Range', 'Blink Away'],
    )

    expect(spells).toEqual([
      {
        name: 'Blink',
        failurePercent: 10,
        memorized: false,
      },
    ])
  })

  it('strips uppercase memorized hotkeys from modern spell tables', () => {
    const spells = extractSpells(loadFullFixture('morgue-jkt-20260404-065348.txt'))

    expect(spells).toContainEqual({
      name: "Dragon's Call",
      failurePercent: 4,
      memorized: true,
    })
  })
})
