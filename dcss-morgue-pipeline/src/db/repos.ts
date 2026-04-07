import type {
  CandidateGame,
  LogfileOffsetRow,
  MorgueFetchRow,
  ParseFailureRow,
  ParseResultRow,
  ParseSuccessRow,
  ServerId,
  TargetVersion,
} from '../types'
import { createInMemoryDb, openDb, type Database } from './openDb'
import { migrate } from './migrate'

type OffsetRowDb = {
  server_id: string
  version: string
  logfile_url: string
  byte_offset: number
  updated_at: string
}

type CandidateRowDb = {
  candidate_id: string
  server_id: string
  version: string
  source_version_label: string
  player_name: string
  xl: number | null
  end_message: string
  started_at: string
  ended_at: string
  logfile_url: string
  raw_xlog_line: string
  discovered_at: string
  sampled_bootstrap_at: string | null
  sampled_incremental_at: string | null
}

type MorgueFetchRowDb = {
  candidate_id: string
  morgue_url: string
  fetch_status: MorgueFetchRow['fetchStatus']
  http_status: number | null
  local_path: string | null
  last_error: string | null
  fetched_at: string
}

type ParseResultRowDb = {
  candidate_id: string
  parse_status: ParseResultRow['parseStatus']
  parsed_json: string | null
  failure_code: string | null
  failure_detail: string | null
  parsed_at: string
}

function mapOffsetRow(row: OffsetRowDb): LogfileOffsetRow {
  return {
    serverId: row.server_id as ServerId,
    version: row.version as TargetVersion,
    logfileUrl: row.logfile_url,
    byteOffset: row.byte_offset,
    updatedAt: row.updated_at,
  }
}

function mapCandidateRow(row: CandidateRowDb): CandidateGame {
  return {
    candidateId: row.candidate_id,
    serverId: row.server_id as ServerId,
    version: row.version as TargetVersion,
    sourceVersionLabel: row.source_version_label,
    playerName: row.player_name,
    xl: row.xl,
    endMessage: row.end_message,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    logfileUrl: row.logfile_url,
    rawXlogLine: row.raw_xlog_line,
    discoveredAt: row.discovered_at,
    sampledBootstrapAt: row.sampled_bootstrap_at,
    sampledIncrementalAt: row.sampled_incremental_at,
  }
}

function mapMorgueFetchRow(row: MorgueFetchRowDb): MorgueFetchRow {
  return {
    candidateId: row.candidate_id,
    morgueUrl: row.morgue_url,
    fetchStatus: row.fetch_status,
    httpStatus: row.http_status,
    localPath: row.local_path,
    lastError: row.last_error,
    fetchedAt: row.fetched_at,
  }
}

function mapParseResultRow(row: ParseResultRowDb): ParseResultRow {
  if (row.parse_status === 'success') {
    return {
      candidateId: row.candidate_id,
      parseStatus: 'success',
      parsedJson: row.parsed_json ? JSON.parse(row.parsed_json) : null,
      failureCode: null,
      failureDetail: null,
      parsedAt: row.parsed_at,
    }
  }

  return {
    candidateId: row.candidate_id,
    parseStatus: 'failure',
    parsedJson: null,
    failureCode: row.failure_code ?? 'unknown_failure',
    failureDetail: row.failure_detail,
    parsedAt: row.parsed_at,
  }
}

export const offsetRepo = {
  get(db: Database, serverId: ServerId, version: TargetVersion, logfileUrl: string) {
    const row = db
      .prepare(
        `
          select server_id, version, logfile_url, byte_offset, updated_at
          from logfile_offsets
          where server_id = ? and version = ? and logfile_url = ?
        `,
      )
      .get(serverId, version, logfileUrl) as OffsetRowDb | undefined

    return row ? mapOffsetRow(row) : undefined
  },

  upsert(db: Database, row: Omit<LogfileOffsetRow, 'updatedAt'> & { updatedAt?: string }) {
    db.prepare(
      `
        insert into logfile_offsets (server_id, version, logfile_url, byte_offset, updated_at)
        values (@serverId, @version, @logfileUrl, @byteOffset, @updatedAt)
        on conflict(server_id, version, logfile_url)
        do update set byte_offset = excluded.byte_offset, updated_at = excluded.updated_at
      `,
    ).run({
      ...row,
      updatedAt: row.updatedAt ?? new Date().toISOString(),
    })
  },
}

