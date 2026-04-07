# DCSS Morgue Parsing and Sampling Pipeline Design

**Date:** 2026-04-05  
**Status:** Revised design  
**Scope:** Build a strict morgue parsing dataset pipeline for DCSS 0.34 and trunk

## Goal

Build a pipeline that:

1. discovers candidate DCSS games from public server logfiles/xlogfiles,
2. fetches corresponding morgue files from active public servers,
3. parses each morgue into a strict normalized JSON record,
4. rejects any morgue whose required fields cannot be extracted with high confidence,
5. periodically samples newly added morgues for ongoing parser evaluation and dataset growth.

The pipeline is for research/data extraction, not end-user presentation. Correct failure is preferred over partial or guessed output.

## Confirmed Requirements

### Target sources

- Target pipeline buckets are **`0.34`** and **`trunk`** only.
- Source version labels may differ by server, for example `git` or `trunk`.
- Source labels must be normalized through an explicit manifest mapping.
- Any source version that does not map unambiguously to `0.34` or `trunk` must be rejected rather than silently coerced.
- Initial bootstrap should use **server/version-stratified sampling** rather than fully random sampling.
- Ongoing sampling should check for new data every **6 hours**.

### Fetch behavior

- Use **xlog/logfile** as the discovery/index layer.
- Use **morgue files** as the primary extraction source.
- Apply the same politeness policy to both logfile fetches and morgue fetches:
  - per-host concurrency = 1
  - minimum delay between requests to the same host = 2 seconds initially
  - different hosts may be fetched in parallel

### Required extracted fields

The parser must extract these fields successfully or mark the morgue as failed.

#### Required base fields

- `version`
- `species`
- `strength`
- `intelligence`
- `dexterity`

#### Required equipment-derived fields

- `bodyArmour` (canonical label; `none` allowed)
- `shield` (canonical label; `none` allowed)
- `helmet` (boolean)
- `gloves` (boolean)
- `footwear` (boots/barding slot summary)
- `cloak` (boolean)

#### Required skill/stat fields

- `armourSkill`
- `dodgingSkill`
- `shieldSkill`
- `spellcasting`
- `schoolSkills` (all spell schools listed in the morgue with numeric values)

#### Required spell-related fields

- if the morgue contains a spell listing, capture the full spell list, including spells not currently memorized if they appear in the listing
- failure rate for each listed spell
- `wizardry`
- `channel`
- `wildMagic`

### Normalization requirements

- Equipment should be stored as **canonical labels**, not raw morgue item strings.
- Example: `+2 robe of Willpower` should normalize to `robe`.
- Raw morgue text should still be retained for debugging/audit, but the dataset output is normalized.
- Absence of a spell section should normalize to `spells: []`, not an automatic failure.

### Failure policy

- The parser runs in **strict mode**.
- If any required field is ambiguous, unparsable, or not normalizable with confidence, the entire morgue is marked as **failed**.
- Clean absence is allowed where the schema permits it, for example `bodyArmour = none`, `shield = none`, or `spells = []`.
- Partial-success output is not acceptable for dataset rows.

## Why Morgue-First Parsing Is Necessary

The desired features are not fully available from xlog/logfile alone. Morgues are needed because they contain the character snapshot required for downstream analysis, including:

- final species/stat state
- worn armour/shield slot state
- skill values
- spell list and failure rates when present
- modifier information such as wizardry/channel/wildMagic

Therefore:

- **xlog/logfile** is the authoritative discovery/index source
- **morgue** is the authoritative extraction source

## Architecture Overview

The system has five major components:

1. **Server manifest** — describes active servers, version-specific logfile paths, version-label mappings, morgue URL rules, and special cases.
2. **Discovery fetcher** — incrementally downloads logfile/xlogfile updates and emits candidate game records.
3. **Sampler** — chooses which candidates become morgue fetch jobs.
4. **Morgue fetcher** — resolves and downloads morgues under polite per-host rate limits.
5. **Strict parser + validator** — transforms morgue text into normalized JSON or records a failure.

## Component Design

### 1. Server manifest

Maintain a manifest for active servers that support normalized `0.34` and/or `trunk`. Each entry should include:

- server identifier / abbreviation
- base host
- logfile/xlogfile URL templates for the normalized buckets
- source version label used by the upstream server, for example `0.34`, `git`, or `trunk`
- morgue URL construction rule
- any server-specific naming differences or path prefixes
- active/dormant flag

