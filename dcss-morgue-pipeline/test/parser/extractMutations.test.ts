import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractMutations } from '../../src/parser/extractMutations'

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

describe('extractMutations', () => {
  it('extracts terse innate traits from the wrapped A: line', () => {
    expect(extractMutations(loadFixture('mutations-wrapped-a-line.txt'))).toEqual({
      mutations: [
        { name: 'horns', level: 3 },
        { name: 'retaliatory headbutt', level: null },
        { name: 'claws', level: 3 },
        { name: 'talons', level: 2 },
        { name: 'clever', level: 1 },
        { name: 'regeneration', level: 1 },
        { name: 'eyeballs', level: 1 },
        { name: 'jelly sensing items', level: null },
        { name: 'MP-powered wands', level: null },
        { name: 'efficient magic', level: 1 },
        { name: 'slime shroud', level: null },
        { name: 'feed off suffering', level: 1 },
      ],
    })
  })

  it('stops mutation parsing before orb and rune summary lines', () => {
    expect(extractMutations(loadFullFixture('morgue-knorpule3000-20260405-001540.txt'))).toEqual({
      mutations: [
        { name: 'sickness immunity', level: null },
        { name: 'big wings', level: null },
        { name: 'negative energy resistance', level: 1 },
        { name: 'electricity resistance', level: null },
        { name: 'torment resistance', level: 1 },
        { name: 'stone body', level: null },
        { name: 'devolution', level: 1 },
      ],
    })
  })

  it('normalizes parenthesized legacy mutation entries into leveled traits', () => {
    expect(extractMutations(loadFullFixture('morgue-exant-20260406-220016.txt'))).toEqual({
      mutations: [
        { name: 'almost no armour', level: null },
        { name: 'amphibious', level: null },
        { name: '8 rings', level: null },
        { name: 'camouflage', level: 1 },
        { name: 'gelatinous body', level: 1 },
        { name: 'nimble swimmer', level: 1 },
        { name: 'tentacles', level: null },
      ],
    })
  })
})
