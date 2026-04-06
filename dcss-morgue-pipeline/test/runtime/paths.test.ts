import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveRuntimePaths } from '../../src/runtime/paths'

describe('resolveRuntimePaths', () => {
  it('defaults the data directory to the project root', () => {
    const paths = resolveRuntimePaths()

    expect(paths.dataDir).toBe(path.resolve(process.cwd(), 'data'))
    expect(paths.dbPath).toBe(path.resolve(process.cwd(), 'data', 'pipeline.sqlite'))
  })
})