The manifest should be explicit rather than inferred at runtime. In this repo, the source of truth should be the existing `dcss-stats` server definitions already checked into code, with the new pipeline deriving a focused snapshot from them instead of inventing a second manually maintained manifest.

### 2. Discovery layer (xlog/logfile)

Discovery is incremental:

- keep a byte offset per `(server, version, logfile)` source
- fetch only appended content since the last successful read
- parse new lines into candidate games
- persist enough metadata to later derive a morgue URL

Required candidate metadata:

- stable `candidateId`
- server id
- normalized version bucket (`0.34` or `trunk`)
- source version label from the upstream logfile
- player name
- game start timestamp
- game end timestamp
- source logfile id or URL
- raw xlog line for audit/debugging

`candidateId` must include server identity. A safe basis is `(serverId, playerName, startedAt, endedAt, sourceVersionLabel)`.

This layer should not attempt to replace morgue parsing. It exists only to find games and provide URL construction inputs.

### 3. Sampling layer

Two sampling modes are needed.

#### Bootstrap mode

For the initial dataset:

- build buckets by `(server, version)`
- sample evenly across buckets
- target a few hundred morgues total

This reduces overfitting to a single server’s wording/layout quirks and gives coverage across 0.34 vs trunk.

#### Incremental mode

Every 6 hours:

- read newly discovered candidate games since the last sampling checkpoint
- sample a bounded subset from each `(server, version)` bucket
- persist sampling decisions so the same candidate is not repeatedly re-selected

The exact per-bucket quota can be tuned later, but the design should support both:

- fixed count per bucket
- proportional rate with per-bucket caps

### 4. Morgue fetcher

The morgue fetcher should:

- derive a morgue URL from `(server rule, player name, end timestamp)`
- fetch only sampled candidates
- cache results locally
- record fetch outcomes (`success`, `404`, `timeout`, `invalid`, etc.)

Rate limiting policy:

- per-host concurrency = 1
- minimum delay between requests to the same host = 2 seconds initially
- different hosts may process in parallel
- short timeout
- conservative retry policy
- cache 404s to avoid repeated misses

This is intentionally polite and should avoid overloading volunteer-run servers.

### 5. Persistence layer

Use SQLite for pipeline state and filesystem storage for raw files.

SQLite should track at least:

- logfile offsets
- candidate games
- morgue fetch outcomes
- parse results

Filesystem should retain:

- downloaded logfile snapshots or slices
- raw morgue text, including failed parses
- audit bundles

## Parser Design

### Parser stages

The parser should be stage-based rather than one large regex pass.

1. **Load**
   - read morgue text
   - attach fetch metadata

2. **Section identification**
   - detect sections by heading/pattern rather than fixed order
   - do not assume a single canonical `dump_order`

3. **Field extraction**
   - extract required scalar fields
   - extract equipment state
   - extract skills
   - extract spell list and failure rates when a spell section exists
   - extract wizardry/channel/wildMagic

4. **Normalization**
   - map equipment names to canonical labels
   - normalize school names
   - parse percentages/numeric values into typed fields
   - normalize a clearly absent spell section to `[]`

5. **Strict validation**
   - reject on missing field
   - reject on ambiguous extraction
   - reject on normalization failure
   - reject on structurally inconsistent spell data

6. **Write result**
   - success => normalized JSON record
   - failure => structured error record with reason codes

### Why section-order independence matters

Players can configure aspects of dump generation, especially section inclusion and ordering. The parser therefore must treat morgues as **semi-structured text with recognizable sections**, not as a fixed-position template.

Assumption:

- the semantic sections remain recognizable enough to parse reliably
- section order and optional section presence may vary

The design explicitly does **not** assume complete freedom to redefine the entire morgue format.

## Output Schema

Each successful parse should produce one normalized JSON object.

```json
{
  "candidateId": "sha1:...",
  "server": "CAO",
  "version": "0.34",
  "sourceVersionLabel": "0.34",
  "player": "example",
  "startTime": "2026-04-05T00:10:00Z",
  "endTime": "2026-04-05T01:23:45Z",
  "morgueUrl": "https://...",
  "species": "Djinni",
  "strength": 8,
  "intelligence": 19,
  "dexterity": 14,
  "bodyArmour": "robe",
  "shield": "none",
  "helmet": false,
  "gloves": true,
  "footwear": ["pair of boots"],
  "cloak": false,
  "armourSkill": 2.3,
  "dodgingSkill": 8.1,
  "shieldSkill": 0,
  "spellcasting": 12.4,
  "schoolSkills": {
    "conjurations": 11.2,
    "fireMagic": 9.7,
    "hexes": 0
  },
  "spells": [
    { "name": "Mystic Blast", "failurePercent": 3, "memorized": true },
    { "name": "Fireball", "failurePercent": 12, "memorized": false }
  ],
  "wizardry": 1,
  "channel": 0,
  "wildMagic": 0
}
```

