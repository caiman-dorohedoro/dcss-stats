import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractMagicModifiers } from '../../src/parser/extractMagicModifiers'

function loadFixture(name: string) {
  return readFileSync(
    path.resolve(process.cwd(), `test/fixtures/morgue/success/${name}`),
    'utf8',
  )
}

describe('extractMagicModifiers', () => {
  it('extracts wizardry modifiers', () => {
    expect(extractMagicModifiers(loadFixture('reordered-sections.txt'))).toEqual({
      wizardry: 1,
    })
  })
})