export const candidateRepo = {
  get(db: Database, candidateId: string) {
    const row = db
      .prepare(
        `
          select
            candidate_id,
            server_id,
            version,
            source_version_label,
            player_name,
            xl,
            end_message,
            started_at,
            ended_at,
            logfile_url,
            raw_xlog_line,
            discovered_at,
            sampled_bootstrap_at,
            sampled_incremental_at
          from candidate_games
          where candidate_id = ?
        `,
      )
      .get(candidateId) as CandidateRowDb | undefined

    return row ? mapCandidateRow(row) : undefined
  },

  count(db: Database) {
    const row = db.prepare(`select count(*) as count from candidate_games`).get() as { count: number }
    return row.count
  },

  listAll(db: Database) {
    const rows = db
      .prepare(
        `
          select
            candidate_id,
            server_id,
            version,
            source_version_label,
            player_name,
            xl,
            end_message,
            started_at,
            ended_at,
            logfile_url,
            raw_xlog_line,
            discovered_at,
            sampled_bootstrap_at,
            sampled_incremental_at
          from candidate_games
          order by discovered_at asc, candidate_id asc
        `,
      )
      .all() as CandidateRowDb[]

    return rows.map(mapCandidateRow)
  },

  listBootstrapEligible(db: Database) {
    const rows = db
      .prepare(
        `
          select
            candidate_id,
            server_id,
            version,
            source_version_label,
            player_name,
            xl,
            end_message,
            started_at,
            ended_at,
            logfile_url,
            raw_xlog_line,
            discovered_at,
            sampled_bootstrap_at,
            sampled_incremental_at
          from candidate_games
          where sampled_bootstrap_at is null
          order by discovered_at asc, candidate_id asc
        `,
      )
      .all() as CandidateRowDb[]

    return rows.map(mapCandidateRow)
  },

  listIncrementalEligible(db: Database, since: string) {
    const rows = db
      .prepare(
        `
          select
            candidate_id,
            server_id,
            version,
            source_version_label,
            player_name,
            xl,
            end_message,
            started_at,
            ended_at,
            logfile_url,
            raw_xlog_line,
            discovered_at,
            sampled_bootstrap_at,
            sampled_incremental_at
          from candidate_games
          where sampled_incremental_at is null and discovered_at >= ?
          order by discovered_at asc, candidate_id asc
        `,
      )
      .all(since) as CandidateRowDb[]

    return rows.map(mapCandidateRow)
  },

  markBootstrapSampled(db: Database, candidateIds: string[], sampledAt: string) {
    const update = db.prepare(
      `update candidate_games set sampled_bootstrap_at = ? where candidate_id = ?`,
    )
    const transaction = db.transaction((ids: string[]) => {
      for (const candidateId of ids) {
        update.run(sampledAt, candidateId)
      }
    })
    transaction(candidateIds)
  },

  markIncrementalSampled(db: Database, candidateIds: string[], sampledAt: string) {
    const update = db.prepare(
      `update candidate_games set sampled_incremental_at = ? where candidate_id = ?`,
    )
    const transaction = db.transaction((ids: string[]) => {
      for (const candidateId of ids) {
        update.run(sampledAt, candidateId)
      }
    })
    transaction(candidateIds)
  },

  insertMany(db: Database, rows: CandidateGame[]) {
    const insert = db.prepare(
      `
        insert or ignore into candidate_games (
          candidate_id,
          server_id,
            version,
            source_version_label,
            player_name,
            xl,
            end_message,
            started_at,
            ended_at,
            logfile_url,
          raw_xlog_line,
          discovered_at,
          sampled_bootstrap_at,
          sampled_incremental_at
        ) values (
          @candidateId,
          @serverId,
          @version,
          @sourceVersionLabel,
          @playerName,
          @xl,
          @endMessage,
          @startedAt,
          @endedAt,
          @logfileUrl,
          @rawXlogLine,
          @discoveredAt,
          @sampledBootstrapAt,
          @sampledIncrementalAt
        )
      `,
    )

    const insertMany = db.transaction((items: CandidateGame[]) => {
      for (const item of items) {
        insert.run(item)
      }
    })

    insertMany(rows)
  },
}

