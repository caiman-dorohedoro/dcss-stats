# DCSS Morgue Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a strict DCSS 0.34/trunk morgue dataset pipeline that discovers games from xlog/logfiles, fetches morgues with per-host politeness limits, parses required fields into normalized JSON, and rejects ambiguous parses.

**Architecture:** Implement a small TypeScript CLI project in its own folder inside the workspace. Use SQLite for offsets/jobs/results metadata, filesystem storage for raw logfiles and morgues, a shared per-host queued HTTP layer for polite collection, and a deterministic parser that emits either a valid normalized record or a structured failure.

**Tech Stack:** Node.js 24, TypeScript, tsx, Vitest, better-sqlite3, p-queue, built-in fetch, filesystem fixtures

---

## Resolved Design Decisions

- Normalize source versions into exactly two pipeline buckets: `0.34` and `trunk`.
- Map server-side labels such as `git` or `trunk` to the normalized bucket only through the manifest. Reject any source version that does not map unambiguously.
- Derive the new pipeline manifest from the existing `dcss-stats` server definitions already checked into this repo. Do not maintain a second unrelated set of server URLs by hand.
- Use one shared host-queue policy for both logfile discovery fetches and morgue fetches:
  - per-host concurrency = 1
  - minimum delay between requests to the same host = 2 seconds initially
  - different hosts may run in parallel
- Candidate identity must include server identity. Build `candidateId` from `(serverId, playerName, startedAt, endedAt, sourceVersionLabel)`, and also protect inserts with a matching composite uniqueness constraint.
- Absence of a spell section is valid and should normalize to `spells: []`. Fail only when a spell section is present but ambiguous/unparseable, or when the parser cannot distinguish absence from parse failure.
- Persist pipeline state in SQLite using explicit tables for logfile offsets, candidate games, morgue fetches, and parse results.

## Preconditions

- Implement this in a dedicated worktree before touching code.
- Keep the implementation isolated under `dcss-morgue-pipeline/`.
- Use TDD for every parser/discovery unit.
- Commit after each task.

## File Structure

### Project root

- Create: `dcss-morgue-pipeline/package.json` — npm scripts and dependencies
- Create: `dcss-morgue-pipeline/tsconfig.json` — TypeScript config
- Create: `dcss-morgue-pipeline/vitest.config.ts` — test runner config
- Create: `dcss-morgue-pipeline/.gitignore` — ignore `data/`, `coverage/`, build output
- Create: `dcss-morgue-pipeline/README.md` — operator commands and storage layout

### Source files

- Create: `dcss-morgue-pipeline/src/cli.ts` — CLI entrypoint and command dispatch
- Create: `dcss-morgue-pipeline/src/types.ts` — shared types for candidates, manifests, parsed rows, failures
- Create: `dcss-morgue-pipeline/src/config/manifest.ts` — active server definitions for normalized `0.34`/`trunk` buckets
- Create: `dcss-morgue-pipeline/src/config/canonical.ts` — canonical armour/shield labels and spell school names
- Create: `dcss-morgue-pipeline/src/db/openDb.ts` — SQLite connection and pragma setup
- Create: `dcss-morgue-pipeline/src/db/migrate.ts` — schema creation
- Create: `dcss-morgue-pipeline/src/db/repos.ts` — repository helpers for offsets, candidates, morgue fetches, parse results
- Create: `dcss-morgue-pipeline/src/net/hostQueues.ts` — shared per-host queue registry used by discovery and morgue fetching
- Create: `dcss-morgue-pipeline/src/discovery/parseXlogLine.ts` — xlog line parser
- Create: `dcss-morgue-pipeline/src/discovery/syncLogfile.ts` — incremental logfile download + offset advancement
- Create: `dcss-morgue-pipeline/src/discovery/discoverCandidates.ts` — manifest-wide discovery orchestration
- Create: `dcss-morgue-pipeline/src/sampling/selectBootstrapCandidates.ts` — stratified bootstrap sampler
- Create: `dcss-morgue-pipeline/src/sampling/selectIncrementalCandidates.ts` — 6-hour incremental sampler
- Create: `dcss-morgue-pipeline/src/fetch/buildMorgueUrl.ts` — server-aware morgue URL construction
- Create: `dcss-morgue-pipeline/src/fetch/fetchMorgue.ts` — fetch/caching/status recording
- Create: `dcss-morgue-pipeline/src/parser/splitSections.ts` — section discovery independent of dump order
- Create: `dcss-morgue-pipeline/src/parser/extractBaseStats.ts` — version/species/STR/INT/DEX extraction
- Create: `dcss-morgue-pipeline/src/parser/extractEquipment.ts` — body armour/shield/slot booleans extraction + normalization
- Create: `dcss-morgue-pipeline/src/parser/extractSkills.ts` — armour/dodging/shields/spellcasting/school skills extraction
- Create: `dcss-morgue-pipeline/src/parser/extractSpells.ts` — full spell list + failure rates when a spell section exists
- Create: `dcss-morgue-pipeline/src/parser/extractMagicModifiers.ts` — wizardry/channel/wildMagic extraction
- Create: `dcss-morgue-pipeline/src/parser/validateStrict.ts` — strict validation and failure reasons
- Create: `dcss-morgue-pipeline/src/parser/parseMorgue.ts` — top-level deterministic parser
- Create: `dcss-morgue-pipeline/src/pipeline/runBootstrap.ts` — bootstrap workflow
- Create: `dcss-morgue-pipeline/src/pipeline/runIncremental.ts` — 6-hour workflow
- Create: `dcss-morgue-pipeline/src/audit/writeAuditBundle.ts` — write sampled success/failure audit bundles for LLM review

