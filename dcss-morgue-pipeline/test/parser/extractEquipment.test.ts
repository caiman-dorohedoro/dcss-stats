import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractEquipment } from '../../src/parser/extractEquipment'

function loadFixture(directory: 'success' | 'fail', name: string) {
  return readFileSync(
    path.resolve(process.cwd(), `test/fixtures/morgue/${directory}/${name}`),
    'utf8',
  )
}

describe('extractEquipment', () => {
  it('returns bodyArmour=none and shield=none when no worn item is present', () => {
    const parsed = extractEquipment(loadFixture('success', 'body-armour-none.txt'))

    expect(parsed).toEqual({
      bodyArmour: 'none',
      shield: 'none',
      helmet: true,
      gloves: true,
      bootsOrBarding: true,
      cloak: true,
    })
  })

  it('extracts canonical equipment labels and slot booleans', () => {
    const parsed = extractEquipment(loadFixture('success', 'reordered-sections.txt'))

    expect(parsed).toEqual({
      bodyArmour: 'robe',
      shield: 'buckler',
      helmet: true,
      gloves: true,
      bootsOrBarding: true,
      cloak: false,
    })
  })

  it('treats haunted aux armour as equipped without mistaking jewellery for body armour', () => {
    const parsed = extractEquipment(loadFixture('success', 'poltergeist-aux-armour.txt'))

    expect(parsed).toEqual({
      bodyArmour: 'none',
      shield: 'none',
      helmet: true,
      gloves: false,
      bootsOrBarding: false,
      cloak: true,
    })
  })
})
