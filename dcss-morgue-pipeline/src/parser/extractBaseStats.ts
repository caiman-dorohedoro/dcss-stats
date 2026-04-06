import { extractBaseStats as extractBaseStatsCore } from '../../../packages/morgue-parser/src/index'
import type { BaseStatsSnapshot } from '../types'

export function extractBaseStats(text: string): BaseStatsSnapshot {
  const { playerName: _ignoredPlayerName, ...record } = extractBaseStatsCore(text)

  return record
}
