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
  it('extracts required skills and school skills from the skills section', () => {
    const parsed = extractSkills(loadFixture('reordered-sections.txt'))

    expect(parsed).toEqual({
      armourSkill: 2.3,
      dodgingSkill: 8.1,
      shieldSkill: 0,
      spellcasting: 12.4,
      schoolSkills: {
        conjurations: 11.2,
        fireMagic: 9.7,
        hexes: 0,
      },
    })
  })
})
