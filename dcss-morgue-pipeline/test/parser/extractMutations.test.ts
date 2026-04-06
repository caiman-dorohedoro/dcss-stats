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
        'horns 3',
        'retaliatory headbutt',
        'claws 3',
        'talons 2',
        'clever 1',
        'regeneration 1',
        'eyeballs 1',
        'jelly sensing items',
        'MP-powered wands',
        'efficient magic 1',
        'slime shroud',
        'feed off suffering 1',
      ],
    })
  })

  it('stops mutation parsing before orb and rune summary lines', () => {
    expect(extractMutations(loadFullFixture('morgue-knorpule3000-20260405-001540.txt'))).toEqual({
      mutations: [
        'sickness immunity',
        'big wings',
        'negative energy resistance 1',
        'electricity resistance',
        'torment resistance 1',
        'stone body',
        'devolution 1',
      ],
    })
  })
})
