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
  it('extracts all skills at the top level from the skills section', () => {
    const parsed = extractSkills(loadFixture('reordered-sections.txt'))

    expect(parsed).toMatchObject({
      armourSkill: 2.3,
      dodgingSkill: 8.1,
      shieldSkill: 0,
      spellcasting: 12.4,
      conjurations: 11.2,
      fireMagic: 9.7,
      hexes: 0,
      fighting: 0,
      stealth: 0,
    })
    expect(parsed).not.toHaveProperty('schoolSkills')
  })

  it('extracts modern marked skill lines from full morgues', () => {
    const parsed = extractSkills(
      readFileSync(
        path.resolve(process.cwd(), 'test/fixtures/morgue/full/morgue-Moober-20260402-231943.txt'),
        'utf8',
      ),
    )

    expect(parsed).toMatchObject({
      fighting: 27,
      shortBlades: 20,
      longBlades: 20.8,
      macesFlails: 0.2,
      polearms: 0.4,
      staves: 0.2,
      rangedWeapons: 18.9,
      armourSkill: 10.6,
      dodgingSkill: 10.6,
      stealth: 10.9,
      spellcasting: 21.1,
      conjurations: 0.4,
      summonings: 0.2,
      translocations: 19.4,
      iceMagic: 0.2,
      evocations: 3.6,
      shapeshifting: 26,
    })
    expect(parsed).not.toHaveProperty('schoolSkills')
  })
})
