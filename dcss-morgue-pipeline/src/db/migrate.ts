import type { Database } from './openDb'

const SCHEMA = `
create table if not exists logfile_offsets (
  server_id text not null,
  version text not null,
  logfile_url text not null,
  byte_offset integer not null,
  updated_at text not null,
  primary key (server_id, version, logfile_url)
);

create table if not exists candidate_games (
  candidate_id text primary key,
  server_id text not null,
  version text not null,
  source_version_label text not null,
  player_name text not null,
  xl integer,
  end_message text not null,
  started_at text not null,
  ended_at text not null,
  logfile_url text not null,
  raw_xlog_line text not null,
  discovered_at text not null,
  sampled_bootstrap_at text,
  sampled_incremental_at text,
  unique (server_id, player_name, started_at, ended_at, source_version_label)
);

create table if not exists morgue_fetches (
  candidate_id text primary key,
  morgue_url text not null,
  fetch_status text not null,
  http_status integer,
  local_path text,
  last_error text,
  fetched_at text not null,
  foreign key (candidate_id) references candidate_games(candidate_id)
);

create table if not exists parse_results (
  candidate_id text primary key,
  parse_status text not null,
  parsed_json text,
  failure_code text,
  failure_detail text,
  parsed_at text not null,
  foreign key (candidate_id) references candidate_games(candidate_id)
);
`

export function migrate(db: Database) {
  db.exec(SCHEMA)

  const candidateColumns = db
    .prepare(`pragma table_info(candidate_games)`)
    .all() as Array<{ name: string }>

  if (!candidateColumns.some((column) => column.name === 'xl')) {
    db.exec(`alter table candidate_games add column xl integer`)
  }
}
