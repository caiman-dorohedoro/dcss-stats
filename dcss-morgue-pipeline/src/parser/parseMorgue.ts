import type { ParseFailureRecord, ParsedMorgueRecord, ServerId } from '../types'
import { parseMorgueText } from '../../../packages/morgue-parser/src/index'
import { loadCanonicalSpellNamesFromCrawl } from './loadCanonicalSpellNamesFromCrawl'

export type ParseMorgueMeta = {
  candidateId: string
  serverId: ServerId
  playerName: string
  sourceVersionLabel: string
  endedAt: string
  morgueUrl: string
}

export type ParseMorgueResult =
  | {
      ok: true
      record: ParsedMorgueRecord
    }
  | {
      ok: false
      failure: ParseFailureRecord
    }

export function parseMorgue(text: string, meta: ParseMorgueMeta): ParseMorgueResult {
  const parsed = parseMorgueText(text, {
    canonicalSpellNames: loadCanonicalSpellNamesFromCrawl(),
  })

  if (!parsed.ok) {
    return {
      ok: false,
      failure: parsed.failure,
    }
  }

  const { playerName: _parsedPlayerName, ...record } = parsed.record

  return {
    ok: true,
    record: {
      ...record,
      ...meta,
    } as ParsedMorgueRecord,
  }
}
