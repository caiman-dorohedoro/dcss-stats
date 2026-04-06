import { ACTIVE_SERVER_IDS, getServerManifest } from '../config/manifest'
import type { Database } from '../db/openDb'
import type { ServerId } from '../types'
import { syncLogfile, type ReadLogfileSlice, type SyncResult } from './syncLogfile'

export type DiscoverCandidatesInput = {
  db: Database
  readLogfileSlice: ReadLogfileSlice
  now?: () => string
  serverIds?: readonly ServerId[]
}

export async function discoverCandidates(input: DiscoverCandidatesInput): Promise<SyncResult[]> {
  const summaries: SyncResult[] = []
  const serverIds = input.serverIds ?? ACTIVE_SERVER_IDS

  for (const serverId of serverIds) {
    const manifest = getServerManifest(serverId)

    for (const version of manifest.buckets) {
      summaries.push(
        await syncLogfile(input.db, {
          serverId,
          version,
          logfileUrl: manifest.logfiles[version].url,
          readLogfileSlice: input.readLogfileSlice,
          now: input.now,
        }),
      )
    }
  }

  return summaries
}
