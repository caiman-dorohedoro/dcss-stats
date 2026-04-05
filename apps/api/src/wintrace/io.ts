import path from 'node:path'
import { brotliDecompressSync } from 'node:zlib'
import fse from 'fs-extra'
import { WinTraceManifest, WinTraceVersionBundle } from './types'

const compareVersionMinorDesc = (left: string, right: string) => {
  const [leftMajor = 0, leftMinor = 0] = left.split('.').map(Number)
  const [rightMajor = 0, rightMinor = 0] = right.split('.').map(Number)

  return rightMajor - leftMajor || rightMinor - leftMinor
}

export const getLatestManifestVersionMinor = (manifest: WinTraceManifest) => {
  return Object.keys(manifest.versions).sort(compareVersionMinorDesc)[0] ?? null
}

export const readWinTraceManifest = async ({
  outputDir = path.resolve(process.cwd(), 'wintrace-dist'),
}: {
  outputDir?: string
}) => {
  const manifestPath = path.resolve(outputDir, 'manifest.json')
  const manifest = await fse.readJson(manifestPath)

  return {
    manifestPath,
    manifest: manifest as WinTraceManifest,
  }
}

export const resolveWinTraceBundlePath = ({
  manifest,
  outputDir,
  versionMinor,
}: {
  manifest: WinTraceManifest
  outputDir: string
  versionMinor?: string
}) => {
  const selectedVersionMinor = versionMinor ?? getLatestManifestVersionMinor(manifest)

  if (!selectedVersionMinor) {
    throw new Error('No version bundles are available in manifest.json')
  }

  const relativePath = manifest.versions[selectedVersionMinor]

  if (!relativePath) {
    throw new Error(`Bundle for version ${selectedVersionMinor} is not available in manifest.json`)
  }

  return {
    versionMinor: selectedVersionMinor,
    bundlePath: path.resolve(outputDir, relativePath),
  }
}

export const readWinTraceVersionBundle = async ({ bundlePath }: { bundlePath: string }) => {
  const compressed = await fse.readFile(bundlePath)
  const raw = brotliDecompressSync(compressed).toString('utf8')
  const bundle = JSON.parse(raw) as WinTraceVersionBundle

  return {
    bundlePath,
    bundle,
  }
}

export const loadWinTraceVersionBundle = async ({
  outputDir = path.resolve(process.cwd(), 'wintrace-dist'),
  versionMinor,
}: {
  outputDir?: string
  versionMinor?: string
}) => {
  const { manifestPath, manifest } = await readWinTraceManifest({
    outputDir,
  })
  const resolved = resolveWinTraceBundlePath({
    manifest,
    outputDir,
    versionMinor,
  })
  const { bundlePath, bundle } = await readWinTraceVersionBundle({
    bundlePath: resolved.bundlePath,
  })

  return {
    outputDir,
    manifestPath,
    manifest,
    versionMinor: resolved.versionMinor,
    bundlePath,
    bundle,
  }
}