### Test files

- Create: `dcss-morgue-pipeline/test/config/manifest.test.ts`
- Create: `dcss-morgue-pipeline/test/db/repos.test.ts`
- Create: `dcss-morgue-pipeline/test/discovery/parseXlogLine.test.ts`
- Create: `dcss-morgue-pipeline/test/discovery/syncLogfile.test.ts`
- Create: `dcss-morgue-pipeline/test/sampling/selectBootstrapCandidates.test.ts`
- Create: `dcss-morgue-pipeline/test/sampling/selectIncrementalCandidates.test.ts`
- Create: `dcss-morgue-pipeline/test/net/hostQueues.test.ts`
- Create: `dcss-morgue-pipeline/test/fetch/buildMorgueUrl.test.ts`
- Create: `dcss-morgue-pipeline/test/parser/extractBaseStats.test.ts`
- Create: `dcss-morgue-pipeline/test/parser/extractEquipment.test.ts`
- Create: `dcss-morgue-pipeline/test/parser/extractSkills.test.ts`
- Create: `dcss-morgue-pipeline/test/parser/extractSpells.test.ts`
- Create: `dcss-morgue-pipeline/test/parser/extractMagicModifiers.test.ts`
- Create: `dcss-morgue-pipeline/test/parser/parseMorgue.test.ts`
- Create: `dcss-morgue-pipeline/test/pipeline/runBootstrap.test.ts`
- Create: `dcss-morgue-pipeline/test/pipeline/runIncremental.test.ts`

### Fixtures and data layout

- Create: `dcss-morgue-pipeline/test/fixtures/xlog/*.txt` — representative xlog lines
- Create: `dcss-morgue-pipeline/test/fixtures/morgue/success/*.txt` — valid morgue fixtures
- Create: `dcss-morgue-pipeline/test/fixtures/morgue/fail/*.txt` — ambiguous or unsupported morgues
- Runtime dir: `dcss-morgue-pipeline/data/logfiles/`
- Runtime dir: `dcss-morgue-pipeline/data/morgues/`
- Runtime dir: `dcss-morgue-pipeline/data/audit/`
- Runtime file: `dcss-morgue-pipeline/data/pipeline.sqlite`

## Task 1: Scaffold the isolated TypeScript CLI project

**Files:**
- Create: `dcss-morgue-pipeline/package.json`
- Create: `dcss-morgue-pipeline/tsconfig.json`
- Create: `dcss-morgue-pipeline/vitest.config.ts`
- Create: `dcss-morgue-pipeline/.gitignore`
- Create: `dcss-morgue-pipeline/src/cli.ts`
- Test: `dcss-morgue-pipeline/test/cli/smoke.test.ts`

- [ ] **Step 1: Write the failing smoke test**

```ts
import { describe, expect, it } from 'vitest'
import { runCli } from '../../src/cli'

describe('runCli', () => {
  it('prints usage for no command', async () => {
    await expect(runCli([])).resolves.toEqual({ exitCode: 1, stdout: 'Usage: dcss-morgue <command>' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dcss-morgue-pipeline && npm test -- test/cli/smoke.test.ts`  
Expected: FAIL with `Cannot find module '../../src/cli'` or equivalent.

- [ ] **Step 3: Write minimal project skeleton**

```json
{
  "name": "dcss-morgue-pipeline",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "bootstrap": "tsx src/cli.ts bootstrap",
    "incremental": "tsx src/cli.ts incremental",
    "audit": "tsx src/cli.ts audit"
  }
}
```

```ts
export async function runCli(args: string[]) {
  if (args.length === 0) {
    return { exitCode: 1, stdout: 'Usage: dcss-morgue <command>' }
  }

  return { exitCode: 0, stdout: `TODO ${args[0]}` }
}
```

