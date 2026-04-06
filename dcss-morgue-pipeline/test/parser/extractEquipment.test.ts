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
      footwear: 'pair of boots',
      orb: 'none',
      amulet: 'none',
      rings: [],
      footwearDetails: {
        rawName: 'pair of boots',
        displayName: 'pair of boots',
        artifactKind: 'normal',
        modifiersText: null,
        modifiers: [],
      },
      ringDetails: [],
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
      footwear: 'pair of boots',
      orb: 'none',
      amulet: 'none',
      rings: [],
      bodyArmourDetails: {
        rawName: 'robe of Willpower',
        displayName: 'robe',
        artifactKind: 'normal',
        modifiersText: null,
        modifiers: [],
      },
      shieldDetails: {
        rawName: 'buckler',
        displayName: 'buckler',
        artifactKind: 'normal',
        modifiersText: null,
        modifiers: [],
      },
      footwearDetails: {
        rawName: 'pair of boots',
        displayName: 'pair of boots',
        artifactKind: 'normal',
        modifiersText: null,
        modifiers: [],
      },
      ringDetails: [],
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
      footwear: 'none',
      orb: 'none',
      amulet: 'amulet of reflection',
      rings: ['ring of dexterity'],
      amuletDetails: {
        rawName: 'amulet of reflection',
        displayName: 'amulet of reflection',
        artifactKind: 'normal',
        modifiersText: null,
        modifiers: [],
      },
      ringDetails: [
        {
          rawName: 'ring of dexterity',
          displayName: 'ring of dexterity',
          artifactKind: 'normal',
          modifiersText: null,
          modifiers: [],
        },
      ],
      helmet: true,
      gloves: false,
      bootsOrBarding: false,
      cloak: true,
    })
  })

  it('detects non-basic body armour like dragon scales instead of falling back to none', () => {
    const parsed = extractEquipment(loadFixture('success', 'dragon-scales-body-armour.txt'))

    expect(parsed).toEqual({
      bodyArmour: 'pearl dragon scales',
      shield: 'none',
      footwear: "Black Knight's barding",
      orb: 'orb of mayhem',
      amulet: 'none',
      rings: [],
      bodyArmourDetails: {
        rawName: 'pearl dragon scales "Petz"',
        displayName: 'pearl dragon scales',
        artifactKind: 'randart',
        modifiersText: '^Drain rN+ Regen+ Str+2 SInv',
        modifiers: ['^Drain', 'rN+', 'Regen+', 'Str+2', 'SInv'],
      },
      footwearDetails: {
        rawName: "Black Knight's barding",
        displayName: "Black Knight's barding",
        artifactKind: 'unrand',
        modifiersText: 'Ponderous, rPois rN+',
        modifiers: ['Ponderous', 'rPois', 'rN+'],
      },
      orbDetails: {
        rawName: 'orb of mayhem',
        displayName: 'orb of mayhem',
        artifactKind: 'normal',
        modifiersText: null,
        modifiers: [],
      },
      ringDetails: [],
      helmet: true,
      gloves: true,
      bootsOrBarding: true,
      cloak: true,
    })
  })

  it('extracts orb, amulet, rings, and footwear item names from equipped slots', () => {
    const parsed = extractEquipment(loadFixture('success', 'equipped-accessories.txt'))

    expect(parsed).toEqual({
      bodyArmour: 'pearl dragon scales',
      shield: 'none',
      footwear: "Black Knight's barding",
      orb: 'orb of mayhem',
      amulet: 'amulet of Vitality',
      rings: ['randart ring', 'randart ring'],
      bodyArmourDetails: {
        rawName: 'pearl dragon scales "Petz"',
        displayName: 'pearl dragon scales',
        artifactKind: 'randart',
        modifiersText: '^Drain rN+ Regen+ Str+2 SInv',
        modifiers: ['^Drain', 'rN+', 'Regen+', 'Str+2', 'SInv'],
      },
      footwearDetails: {
        rawName: "Black Knight's barding",
        displayName: "Black Knight's barding",
        artifactKind: 'unrand',
        modifiersText: 'Ponderous, rPois rN+',
        modifiers: ['Ponderous', 'rPois', 'rN+'],
      },
      orbDetails: {
        rawName: 'orb of mayhem',
        displayName: 'orb of mayhem',
        artifactKind: 'normal',
        modifiersText: null,
        modifiers: [],
      },
      amuletDetails: {
        rawName: 'amulet of Vitality',
        displayName: 'amulet of Vitality',
        artifactKind: 'unrand',
        modifiersText: 'Regen++ RegenMP++',
        modifiers: ['Regen++', 'RegenMP++'],
      },
      ringDetails: [
        {
          rawName: 'ring "Veveor"',
          displayName: 'randart ring',
          artifactKind: 'randart',
          modifiersText: 'rElec Will+ MP+4 Int+3 Slay+4',
          modifiers: ['rElec', 'Will+', 'MP+4', 'Int+3', 'Slay+4'],
        },
        {
          rawName: 'ring of the Empty Page',
          displayName: 'randart ring',
          artifactKind: 'randart',
          modifiersText: 'rF+ rN+ AC+4 Stlth+',
          modifiers: ['rF+', 'rN+', 'AC+4', 'Stlth+'],
        },
      ],
      helmet: true,
      gloves: true,
      bootsOrBarding: true,
      cloak: true,
    })
  })

  it('keeps parsing equipped items when inventory descriptions are interleaved between entries', () => {
    const parsed = extractEquipment(loadFixture('success', 'equipped-accessories-with-descriptions.txt'))

    expect(parsed).toEqual({
      bodyArmour: 'pearl dragon scales',
      shield: 'none',
      footwear: "Black Knight's barding",
      orb: 'orb of mayhem',
      amulet: 'amulet of Vitality',
      rings: ['randart ring', 'randart ring'],
      bodyArmourDetails: {
        rawName: 'pearl dragon scales "Petz"',
        displayName: 'pearl dragon scales',
        artifactKind: 'randart',
        modifiersText: '^Drain rN+ Regen+ Str+2 SInv',
        modifiers: ['^Drain', 'rN+', 'Regen+', 'Str+2', 'SInv'],
      },
      footwearDetails: {
        rawName: "Black Knight's barding",
        displayName: "Black Knight's barding",
        artifactKind: 'unrand',
        modifiersText: 'Ponderous, rPois rN+',
        modifiers: ['Ponderous', 'rPois', 'rN+'],
      },
      orbDetails: {
        rawName: 'orb of mayhem',
        displayName: 'orb of mayhem',
        artifactKind: 'normal',
        modifiersText: null,
        modifiers: [],
      },
      amuletDetails: {
        rawName: 'amulet of Vitality',
        displayName: 'amulet of Vitality',
        artifactKind: 'unrand',
        modifiersText: 'Regen++ RegenMP++',
        modifiers: ['Regen++', 'RegenMP++'],
      },
      ringDetails: [
        {
          rawName: 'ring of the Empty Page',
          displayName: 'randart ring',
          artifactKind: 'randart',
          modifiersText: 'rF+ rN+ AC+4 Stlth+',
          modifiers: ['rF+', 'rN+', 'AC+4', 'Stlth+'],
        },
        {
          rawName: 'ring "Veveor"',
          displayName: 'randart ring',
          artifactKind: 'randart',
          modifiersText: 'rElec Will+ MP+4 Int+3 Slay+4',
          modifiers: ['rElec', 'Will+', 'MP+4', 'Int+3', 'Slay+4'],
        },
      ],
      helmet: true,
      gloves: true,
      bootsOrBarding: true,
      cloak: true,
    })
  })
})
