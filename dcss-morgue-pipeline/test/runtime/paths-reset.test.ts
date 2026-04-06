import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ensureRuntimePaths, resetRuntimeDataDir, resolveRuntimePaths } from '../../src/runtime/paths'

const createdDirs: string[] = []

async function makeTempDir(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix))
  createdDirs.push(directory)
  return directory
}

describe('resetRuntimeDataDir', () => {
  afterEach(async () => {
    for (const directory of createdDirs.splice(0)) {
      try {
        await resetRuntimeDataDir(resolveRuntimePaths(directory))
      } catch {
        await rm(directory, { recursive: true, force: true })
      }
    }
  })

  it('removes a recognized runtime data directory', async () => {
    const dataDir = await makeTempDir('dcss-runtime-')
    const paths = resolveRuntimePaths(dataDir)

    await ensureRuntimePaths(paths)
    await writeFile(paths.dbPath, 'placeholder', 'utf8')
    await writeFile(path.resolve(paths.logfilesDir, 'keep.log'), 'cached slice', 'utf8')

    await resetRuntimeDataDir(paths)

    await expect(access(paths.dbPath)).rejects.toThrow()
    await expect(access(paths.morguesDir)).rejects.toThrow()
    await expect(access(paths.auditDir)).rejects.toThrow()
    await expect(readFile(path.resolve(paths.logfilesDir, 'keep.log'), 'utf8')).resolves.toBe(
      'cached slice',
    )
  })

  it('clears logfile cache when requested', async () => {
    const dataDir = await makeTempDir('dcss-runtime-')
    const paths = resolveRuntimePaths(dataDir)

    await ensureRuntimePaths(paths)
    await writeFile(path.resolve(paths.logfilesDir, 'keep.log'), 'cached slice', 'utf8')

    await resetRuntimeDataDir(paths, { clearLogfiles: true })

    await expect(access(paths.logfilesDir)).rejects.toThrow()
  })

  it('refuses to delete a non-runtime directory with unrelated files', async () => {
    const dataDir = await makeTempDir('dcss-non-runtime-')
    await writeFile(path.resolve(dataDir, 'notes.txt'), 'keep me', 'utf8')

    await expect(resetRuntimeDataDir(resolveRuntimePaths(dataDir))).rejects.toThrow(
      /Refusing to delete non-runtime directory/,
    )
  })
})
