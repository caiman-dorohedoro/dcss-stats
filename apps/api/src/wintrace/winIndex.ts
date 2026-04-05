import { hasher as createHasher } from 'node-object-hash'
import { getGameFromCandidate, parseRawGameFromLine } from '~/parser/utils'

const hasher = createHasher()
const versionMinorRegExp = /\d+\.\d+/

export type WinIndexInput = {
  serverAbbreviation: string
  sourceBucket: string
  logfilePath: string
  line: string
}

export type WinIndexEntry = {
  gameId: string
  serverAbbreviation: string
  sourceBucket: string
  logfilePath: string
  player: string
  race: string
  class: string
  char: string
  start: string
  end: string
  fullVersion: string
  longVersion: string | null
  versionMinor: string | null
  finalGod: string | null
  piety: number | null
  score: number
  turns: number
  duration: number
}

export const createWinTraceGameId = ({
  serverAbbreviation,
  player,
  start,
}: Pick<WinIndexEntry, 'serverAbbreviation' | 'player' | 'start'>) => {
  return hasher.hash({
    serverAbbreviation: serverAbbreviation.toLowerCase(),
    player: player.toLowerCase(),
    start,
  })
}

export const getVersionMinorFromFullVersion = (fullVersion: string) => {
  return fullVersion.match(versionMinorRegExp)?.[0] ?? null
}

export const parseWinIndexLine = ({
  serverAbbreviation,
  sourceBucket,
  logfilePath,
  line,
}: WinIndexInput): WinIndexEntry | null => {
  const rawCandidate = parseRawGameFromLine(line)
  const candidate = getGameFromCandidate(rawCandidate)

  if (!candidate.isValid || candidate.ktyp !== 'winning') {
    return null
  }

  const player = candidate.name
  const start = candidate.start
  const fullVersion = candidate.v

  return {
    gameId: createWinTraceGameId({
      serverAbbreviation,
      player,
      start,
    }),
    serverAbbreviation,
    sourceBucket,
    logfilePath,
    player,
    race: candidate.race,
    class: candidate.cls,
    char: candidate.char,
    start,
    end: candidate.end,
    fullVersion,
    longVersion: rawCandidate.vlong ?? null,
    versionMinor: getVersionMinorFromFullVersion(fullVersion),
    finalGod: candidate.god,
    piety: candidate.piety !== null ? parseInt(candidate.piety, 10) : null,
    score: Number(candidate.sc),
    turns: Number(candidate.turn),
    duration: Number(candidate.dur),
  }
}