- [ ] **Step 4: Run smoke test and typecheck**

Run: `cd dcss-morgue-pipeline && npm test -- test/cli/smoke.test.ts && npm run typecheck`  
Expected: test PASS, typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add dcss-morgue-pipeline/package.json dcss-morgue-pipeline/tsconfig.json dcss-morgue-pipeline/vitest.config.ts dcss-morgue-pipeline/.gitignore dcss-morgue-pipeline/src/cli.ts dcss-morgue-pipeline/test/cli/smoke.test.ts
git commit -m "feat: scaffold dcss morgue pipeline project"
```

## Task 2: Add server manifest and canonical normalization tables

**Files:**
- Create: `dcss-morgue-pipeline/src/config/manifest.ts`
- Create: `dcss-morgue-pipeline/src/config/canonical.ts`
- Modify: `dcss-morgue-pipeline/src/types.ts`
- Test: `dcss-morgue-pipeline/test/config/manifest.test.ts`

- [ ] **Step 1: Write the failing manifest tests**

```ts
import { describe, expect, it } from 'vitest'
import { ACTIVE_SERVER_IDS, getServerManifest } from '../../src/config/manifest'

describe('manifest', () => {
  it('includes CAO and CBRG for normalized 0.34/trunk buckets', () => {
    expect(ACTIVE_SERVER_IDS).toContain('CAO')
    expect(ACTIVE_SERVER_IDS).toContain('CBRG')
    expect(getServerManifest('CAO').buckets).toEqual(['0.34', 'trunk'])
  })

  it('encodes source version labels separately from normalized buckets', () => {
    const cao = getServerManifest('CAO')
    expect(cao.logfiles.trunk.sourceVersionLabel).toBe('git')
    expect(cao.morgueRule.kind).toBe('rawdata-player-dir')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dcss-morgue-pipeline && npm test -- test/config/manifest.test.ts`  
Expected: FAIL because manifest exports do not exist yet.

- [ ] **Step 3: Implement manifest + canonical constants**

- Build the manifest by deriving a restricted snapshot from the server definitions already checked into this repo, keeping only active sources that expose normalized `0.34` and `trunk` buckets.
- Preserve server-specific logfile and morgue URL rules exactly as they exist in the current repo.
- Encode source labels such as `git` or `trunk` in the manifest rather than hard-coding ad hoc parser rules.

```ts
export type TargetVersion = '0.34' | 'trunk'

export const CANONICAL_BODY_ARMOUR = ['none', 'robe', 'leather armour', 'ring mail', 'scale mail', 'chain mail', 'plate armour'] as const
export const CANONICAL_SHIELDS = ['none', 'buckler', 'kite shield', 'tower shield'] as const

export const ACTIVE_SERVER_IDS = ['CBRG', 'CNC', 'CDI', 'CXC', 'CBR2', 'CAO', 'LLD', 'CPO'] as const

export const SERVER_MANIFEST = {
  CAO: {
    host: 'crawl.akrasiac.org',
    buckets: ['0.34', 'trunk'],
    logfiles: {
      '0.34': {
        url: 'http://crawl.akrasiac.org/logfile34',
        sourceVersionLabel: '0.34'
      },
      trunk: {
        url: 'http://crawl.akrasiac.org/logfile-git',
        sourceVersionLabel: 'git'
      }
    },
    morgueRule: { kind: 'rawdata-player-dir', baseUrl: 'http://crawl.akrasiac.org/rawdata' }
  }
} satisfies Record<string, ServerManifest>
```

- [ ] **Step 4: Run manifest test and typecheck**

Run: `cd dcss-morgue-pipeline && npm test -- test/config/manifest.test.ts && npm run typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dcss-morgue-pipeline/src/config/manifest.ts dcss-morgue-pipeline/src/config/canonical.ts dcss-morgue-pipeline/src/types.ts dcss-morgue-pipeline/test/config/manifest.test.ts
git commit -m "feat: add active server manifest and canonical labels"
```

## Task 3: Add SQLite schema and repository helpers for offsets, candidates, fetches, and parse results

**Files:**
- Create: `dcss-morgue-pipeline/src/db/openDb.ts`
- Create: `dcss-morgue-pipeline/src/db/migrate.ts`
- Create: `dcss-morgue-pipeline/src/db/repos.ts`
- Test: `dcss-morgue-pipeline/test/db/repos.test.ts`

- [ ] **Step 1: Write the failing repository tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  createInMemoryDb,
  migrate,
  offsetRepo,
  candidateRepo,
  morgueFetchRepo,
  parseResultRepo
} from '../../src/db/repos'

describe('offsetRepo', () => {
  it('stores and retrieves byte offsets by server/version/url', () => {
    const db = createInMemoryDb()
    migrate(db)
    offsetRepo.upsert(db, { serverId: 'CAO', version: '0.34', logfileUrl: 'http://example/logfile34', byteOffset: 128 })
    expect(offsetRepo.get(db, 'CAO', '0.34', 'http://example/logfile34')?.byteOffset).toBe(128)
  })

  it('stores candidates, fetch rows, and parse result rows idempotently', () => {
    const db = createInMemoryDb()
    migrate(db)
    // insert candidate, fetch status, and parse success/failure rows
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dcss-morgue-pipeline && npm test -- test/db/repos.test.ts`  
Expected: FAIL because DB helpers do not exist.

- [ ] **Step 3: Implement schema and repositories**

```sql
create table if not exists logfile_offsets (
  server_id text not null,
  version text not null,
  logfile_url text not null,
  byte_offset integer not null,
  updated_at text not null,
  primary key (server_id, version, logfile_url)
);
```

```sql
create table if not exists candidate_games (
  candidate_id text primary key,
  server_id text not null,
  version text not null,
  source_version_label text not null,
  player_name text not null,
  started_at text not null,
  ended_at text not null,
  logfile_url text not null,
  raw_xlog_line text not null,
  discovered_at text not null,
  sampled_bootstrap_at text,
  sampled_incremental_at text,
  unique (server_id, player_name, started_at, ended_at, source_version_label)
);
```

```sql
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
```

```sql
create table if not exists parse_results (
  candidate_id text primary key,
  parse_status text not null,
  parsed_json text,
  failure_code text,
  failure_detail text,
  parsed_at text not null,
  foreign key (candidate_id) references candidate_games(candidate_id)
);
```

```ts
export const offsetRepo = {
  get(db, serverId, version, logfileUrl) { /* select row */ },
  upsert(db, row) { /* insert ... on conflict ... do update */ }
}
```

- [ ] **Step 4: Run repository tests**

Run: `cd dcss-morgue-pipeline && npm test -- test/db/repos.test.ts`  
Expected: PASS for offset storage, candidate inserts, duplicate protection, 404 fetch caching metadata, and parse/failure row persistence.

- [ ] **Step 5: Commit**

```bash
git add dcss-morgue-pipeline/src/db/openDb.ts dcss-morgue-pipeline/src/db/migrate.ts dcss-morgue-pipeline/src/db/repos.ts dcss-morgue-pipeline/test/db/repos.test.ts
git commit -m "feat: add sqlite persistence for pipeline state"
```

## Task 4: Implement xlog parsing and incremental discovery sync

**Files:**
- Create: `dcss-morgue-pipeline/src/discovery/parseXlogLine.ts`
- Create: `dcss-morgue-pipeline/src/discovery/syncLogfile.ts`
- Create: `dcss-morgue-pipeline/src/discovery/discoverCandidates.ts`
- Test: `dcss-morgue-pipeline/test/discovery/parseXlogLine.test.ts`
- Test: `dcss-morgue-pipeline/test/discovery/syncLogfile.test.ts`
- Fixture: `dcss-morgue-pipeline/test/fixtures/xlog/cao-034.txt`

- [ ] **Step 1: Write failing tests for escaped-colon parsing, strict version mapping, and offset advancement**

```ts
it('parses xlog key/value pairs with :: escapes', () => {
  const row = parseXlogLine(
    'name=alice:start=20260405...:v=0.34:end=20260405...:tmsg=slain by an orc:: warrior',
    { serverId: 'CAO' }
  )
  expect(row.playerName).toBe('alice')
  expect(row.endMessage).toContain('orc: warrior')
})

it('rejects unsupported source versions instead of mapping them to trunk', () => {
  expect(() =>
    parseXlogLine('name=alice:start=20260405...:v=0.33:end=20260405...', { serverId: 'CAO' })
  ).toThrow(/unsupported candidate version/i)
})

it('only advances offset after complete newline-terminated records are persisted', async () => {
  // fixture includes one full line and one truncated line
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dcss-morgue-pipeline && npm test -- test/discovery/parseXlogLine.test.ts test/discovery/syncLogfile.test.ts`  
Expected: FAIL because parser/sync files do not exist.

- [ ] **Step 3: Implement xlog parser and sync logic**

```ts
const SPLIT_RE = /(?:[^:]|::)+/g

export function parseXlogLine(line: string, ctx: { serverId: string; sourceVersionLabel?: string }): CandidateGame {
  const chunks = Array.from(line.trim().match(SPLIT_RE) ?? [])
  const record = Object.fromEntries(chunks.map((chunk) => {
    const idx = chunk.indexOf('=')
    return [chunk.slice(0, idx), chunk.slice(idx + 1).replaceAll('::', ':')]
  }))

  const version = normalizeVersionBucket(record.v)

  return {
    candidateId: createHash('sha1')
      .update(`${ctx.serverId}:${record.name}:${record.start}:${record.end}:${record.v}`)
      .digest('hex'),
    serverId: ctx.serverId,
    playerName: record.name,
    version,
    sourceVersionLabel: record.v,
    startedAt: normalizeXlogTimestamp(record.start),
    endedAt: normalizeXlogTimestamp(record.end),
    rawXlogLine: line
  }
}
```

```ts
export async function syncLogfile(db: Database, input: SyncInput) {
  const previousOffset = offsetRepo.get(...)
  const slice = await downloadOrReadLogfileSlice(...)
  const completeLines = slice.text.split('\n').slice(0, -1)
  candidateRepo.insertMany(db, completeLines.map((line) => parseXlogLine(line, { serverId: input.serverId })))
  offsetRepo.upsert(db, { byteOffset: previousOffset + slice.completeByteLength })
}
```

- [ ] **Step 4: Run targeted tests, then manifest-wide discovery test**

Run: `cd dcss-morgue-pipeline && npm test -- test/discovery/parseXlogLine.test.ts test/discovery/syncLogfile.test.ts`  
Expected: PASS; unsupported versions rejected, duplicate candidate inserts ignored, truncated line not committed, failed/incomplete reads do not advance offsets.

- [ ] **Step 5: Commit**

```bash
git add dcss-morgue-pipeline/src/discovery/parseXlogLine.ts dcss-morgue-pipeline/src/discovery/syncLogfile.ts dcss-morgue-pipeline/src/discovery/discoverCandidates.ts dcss-morgue-pipeline/test/discovery/parseXlogLine.test.ts dcss-morgue-pipeline/test/discovery/syncLogfile.test.ts dcss-morgue-pipeline/test/fixtures/xlog/cao-034.txt
git commit -m "feat: add xlog discovery and offset sync"
```

## Task 5: Implement stratified sampling and shared per-host HTTP queues

**Files:**
- Create: `dcss-morgue-pipeline/src/sampling/selectBootstrapCandidates.ts`
- Create: `dcss-morgue-pipeline/src/sampling/selectIncrementalCandidates.ts`
- Create: `dcss-morgue-pipeline/src/net/hostQueues.ts`
- Create: `dcss-morgue-pipeline/src/fetch/buildMorgueUrl.ts`
- Create: `dcss-morgue-pipeline/src/fetch/fetchMorgue.ts`
- Test: `dcss-morgue-pipeline/test/sampling/selectBootstrapCandidates.test.ts`
- Test: `dcss-morgue-pipeline/test/sampling/selectIncrementalCandidates.test.ts`
- Test: `dcss-morgue-pipeline/test/net/hostQueues.test.ts`
- Test: `dcss-morgue-pipeline/test/fetch/buildMorgueUrl.test.ts`

- [ ] **Step 1: Write failing tests for stratified sampling and per-host serialization**

```ts
it('selects an even bootstrap sample across server/version buckets', () => {
  const selected = selectBootstrapCandidates(seedCandidates(), { perBucket: 2 })
  expect(countByBucket(selected)).toEqual({ 'CAO:0.34': 2, 'CAO:trunk': 2, 'CBRG:0.34': 2, 'CBRG:trunk': 2 })
})

it('allows cross-host parallelism while serializing requests within a host', async () => {
  const queue = createHostQueues({ minDelayMs: 2000 })
  // assert same-host task order, different-host overlap
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dcss-morgue-pipeline && npm test -- test/sampling/selectBootstrapCandidates.test.ts test/net/hostQueues.test.ts`  
Expected: FAIL because sampling/network helpers do not exist.

- [ ] **Step 3: Implement sampling + URL construction + polite host queue**

```ts
export function selectBootstrapCandidates(candidates: CandidateGame[], options: { perBucket: number }) {
  return groupByBucket(candidates).flatMap((bucket) => stableShuffle(bucket).slice(0, options.perBucket))
}
```

```ts
export function createHostQueues({ minDelayMs }: { minDelayMs: number }) {
  const queues = new Map<string, PQueue>()
  return {
    forHost(host: string) {
      if (!queues.has(host)) {
        queues.set(host, new PQueue({ concurrency: 1, intervalCap: 1, interval: minDelayMs }))
      }
      return queues.get(host)!
    }
  }
}
```

```ts
export function buildMorgueUrl(candidate: CandidateGame, server: ServerManifest) {
  if (server.morgueRule.kind === 'rawdata-player-dir') {
    return `${server.morgueRule.baseUrl}/${candidate.playerName}/morgue-${candidate.playerName}-${formatUtcMorgueTimestamp(candidate.endedAt)}.txt`
  }
  return `${server.morgueRule.baseUrl}/${candidate.playerName}/morgue-${candidate.playerName}-${formatUtcMorgueTimestamp(candidate.endedAt)}.txt`
}
```

- [ ] **Step 4: Add fetch tests for 404 caching and success file writes**

Run: `cd dcss-morgue-pipeline && npm test -- test/sampling/selectBootstrapCandidates.test.ts test/sampling/selectIncrementalCandidates.test.ts test/net/hostQueues.test.ts test/fetch/buildMorgueUrl.test.ts`  
Expected: PASS; same-host tasks serialized, different hosts can overlap, the same queue can be used by logfile and morgue fetches, URL rules match fixtures, and 404 status is stored once.

- [ ] **Step 5: Commit**

```bash
git add dcss-morgue-pipeline/src/sampling/selectBootstrapCandidates.ts dcss-morgue-pipeline/src/sampling/selectIncrementalCandidates.ts dcss-morgue-pipeline/src/net/hostQueues.ts dcss-morgue-pipeline/src/fetch/buildMorgueUrl.ts dcss-morgue-pipeline/src/fetch/fetchMorgue.ts dcss-morgue-pipeline/test/sampling/selectBootstrapCandidates.test.ts dcss-morgue-pipeline/test/sampling/selectIncrementalCandidates.test.ts dcss-morgue-pipeline/test/net/hostQueues.test.ts dcss-morgue-pipeline/test/fetch/buildMorgueUrl.test.ts
git commit -m "feat: add sampling and polite host queues"
```

## Task 6: Implement strict parser foundation for base stats, equipment, and skills

**Files:**
- Create: `dcss-morgue-pipeline/src/parser/splitSections.ts`
- Create: `dcss-morgue-pipeline/src/parser/extractBaseStats.ts`
- Create: `dcss-morgue-pipeline/src/parser/extractEquipment.ts`
- Create: `dcss-morgue-pipeline/src/parser/extractSkills.ts`
- Test: `dcss-morgue-pipeline/test/parser/extractBaseStats.test.ts`
- Test: `dcss-morgue-pipeline/test/parser/extractEquipment.test.ts`
- Test: `dcss-morgue-pipeline/test/parser/extractSkills.test.ts`
- Fixtures: `dcss-morgue-pipeline/test/fixtures/morgue/success/*.txt`
- Fixtures: `dcss-morgue-pipeline/test/fixtures/morgue/fail/*.txt`

- [ ] **Step 1: Write failing tests for section-order independence and `none` equipment cases**

```ts
it('extracts version/species/str/int/dex from a reordered morgue', () => {
  const parsed = extractBaseStats(loadFixture('reordered-sections.txt'))
  expect(parsed.species).toBe('Djinni')
  expect(parsed.strength).toBe(8)
})

it('returns bodyArmour=none and shield=none when no worn item is present', () => {
  const parsed = extractEquipment(loadFixture('body-armour-none.txt'))
  expect(parsed.bodyArmour).toBe('none')
  expect(parsed.shield).toBe('none')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dcss-morgue-pipeline && npm test -- test/parser/extractBaseStats.test.ts test/parser/extractEquipment.test.ts test/parser/extractSkills.test.ts`  
Expected: FAIL because parser modules and fixtures are incomplete.

- [ ] **Step 3: Implement section splitting and deterministic extractors**

```ts
export function splitSections(text: string) {
  const lines = text.split('\n')
  return {
    header: findHeaderBlock(lines),
    equipment: findInventoryOrEquippedBlock(lines),
    skills: findSkillsBlock(lines),
    spells: findSpellBlock(lines)
  }
}
```

```ts
export function extractEquipment(text: string): EquipmentSnapshot {
  const equipped = findEquippedLines(text)
  return {
    bodyArmour: normalizeBodyArmour(findSlotItem(equipped, 'body armour') ?? 'none'),
    shield: normalizeShield(findSlotItem(equipped, 'offhand') ?? 'none'),
    helmet: hasSlot(equipped, 'helmet'),
    gloves: hasSlot(equipped, 'gloves'),
    footwear: findFootwear(equipped),
    cloak: hasSlot(equipped, 'cloak')
  }
}
```

- [ ] **Step 4: Run parser foundation tests**

Run: `cd dcss-morgue-pipeline && npm test -- test/parser/extractBaseStats.test.ts test/parser/extractEquipment.test.ts test/parser/extractSkills.test.ts`  
Expected: PASS for valid fixtures; ambiguous fixtures still fail once strict validator is added.

- [ ] **Step 5: Commit**

```bash
git add dcss-morgue-pipeline/src/parser/splitSections.ts dcss-morgue-pipeline/src/parser/extractBaseStats.ts dcss-morgue-pipeline/src/parser/extractEquipment.ts dcss-morgue-pipeline/src/parser/extractSkills.ts dcss-morgue-pipeline/test/parser/extractBaseStats.test.ts dcss-morgue-pipeline/test/parser/extractEquipment.test.ts dcss-morgue-pipeline/test/parser/extractSkills.test.ts dcss-morgue-pipeline/test/fixtures/morgue/success dcss-morgue-pipeline/test/fixtures/morgue/fail
git commit -m "feat: add strict morgue parser foundation"
```

## Task 7: Implement spell extraction, magic modifiers, strict validation, and top-level parse orchestration

**Files:**
- Create: `dcss-morgue-pipeline/src/parser/extractSpells.ts`
- Create: `dcss-morgue-pipeline/src/parser/extractMagicModifiers.ts`
- Create: `dcss-morgue-pipeline/src/parser/validateStrict.ts`
- Create: `dcss-morgue-pipeline/src/parser/parseMorgue.ts`
- Test: `dcss-morgue-pipeline/test/parser/extractSpells.test.ts`
- Test: `dcss-morgue-pipeline/test/parser/extractMagicModifiers.test.ts`
- Test: `dcss-morgue-pipeline/test/parser/parseMorgue.test.ts`

- [ ] **Step 1: Write failing tests for full spell list extraction and hard failure on ambiguous required fields**

```ts
it('extracts all listed spells and failure percentages, including unmemorized entries', () => {
  const spells = extractSpells(loadFixture('spell-list-full.txt'))
  expect(spells).toContainEqual({ name: 'Fireball', failurePercent: 12, memorized: false })
})

it('normalizes a missing spell section to an empty list', () => {
  const result = parseMorgue(loadFixture('no-spell-section.txt'), fixtureMeta())
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.record.spells).toEqual([])
})

it('fails the whole parse when wizardry is ambiguous', () => {
  const result = parseMorgue(loadFixture('ambiguous-wizardry.txt'), fixtureMeta())
  expect(result.ok).toBe(false)
  expect(result.failure.reason).toBe('wizardry_parse_failed')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dcss-morgue-pipeline && npm test -- test/parser/extractSpells.test.ts test/parser/extractMagicModifiers.test.ts test/parser/parseMorgue.test.ts`  
Expected: FAIL because spell/magic/validator modules do not exist.

- [ ] **Step 3: Implement spell and validator pipeline**

```ts
export function extractSpells(text: string): SpellSnapshot[] {
  const spellLines = findSpellLines(text)
  if (!spellLines) return []

  return spellLines.map((line) => {
    const match = line.match(/^(?<memorized>\*?)\s*(?<name>.+?)\s+(?<failure>\d+)%$/)
    if (!match?.groups) throw new ParseFailure('spell_section_parse_failed')
    return {
      name: match.groups.name.trim(),
      failurePercent: Number(match.groups.failure),
      memorized: match.groups.memorized === '*'
    }
  })
}
```

```ts
export function validateStrict(row: Partial<ParsedMorgueRecord>): ParsedMorgueRecord {
  if (!row.species) throw new ParseFailure('missing_required_field', 'species')
  if (row.spells === undefined) throw new ParseFailure('spell_section_parse_failed')
  if (row.bodyArmour === undefined) throw new ParseFailure('ambiguous_body_armour')
  return row as ParsedMorgueRecord
}
```

- [ ] **Step 4: Run full parser tests**

Run: `cd dcss-morgue-pipeline && npm test -- test/parser/extractSpells.test.ts test/parser/extractMagicModifiers.test.ts test/parser/parseMorgue.test.ts`  
Expected: PASS for success fixtures, FAIL fixtures converted into structured failure objects with reason codes.

- [ ] **Step 5: Commit**

```bash
git add dcss-morgue-pipeline/src/parser/extractSpells.ts dcss-morgue-pipeline/src/parser/extractMagicModifiers.ts dcss-morgue-pipeline/src/parser/validateStrict.ts dcss-morgue-pipeline/src/parser/parseMorgue.ts dcss-morgue-pipeline/test/parser/extractSpells.test.ts dcss-morgue-pipeline/test/parser/extractMagicModifiers.test.ts dcss-morgue-pipeline/test/parser/parseMorgue.test.ts
git commit -m "feat: add strict spell parsing and validation"
```

## Task 8: Wire bootstrap/incremental CLI workflows and audit bundle output

**Files:**
- Create: `dcss-morgue-pipeline/src/pipeline/runBootstrap.ts`
- Create: `dcss-morgue-pipeline/src/pipeline/runIncremental.ts`
- Create: `dcss-morgue-pipeline/src/audit/writeAuditBundle.ts`
- Modify: `dcss-morgue-pipeline/src/cli.ts`
- Modify: `dcss-morgue-pipeline/README.md`
- Test: `dcss-morgue-pipeline/test/pipeline/runBootstrap.test.ts`
- Test: `dcss-morgue-pipeline/test/pipeline/runIncremental.test.ts`

- [ ] **Step 1: Write failing workflow tests**

```ts
it('runs bootstrap discovery -> sampling -> fetch -> parse -> store', async () => {
  const summary = await runBootstrap(testContext())
  expect(summary.selectedCandidates).toBe(8)
  expect(summary.parsedSuccesses + summary.parsedFailures).toBe(8)
})

it('writes an audit bundle containing sampled success and failure rows', async () => {
  const path = await writeAuditBundle(testContext(), { sampleSize: 4 })
  expect(path).toMatch(/data\/audit\/.+\.json$/)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dcss-morgue-pipeline && npm test -- test/pipeline/runBootstrap.test.ts test/pipeline/runIncremental.test.ts`  
Expected: FAIL because pipeline/audit modules are not implemented.

- [ ] **Step 3: Implement orchestrators and operator docs**

```ts
export async function runBootstrap(ctx: PipelineContext) {
  await migrate(ctx.db)
  await discoverCandidates(ctx)
  const selected = await selectBootstrapCandidatesFromDb(ctx.db, ctx.options.perBucket)
  await fetchSelectedMorgues(ctx, selected)
  return parseFetchedMorgues(ctx, selected)
}
```

```ts
export async function runIncremental(ctx: PipelineContext) {
  await discoverCandidates(ctx)
  const selected = await selectIncrementalCandidatesFromDb(ctx.db, ctx.options.since)
  await fetchSelectedMorgues(ctx, selected)
  return parseFetchedMorgues(ctx, selected)
}
```

```md
## Commands
- `npm run bootstrap`
- `npm run incremental`
- `npm run audit`

## CLI Notes
- `--fresh` resets the SQLite DB, fetched morgues, and audit output, but preserves cached logfile slices.
- `--fresh-logfiles` also clears cached logfile slices.
- `--initial-tail-bytes` controls the first tail window used for unseen logfile buckets.
- `--backfill-chunk-bytes` allows bootstrap to fetch older logfile chunks when the current discovered window is too small for the requested `--per-bucket`.
- `--verbose` prints logfile reuse/fetch decisions, candidate selection, fetch URLs, and parse outcomes.
- `--min-delay-ms` applies to the shared host queue used by both logfile discovery and morgue fetching.
- Candidate fetch/parse execution may run across hosts in parallel while preserving host-local pacing.
```

- [ ] **Step 4: Run full project verification**

Run: `cd dcss-morgue-pipeline && npm test && npm run typecheck`  
Expected: All tests PASS, typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add dcss-morgue-pipeline/src/pipeline/runBootstrap.ts dcss-morgue-pipeline/src/pipeline/runIncremental.ts dcss-morgue-pipeline/src/audit/writeAuditBundle.ts dcss-morgue-pipeline/src/cli.ts dcss-morgue-pipeline/README.md dcss-morgue-pipeline/test/pipeline/runBootstrap.test.ts dcss-morgue-pipeline/test/pipeline/runIncremental.test.ts
git commit -m "feat: wire pipeline workflows and audit output"
```

## Final Verification

- [ ] Run: `cd dcss-morgue-pipeline && npm test`
- [ ] Run: `cd dcss-morgue-pipeline && npm run typecheck`
- [ ] Run: `cd dcss-morgue-pipeline && npm run bootstrap -- --help`
- [ ] Run: `cd dcss-morgue-pipeline && npm run incremental -- --help`
- [ ] Confirm `README.md` documents storage layout, shared host politeness limits, bootstrap workflow, audit bundle generation, and CLI options such as `--fresh`, `--fresh-logfiles`, `--initial-tail-bytes`, `--backfill-chunk-bytes`, and `--verbose`.

## Notes for the Implementer

- Keep parser functions pure whenever possible; reserve side effects for discovery/fetch/pipeline modules.
- Treat ambiguity as failure, not as a best-effort parse.
- Keep raw morgues on disk even for failed parses.
- Record reason codes for every strict failure.
- Prefer adding new fixtures before widening regexes.
- Do not add LLM-in-the-loop parsing in v1; audit output only.
- Use fixture names that make failure causes obvious (`ambiguous-shield.txt`, `spell-section-parse-failed.txt`, etc.).
- If a server-specific URL rule does not fit the common pattern, encode it in `manifest.ts`, not in parser code.
