import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractEquipment } from '../../src/parser/extractEquipment'
import type { EquipmentPropertyBag } from '../../src/types'

function loadFixture(directory: 'success' | 'fail' | 'full', name: string) {
  return readFileSync(
    path.resolve(process.cwd(), `test/fixtures/morgue/${directory}/${name}`),
    'utf8',
  )
}

function bag(input: Partial<EquipmentPropertyBag> = {}): EquipmentPropertyBag {
  return {
    numeric: input.numeric ?? {},
    flags: input.flags ?? {},
    specials: input.specials ?? [],
  }
}

describe('extractEquipment', () => {
  it('keeps none for missing primary slots while parsing simple aux armour items', () => {
    const parsed = extractEquipment(loadFixture('success', 'body-armour-none.txt'))

    expect(parsed.bodyArmour).toBe('none')
    expect(parsed.shield).toBe('none')
    expect(parsed.footwear).toEqual(['pair of boots'])
    expect(parsed.helmets).toEqual(['hat'])
    expect(parsed.gloves).toEqual(['pair of gloves'])
    expect(parsed.cloaks).toEqual(['cloak'])

    expect(parsed.footwearDetails?.[0]).toMatchObject({
      objectClass: 'armour',
      equipState: 'worn',
      isCursed: false,
      baseType: 'boots',
      enchant: 0,
      artifactKind: 'normal',
      ego: null,
      properties: bag(),
    })
  })

  it('infers normal armour egos from explicit names and terse morgue stats', () => {
    const parsed = extractEquipment(loadFixture('full', 'morgue-midori369-20260406-191652.txt'))

    expect(parsed.shield).toBe('buckler of cold resistance')
    expect(parsed.footwear).toEqual(['pair of boots of flying'])
    expect(parsed.helmets).toEqual(['hat of intelligence'])
    expect(parsed.cloaks).toEqual(['cloak of willpower'])

    expect(parsed.shieldDetails).toMatchObject({
      objectClass: 'armour',
      equipState: 'worn',
      isCursed: false,
      baseType: 'buckler',
      enchant: 3,
      artifactKind: 'normal',
      ego: 'cold resistance',
      properties: bag({ numeric: { rC: 1 } }),
      egoProperties: bag({ numeric: { rC: 1 } }),
      artifactProperties: bag(),
    })

    expect(parsed.footwearDetails?.[0]).toMatchObject({
      baseType: 'boots',
      ego: 'flying',
      properties: bag({ flags: { Fly: true } }),
    })

    expect(parsed.helmetDetails?.[0]).toMatchObject({
      baseType: 'hat',
      ego: 'intelligence',
      properties: bag({ numeric: { Int: 3 } }),
    })
  })

  it('splits intrinsic and artifact properties for randart dragon scales', () => {
    const parsed = extractEquipment(loadFixture('full', 'morgue-midori369-20260406-191652.txt'))

    expect(parsed.bodyArmour).toBe('fire dragon scales of Undesirable Species')
    expect(parsed.bodyArmourDetails).toMatchObject({
      rawName: 'fire dragon scales of Undesirable Species',
      objectClass: 'armour',
      baseType: 'fire dragon scales',
      enchant: 8,
      artifactKind: 'randart',
      ego: null,
      intrinsicProperties: bag({ numeric: { rF: 2, rC: -1 } }),
      artifactProperties: bag({ numeric: { rN: 1, Will: 1, Int: 6, Slay: -5 } }),
      properties: bag({ numeric: { rF: 2, rC: -1, rN: 1, Will: 1, Int: 6, Slay: -5 } }),
    })
  })

  it('keeps combined properties alongside split sources for intrinsic randart armour bonuses', () => {
    const parsed = extractEquipment(loadFixture('full', 'morgue-FF96-20260407-041444.txt'))

    expect(parsed.bodyArmourDetails).toMatchObject({
      rawName: 'pearl dragon scales of Benevolence',
      baseType: 'pearl dragon scales',
      intrinsicProperties: bag({ numeric: { rN: 1 } }),
      artifactProperties: bag({ numeric: { rN: 1 } }),
      properties: bag({ numeric: { rN: 2 } }),
    })
  })

  it('keeps randart jewellery generic while preserving detailed properties', () => {
    const parsed = extractEquipment(loadFixture('full', 'morgue-midori369-20260406-191652.txt'))

    expect(parsed.amulet).toBe('amulet of magic regeneration')
    expect(parsed.rings).toEqual(['ring of wizardry', 'ring of the Byakko'])

    expect(parsed.amuletDetails).toMatchObject({
      objectClass: 'jewellery',
      baseType: 'amulet',
      artifactKind: 'normal',
      subtypeEffect: 'magic regeneration',
      intrinsicProperties: bag({ numeric: { RegenMP: 1 } }),
      properties: bag({ numeric: { RegenMP: 1 } }),
    })

    expect(parsed.ringDetails?.[0]).toMatchObject({
      baseType: 'ring',
      subtypeEffect: 'wizardry',
      properties: bag({ flags: { Wiz: true } }),
    })

    expect(parsed.ringDetails?.[1]).toMatchObject({
      rawName: 'ring of the Byakko',
      artifactKind: 'randart',
      properties: bag({
        numeric: { Will: -1 },
        flags: { rElec: true, rPois: true, rCorr: true, SInv: true },
      }),
      artifactProperties: bag({
        numeric: { Will: -1 },
        flags: { rElec: true, rPois: true, rCorr: true, SInv: true },
      }),
    })
  })

  it('keeps known unrand gloves by name while storing structured properties', () => {
    const parsed = extractEquipment(loadFixture('full', 'morgue-Tyrellia-20260406-181223.txt'))

    expect(parsed.gloves).toEqual(["Mad Mage's Maulers"])
    expect(parsed.glovesDetails?.[0]).toMatchObject({
      rawName: "Mad Mage's Maulers",
      displayName: "Mad Mage's Maulers",
      objectClass: 'armour',
      equipState: 'worn',
      isCursed: false,
      baseType: 'gloves',
      enchant: 3,
      artifactKind: 'unrand',
      properties: bag({ specials: ['Infuse+∞', 'VampMP', '-Cast'] }),
      artifactProperties: bag({ specials: ['Infuse+∞', 'VampMP', '-Cast'] }),
    })
  })

  it('continues parsing equipped items when descriptions are interleaved in inventory', () => {
    const parsed = extractEquipment(loadFixture('success', 'equipped-accessories-with-descriptions.txt'))

    expect(parsed.bodyArmour).toBe('pearl dragon scales "Petz"')
    expect(parsed.amulet).toBe('amulet of Vitality')
    expect(parsed.rings).toEqual(['ring of the Empty Page', 'ring "Veveor"'])
    expect(parsed.cloaks).toEqual(['cloak "Rafeal"'])

    expect(parsed.bodyArmourDetails?.intrinsicProperties).toEqual(bag({ numeric: { rN: 1 } }))
    expect(parsed.bodyArmourDetails?.artifactProperties).toEqual(
      bag({ numeric: { Regen: 1, Str: 2 }, flags: { SInv: true }, specials: ['^Drain'] }),
    )
    expect(parsed.amuletDetails?.artifactProperties).toEqual(
      bag({ numeric: { Regen: 2, RegenMP: 2 } }),
    )
  })

  it('keeps multiple haunted aux items for poltergeists instead of collapsing them', () => {
    const parsed = extractEquipment(loadFixture('full', 'morgue-Skeff-20260406-201301.txt'))

    expect(parsed.bodyArmour).toBe('none')
    expect(parsed.helmets).toEqual(['hat of Pondering'])
    expect(parsed.gloves).toEqual(['pair of gloves of dexterity'])
    expect(parsed.footwear).toEqual([
      'pair of boots',
      'pair of boots of flying',
      'pair of boots',
    ])
    expect(parsed.cloaks).toEqual(['cloak'])

    expect(parsed.footwearDetails?.map((item) => item.equipState)).toEqual([
      'haunted',
      'haunted',
      'haunted',
    ])
  })

  it('classifies cursed haunted gauntlets as gloves instead of body armour', () => {
    const parsed = extractEquipment(loadFixture('full', 'morgue-jkt-20260406-212621.txt'))

    expect(parsed.bodyArmour).toBe('none')
    expect(parsed.gloves).toEqual(['pair of gauntlets of War'])
    expect(parsed.glovesDetails?.[0]).toMatchObject({
      rawName: 'pair of gauntlets of War',
      displayName: 'gauntlets of War',
      equipState: 'haunted',
      isCursed: true,
      baseType: 'gloves',
      artifactKind: 'unrand',
    })
    expect(parsed.helmets).toEqual([
      'hat of the Chained Sun',
      'hat of Ashenzari\'s Gnosis',
    ])
    expect(parsed.cloaks).toEqual([
      'cloak of willpower',
      'scarf "Chained Fetters"',
      'cloak of Ashenzari\'s Failure',
    ])
  })

  it('recognizes known unrand shields even when the name does not include shield subtype text first', () => {
    const parsed = extractEquipment(`
Inventory:

Armour
 C - the +2 shield of Resistance (worn) {rF++ rC++ Will++}
   (You found it on level 3 of the Elven Halls)
`)

    expect(parsed.shield).toBe('shield of Resistance')
    expect(parsed.shieldDetails).toMatchObject({
      rawName: 'shield of Resistance',
      objectClass: 'armour',
      baseType: 'kite shield',
      artifactKind: 'unrand',
      properties: bag({ numeric: { rF: 2, rC: 2, Will: 2 } }),
      artifactProperties: bag({ numeric: { rF: 2, rC: 2, Will: 2 } }),
    })
  })

  it('preserves melded equipment and the equipped talisman slot', () => {
    const parsed = extractEquipment(loadFixture('success', 'melded-equipment-and-talisman.txt'))

    expect(parsed.bodyArmour).toBe('acid dragon scales "Discomfort of Ashenzari"')
    expect(parsed.helmets).toEqual(['helmet of the Shattered Mistrust'])
    expect(parsed.talisman).toBe('hive talisman "Wekitiug"')

    expect(parsed.bodyArmourDetails).toMatchObject({
      equipState: 'melded',
      isCursed: true,
      baseType: 'acid dragon scales',
      artifactKind: 'randart',
      intrinsicProperties: bag({ flags: { rCorr: true } }),
      artifactProperties: bag({ specials: ['Elem', 'Sorc'] }),
    })

    expect(parsed.helmetDetails?.[0]).toMatchObject({
      equipState: 'melded',
      isCursed: true,
      baseType: 'helmet',
      artifactKind: 'randart',
      artifactProperties: bag({ numeric: { Int: 3 }, specials: ['Comp', 'Sorc'] }),
    })

    expect(parsed.talismanDetails).toMatchObject({
      rawName: 'hive talisman "Wekitiug"',
      objectClass: 'talisman',
      equipState: 'worn',
      baseType: 'hive talisman',
      artifactKind: 'randart',
      properties: bag({ numeric: { rC: -1, Will: 3 }, flags: { rElec: true } }),
    })
  })
})
