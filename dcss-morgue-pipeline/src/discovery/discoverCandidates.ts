import { ACTIVE_SERVER_IDS, getServerManifest } from '../config/manifest'
import type { Database } from '../db/openDb'
import type { ServerId } from '../types'
import { syncLogfile, type ReadLogfileSlice, type SyncResult } from './syncLogfile'

export type DiscoverCandidatesInput = {
  db: Database
  readLogfileSlice: ReadLogfileSlice
  now?: () => string
  serverIds?: readonly ServerId[]
  log?: (message: string) => void
}

export async function discoverCandidates(input: DiscoverCandidatesInput): Promise<SyncResult[]> {
  const summaries: SyncResult[] = []
  const serverIds = input.serverIds ?? ACTIVE_SERVER_IDS

  for (const serverId of serverIds) {
    const manifest = getServerManifest(serverId)

    for (const version of manifest.buckets) {
      input.log?.(
        `[discover] syncing ${serverId}/${version} from ${manifest.logfiles[version].url}`,
      )
      const summary = await syncLogfile(input.db, {
        serverId,
        version,
        logfileUrl: manifest.logfiles[version].url,
        readLogfileSlice: input.readLogfileSlice,
        now: input.now,
      })
      input.log?.(
        `[discover] ${serverId}/${version} offset ${summary.previousOffset} -> ${summary.nextOffset}; lines=${summary.processedLines}, inserted=${summary.insertedCandidates}, rejected=${summary.rejectedLines}`,
      )
      summaries.push(summary)
    }
  }

  return summaries
}