Notes:

- `bodyArmour` and `shield` allow `none`.
- Boolean slot fields indicate worn presence, not inventory presence.
- `spells` contains the full listed spell set available in the morgue spell listing, not only memorized spells.
- `spells` may be `[]` when the morgue clearly has no spell section.
- Numeric modifier fields should use one consistent integer encoding; the scale must be explicit and testable.

## Failure Model

A parse fails if any required field cannot be extracted confidently.

Suggested failure reasons:

- `missing_required_field`
- `unsupported_candidate_version`
- `ambiguous_body_armour`
- `ambiguous_shield`
- `equipment_normalization_failed`
- `stat_parse_failed`
- `skill_parse_failed`
- `school_skill_parse_failed`
- `spell_section_parse_failed`
- `spell_list_structure_invalid`
- `wizardry_parse_failed`
- `channel_parse_failed`
- `wild_magic_parse_failed`
- `unsupported_morgue_layout`

Each failure record should preserve:

- morgue URL
- server/version
- local file path or object id
- failure code
- short diagnostic detail
- raw morgue text reference

## Validation and QA

Validation has two layers.

### 1. Deterministic validation

Run on every parse result.

Examples:

- all required fields present
- numeric fields parse to valid numbers
- spell entries each have a name and failure percentage when a spell section exists
- normalized armour/shield values belong to known canonical sets
- boolean equipment slots are actually booleans

### 2. Audit validation with LLM assistance

Use an LLM only as an **auditor**, not as the primary parser.

Recommended LLM tasks:

- compare morgue text vs parsed JSON for sampled outputs
- classify parser failures into useful categories
- identify recurring layout variants that need extractor updates

Do **not** use the LLM to generate final dataset rows directly. That would reduce determinism and make strict validation harder.

## Error Handling

### Discovery errors

- If a logfile fetch fails, keep the previous offset and retry later.
- Do not advance offsets on incomplete or failed reads.
- Unsupported source versions should be rejected explicitly, not bucketed into trunk by default.

### Morgue fetch errors

- 404 should be cached and not hammered repeatedly.
- timeouts should be retryable with low retry count.
- repeated host errors should not block other hosts.

### Parse errors

- parse failures should not block the pipeline
- failed morgues should be stored for later investigation
- success/failure rates should be measurable per server and version

## Testing Strategy

### Unit tests

- version-label normalization
- section detectors
- equipment normalization
- numeric stat parsing
- school skill parsing
- spell list/failure extraction
- wizardry/channel/wildMagic extraction
- strict validator failure cases

### Fixture tests

Create a corpus of real sampled morgues from multiple servers and both target versions.

Fixture categories:

- clean successful parses
- missing/odd sections
- body armour = none
- shield = none
- no spell section
- unusual equipment names
- trunk-specific wording/layout variants
- server-specific quirks

### Pipeline tests

- manifest URL resolution
- shared host queue/rate-limit behavior
- sampling bucket behavior
- idempotent incremental discovery

## Non-Goals for This Version

- support for versions older than 0.34
- graceful partial-success dataset rows
- full raw-item semantic parsing beyond canonical equipment class
- direct morgue directory crawling as the primary discovery strategy
- using LLMs as the main extraction engine

## Remaining Decisions

These details still need final numeric or domain choices, but they no longer block the architecture:

1. exact canonical label set for body armour and shield normalization
2. exact numeric encoding for `wizardry`, `channel`, and `wildMagic`
3. exact incremental sampling quotas per `(server, version)` bucket

## Recommended Implementation Direction

Use a **hybrid xlog-index + morgue-parse architecture**:

- xlog/logfile for polite, incremental game discovery
- stratified sampling for representative coverage
- one shared per-host queue policy for both discovery and morgue fetches
- strict deterministic parsing
- LLM-assisted audit only

This is the most reliable design for building a high-confidence DCSS morgue dataset focused on normalized 0.34 and trunk coverage.