export const morgueFetchRepo = {
  get(db: Database, candidateId: string) {
    const row = db
      .prepare(
        `
          select candidate_id, morgue_url, fetch_status, http_status, local_path, last_error, fetched_at
          from morgue_fetches
          where candidate_id = ?
        `,
      )
      .get(candidateId) as MorgueFetchRowDb | undefined

    return row ? mapMorgueFetchRow(row) : undefined
  },

  upsert(db: Database, row: MorgueFetchRow) {
    db.prepare(
      `
        insert into morgue_fetches (
          candidate_id,
          morgue_url,
          fetch_status,
          http_status,
          local_path,
          last_error,
          fetched_at
        ) values (
          @candidateId,
          @morgueUrl,
          @fetchStatus,
          @httpStatus,
          @localPath,
          @lastError,
          @fetchedAt
        )
        on conflict(candidate_id)
        do update set
          morgue_url = excluded.morgue_url,
          fetch_status = excluded.fetch_status,
          http_status = excluded.http_status,
          local_path = excluded.local_path,
          last_error = excluded.last_error,
          fetched_at = excluded.fetched_at
      `,
    ).run(row)
  },
}

export const parseResultRepo = {
  get(db: Database, candidateId: string) {
    const row = db
      .prepare(
        `
          select candidate_id, parse_status, parsed_json, failure_code, failure_detail, parsed_at
          from parse_results
          where candidate_id = ?
        `,
      )
      .get(candidateId) as ParseResultRowDb | undefined

    return row ? mapParseResultRow(row) : undefined
  },

  listAll(db: Database) {
    const rows = db
      .prepare(
        `
          select candidate_id, parse_status, parsed_json, failure_code, failure_detail, parsed_at
          from parse_results
          order by parsed_at asc, candidate_id asc
        `,
      )
      .all() as ParseResultRowDb[]

    return rows.map(mapParseResultRow)
  },

  upsertSuccess(db: Database, row: Omit<ParseSuccessRow, 'parseStatus' | 'failureCode' | 'failureDetail'>) {
    db.prepare(
      `
        insert into parse_results (
          candidate_id,
          parse_status,
          parsed_json,
          failure_code,
          failure_detail,
          parsed_at
        ) values (
          @candidateId,
          'success',
          @parsedJson,
          null,
          null,
          @parsedAt
        )
        on conflict(candidate_id)
        do update set
          parse_status = 'success',
          parsed_json = excluded.parsed_json,
          failure_code = null,
          failure_detail = null,
          parsed_at = excluded.parsed_at
      `,
    ).run({
      candidateId: row.candidateId,
      parsedJson: JSON.stringify(row.parsedJson),
      parsedAt: row.parsedAt,
    })
  },

  upsertFailure(db: Database, row: Omit<ParseFailureRow, 'parseStatus' | 'parsedJson'>) {
    db.prepare(
      `
        insert into parse_results (
          candidate_id,
          parse_status,
          parsed_json,
          failure_code,
          failure_detail,
          parsed_at
        ) values (
          @candidateId,
          'failure',
          null,
          @failureCode,
          @failureDetail,
          @parsedAt
        )
        on conflict(candidate_id)
        do update set
          parse_status = 'failure',
          parsed_json = null,
          failure_code = excluded.failure_code,
          failure_detail = excluded.failure_detail,
          parsed_at = excluded.parsed_at
      `,
    ).run(row)
  },
}

export { createInMemoryDb, migrate, openDb }
