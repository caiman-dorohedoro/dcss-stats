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

Recommended first run:

- `npm run bootstrap -- --server CAO --per-bucket 1`
- `npm run incremental -- --server CAO --per-bucket 1`
- `npm run audit -- --sample-size 10`

Useful CLI options:

- `--server CAO,CBRG` to limit work to specific servers
- `--data-dir /path/to/data` to move the SQLite file and cached artifacts
- `--dry-run` on `bootstrap` or `incremental` to stop after discovery and selection
- `--since 2026-04-05T00:00:00Z` on `incremental` to override the default 6-hour window

## Storage Layout

- `data/logfiles/` — cached logfile content or slices
- `data/morgues/` — fetched raw morgue files
- `data/audit/` — sampled audit bundles
- `data/pipeline.sqlite` — pipeline offsets, candidates, fetch statuses, and parse results

## Politeness Limits

- per-host concurrency = 1
- minimum delay between requests to the same host = 2 seconds
- different hosts may run in parallel

The same host-queue policy is intended for both logfile discovery and morgue fetching.

## Workflows

### Bootstrap

1. Discover candidate games from configured logfile sources.
   Unseen oversized logfiles are read from a recent tail window instead of from byte `0`.
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
