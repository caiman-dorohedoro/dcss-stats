import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractSkills } from '../../src/parser/extractSkills'

function loadFixture(name: string) {
  return readFileSync(
    path.resolve(process.cwd(), `test/fixtures/morgue/success/${name}`),
    'utf8',
  )
}

describe('extractSkills', () => {
  it('extracts all skills under the nested skills object', () => {
    const parsed = extractSkills(loadFixture('reordered-sections.txt'))

    expect(parsed).toMatchObject({
      skills: {
        armour: 2.3,
        dodging: 8.1,
        shields: 0,
        spellcasting: 12.4,
        conjurations: 11.2,
        fireMagic: 9.7,
        hexes: 0,
        fighting: 0,
        stealth: 0,
      },
      effectiveSkills: {
        armour: 2.3,
        dodging: 8.1,
        shields: 0,
        spellcasting: 12.4,
        conjurations: 11.2,
        fireMagic: 9.7,
        hexes: 0,
        fighting: 0,
        stealth: 0,
      },
    })
  })

  it('extracts modern marked skill lines from full morgues', () => {
    const parsed = extractSkills(
      readFileSync(
        path.resolve(process.cwd(), 'test/fixtures/morgue/full/morgue-Moober-20260402-231943.txt'),
        'utf8',
      ),
    )

    expect(parsed).toMatchObject({
      skills: {
        fighting: 27,
        shortBlades: 20,
        longBlades: 20.8,
        macesFlails: 0.2,
        polearms: 0.4,
        staves: 0.2,
        rangedWeapons: 18.9,
        armour: 10.6,
        dodging: 10.6,
        stealth: 10.9,
        spellcasting: 21.1,
        conjurations: 0.4,
        summonings: 0.2,
        translocations: 19.4,
        iceMagic: 0.2,
        evocations: 3.6,
        shapeshifting: 26,
      },
      effectiveSkills: {
        fighting: 27,
        shortBlades: 23.5,
        longBlades: 23.8,
        macesFlails: 0.3,
        polearms: 0.5,
        staves: 0.4,
        rangedWeapons: 18.9,
        armour: 10.6,
        dodging: 10.6,
        stealth: 10.9,
        spellcasting: 21.1,
        conjurations: 0.4,
        summonings: 0.2,
        translocations: 19.4,
        iceMagic: 0.2,
        evocations: 3.6,
        shapeshifting: 26,
      },
    })
  })

  it('extracts effective skills from parenthesized Ashenzari values', () => {
    const parsed = extractSkills(
      readFileSync(
        path.resolve(process.cwd(), 'test/fixtures/morgue/full/morgue-jkt-20260406-212621.txt'),
        'utf8',
      ),
    )

    expect(parsed.skills.fighting).toBe(15.2)
    expect(parsed.effectiveSkills.fighting).toBe(19.5)
    expect(parsed.skills.spellcasting).toBe(10.4)
    expect(parsed.effectiveSkills.spellcasting).toBe(14.7)
    expect(parsed.skills.iceMagic).toBe(2)
    expect(parsed.effectiveSkills.iceMagic).toBe(2)
  })
})
