# DCSS Morgue Pipeline

Strict DCSS 0.34/trunk morgue dataset pipeline scaffold.

## Commands

- `npm test`
- `npm run typecheck`
- `npm run bootstrap`
- `npm run incremental`
- `npm run audit`

Help is available with:

- `npm run bootstrap -- --help`
- `npm run incremental -- --help`
- `npm run audit -- --help`

## Quick Start

- Small first bootstrap:
  `npm run bootstrap -- --server CAO --per-bucket 1 --data-dir /tmp/dcss-bootstrap-test --fresh --verbose`
- Rerun from a clean DB while reusing cached logfile slices:
  `npm run bootstrap -- --server CAO,CBR2,CBRG,CNC --per-bucket 10 --data-dir /tmp/dcss-bootstrap-test --fresh --verbose`
- Fully cold rerun, including logfile cache:
  `npm run bootstrap -- --server CAO,CBR2,CBRG,CNC --per-bucket 10 --data-dir /tmp/dcss-bootstrap-test --fresh-logfiles --verbose`
- Backfill deeper into older logfile history when a bucket needs more candidates:
  `npm run bootstrap -- --server CAO,CBR2,CBRG,CNC --per-bucket 1000 --data-dir /tmp/dcss-bootstrap-test --initial-tail-bytes 1048576 --backfill-chunk-bytes 10485760 --verbose`
- Incremental sample over the default 6-hour window:
  `npm run incremental -- --server CAO,CBR2 --per-bucket 5 --data-dir /tmp/dcss-bootstrap-test --verbose`
- Audit bundle:
  `npm run audit -- --data-dir /tmp/dcss-bootstrap-test --sample-size 10`

`--verbose` prints runtime resets, logfile reuse/fetch decisions, per-bucket discovery progress, candidate selection, morgue fetch URLs, and parse outcomes including `species`, `ac`, `ev`, `sh`, and spell count.

## CLI Reference

### `bootstrap`

Discovers candidates from each selected `(server, version)` bucket, samples up to `--per-bucket` rows per bucket, fetches morgues, and parses them.

Useful options:

- `--per-bucket 10` sets the sample size for each `(server, version)` bucket
- `--server CAO,CBR2,CBRG` limits work to specific active servers
- `--data-dir /path/to/data` relocates SQLite state and cached artifacts
- `--fresh` clears `pipeline.sqlite`, `morgues/`, and `audit/`, but preserves cached logfile slices
- `--fresh-logfiles` does the same reset and also clears `logfiles/`
- `--initial-tail-bytes 10485760` increases the first tail window used for unseen logfile buckets
- `--backfill-chunk-bytes 10485760` fetches older logfile chunks when the initial tail does not provide enough candidates for the requested bucket size
- `--dry-run` stops after discovery and selection
- `--verbose` prints discovery, fetch, and parse progress logs
- `--min-delay-ms 3000` increases the minimum delay between requests to the same host
- `--timeout-ms 20000` increases the HTTP timeout for logfile or morgue fetches

### `incremental`

Runs the same fetch/parse path, but only samples candidates discovered inside the incremental window.

Useful options:

- all shared options from `bootstrap`
- `--since 2026-04-05T00:00:00Z` overrides the default `now - 6 hours` window

### `audit`

Writes a JSON audit bundle containing sampled successes and failures from the current SQLite state.

Useful options:

- `--sample-size 20` controls the number of audit rows emitted
- `--data-dir /path/to/data` selects which runtime state to audit

## Server Set

Active server IDs are derived from this repo's checked-in server definitions:

- `CAO`
- `CBR2`
- `CBRG`
- `CDI`
- `CNC`
- `CPO`
- `CXC`
- `LLD`

`CUE` is intentionally excluded from the active set because `underhound.eu` morgue URLs currently require HTTP basic auth and return `401 Unauthorized` to anonymous fetches.

## Storage Layout

- `data/logfiles/` — cached logfile content or slices, reused across `--fresh` runs unless `--fresh-logfiles` is set
- `data/morgues/` — fetched raw morgue files
- `data/audit/` — sampled audit bundles
- `data/pipeline.sqlite` — pipeline offsets, candidates, fetch statuses, and parse results

To inspect parsed rows directly:

```bash
sqlite3 /tmp/dcss-bootstrap-test/pipeline.sqlite \
  ".headers on" ".mode line" \
  "select
     json_extract(parsed_json,'$.playerName') as player,
     json_extract(parsed_json,'$.species') as species,
     json_extract(parsed_json,'$.ac') as ac,
     json_extract(parsed_json,'$.ev') as ev,
     json_extract(parsed_json,'$.sh') as sh,
     json_array_length(json_extract(parsed_json,'$.spells')) as spell_count
   from parse_results
   where parse_status = 'success'
   order by player;"
```

## Politeness Limits

- host-based concurrency = 1
- minimum delay between requests to the same host = 2 seconds by default
- logfile discovery and morgue fetching share the same host queue
- different hosts run in parallel during candidate fetch/parse execution

The same host-queue policy is intended for both logfile discovery and morgue fetching.

## Workflows

### Bootstrap

1. Discover candidate games from configured logfile sources.
   Unseen oversized logfiles are read from a recent tail window instead of from byte `0`.
   If a cached logfile slice already exists for the bucket, `--fresh` runs reuse that cached slice.
   If a bucket still has fewer than `--per-bucket` eligible candidates, bootstrap reuses older cached slices first and then fetches older logfile chunks to backfill further into history.
2. Stratify by `(server, version)` bucket.
3. Select a bounded bootstrap sample per bucket.
4. Fetch sampled morgues.
5. Parse each morgue in strict mode and store either a normalized row or a structured failure.

### Incremental

1. Discover newly appended logfile records.
2. Filter to candidates discovered since the checkpoint window.
3. Apply per-bucket caps.
4. Fetch and parse sampled morgues.

`incremental` defaults to `since = now - 6 hours` unless `--since` is provided.

## Audit Bundles

`writeAuditBundle()` emits a JSON bundle containing sampled parse successes and failures along with candidate metadata. These bundles are intended for deterministic review and optional LLM auditing.
