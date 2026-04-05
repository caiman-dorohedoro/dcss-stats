import path from 'node:path'
import { brotliCompressSync } from 'node:zlib'
import fse from 'fs-extra'
import { describe, expect, test } from 'vitest'
import {
  getLatestManifestVersionMinor,
  loadWinTraceVersionBundle,
  resolveWinTraceBundlePath,
} from './io'
import { WinTraceManifest, WinTraceVersionBundle } from './types'

describe('getLatestManifestVersionMinor', () => {
  test('returns the latest semantic minor version from the manifest', () => {
    const manifest: WinTraceManifest = {
      revision: 12,
      generatedAt: '2026-04-01T00:00:00.000Z',
      versions: {
        '0.34': 'wins-0.34-r12.json.br',
        '0.35': 'wins-0.35-r12.json.br',
        '0.33': 'wins-0.33-r12.json.br',
      },
      counts: {},
    }

    expect(getLatestManifestVersionMinor(manifest)).toBe('0.35')
  })
})

describe('resolveWinTraceBundlePath', () => {
  test('picks the requested bundle path from manifest', () => {
    const manifest: WinTraceManifest = {
      revision: 12,
      generatedAt: '2026-04-01T00:00:00.000Z',
      versions: {
        '0.34': 'wins-0.34-r12.json.br',
      },
      counts: {
        '0.34': 5,
      },
    }

    expect(
      resolveWinTraceBundlePath({
        manifest,
        outputDir: '/tmp/wintrace',
        versionMinor: '0.34',
      }),
    ).toEqual({
      versionMinor: '0.34',
      bundlePath: path.resolve('/tmp/wintrace', 'wins-0.34-r12.json.br'),
    })
  })
})

describe('loadWinTraceVersionBundle', () => {
  test('loads the latest bundle from manifest and decompresses it', async () => {
    const outputDir = path.resolve(process.cwd(), 'tmp', 'wintrace-io-test')
    const manifest: WinTraceManifest = {
      revision: 7,
      generatedAt: '2026-04-01T00:00:00.000Z',
      versions: {
        '0.32': 'wins-0.32-r7.json.br',
      },
      counts: {
        '0.32': 1,
      },
    }
    const bundle: WinTraceVersionBundle = {
      revision: 7,
      generatedAt: '2026-04-01T00:00:00.000Z',
      versionMinor: '0.32',
      gameCount: 1,
      games: [
        {
          gameId: 'game-1',
          server: 'CXC',
          sourceBucket: '0.32',
          fullVersion: '0.32.1',
          longVersion: null,
          versionMinor: '0.32',
          player: 'tester',
          race: 'Minotaur',
          class: 'Fighter',
          char: 'MiFi',
          startAt: '2026-04-01T00:00:00.000Z',
          endAt: '2026-04-01T01:00:00.000Z',
          finalGod: 'Okawaru',
          religionTrace: [[3, 'Okawaru']],
          religionWarnings: [],
          skills: {
            fighting: [[5, 4]],
          },
        },
      ],
    }

    await fse.emptyDir(outputDir)
    await fse.writeJson(path.resolve(outputDir, 'manifest.json'), manifest, {
      spaces: 2,
    })
    await fse.writeFile(
      path.resolve(outputDir, 'wins-0.32-r7.json.br'),
      brotliCompressSync(Buffer.from(JSON.stringify(bundle))),
    )

    const loaded = await loadWinTraceVersionBundle({
      outputDir,
    })

    expect(loaded.versionMinor).toBe('0.32')
    expect(loaded.bundle).toEqual(bundle)

    await fse.remove(outputDir)
  })
})
