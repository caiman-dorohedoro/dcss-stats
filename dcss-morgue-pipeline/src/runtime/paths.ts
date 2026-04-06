import { access, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type RuntimePaths = {
  projectRoot: string
  dataDir: string
  dbPath: string
  logfilesDir: string
  morguesDir: string
  auditDir: string
  markerPath: string
}

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const RUNTIME_MARKER_FILENAME = '.dcss-morgue-runtime'

export function resolveRuntimePaths(dataDir?: string): RuntimePaths {
  const resolvedDataDir = path.resolve(dataDir ?? path.resolve(PROJECT_ROOT, 'data'))

  return {
    projectRoot: PROJECT_ROOT,
    dataDir: resolvedDataDir,
    dbPath: path.resolve(resolvedDataDir, 'pipeline.sqlite'),
    logfilesDir: path.resolve(resolvedDataDir, 'logfiles'),
    morguesDir: path.resolve(resolvedDataDir, 'morgues'),
    auditDir: path.resolve(resolvedDataDir, 'audit'),
    markerPath: path.resolve(resolvedDataDir, RUNTIME_MARKER_FILENAME),
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

async function looksLikeRuntimeDataDir(paths: RuntimePaths): Promise<boolean> {
  if (await pathExists(paths.markerPath)) {
    return true
  }

  const knownEntries = [
    'pipeline.sqlite',
    'pipeline.sqlite-shm',
    'pipeline.sqlite-wal',
    'logfiles',
    'morgues',
    'audit',
  ]

  return Promise.any(
    knownEntries.map(async (entry) => {
      await access(path.resolve(paths.dataDir, entry))
      return true
    }),
  ).catch(() => false)
}

export async function resetRuntimeDataDir(paths: RuntimePaths): Promise<void> {
  if (!(await pathExists(paths.dataDir))) {
    return
  }

  const entries = await readdir(paths.dataDir)

  if (entries.length === 0) {
    return
  }

  if (!(await looksLikeRuntimeDataDir(paths))) {
    throw new Error(
      `Refusing to delete non-runtime directory: ${paths.dataDir}. Remove it manually or choose a dedicated --data-dir.`,
    )
  }

  await rm(paths.dataDir, { recursive: true, force: true })
}

export async function ensureRuntimePaths(paths: RuntimePaths): Promise<void> {
  await mkdir(paths.dataDir, { recursive: true })
  await mkdir(path.dirname(paths.dbPath), { recursive: true })
  await mkdir(paths.logfilesDir, { recursive: true })
  await mkdir(paths.morguesDir, { recursive: true })
  await mkdir(paths.auditDir, { recursive: true })
  await writeFile(paths.markerPath, 'dcss-morgue-pipeline runtime data\n', 'utf8')
}
