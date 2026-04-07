# Morgue Parser

Browser-safe DCSS morgue parser core.

It parses pasted morgue text into structured JSON without any filesystem or
network access.

The parser ships with built-in canonical spell names and also accepts optional
canonical vocabularies for:

- species names
- spell names

The extraction model and its Crawl-source rationale are documented in
[PARSER_MODEL.md](/Users/hyeon/playground/dcss-stats/packages/morgue-parser/PARSER_MODEL.md).

A change-oriented explanation of what evolved in the parser and why is in
[PARSER_CHANGELOG.md](/Users/hyeon/playground/dcss-stats/packages/morgue-parser/PARSER_CHANGELOG.md).

Pipeline-specific metadata such as `serverId`, `candidateId`, `endedAt`, and
`morgueUrl` should be added by a wrapper outside this package.

## Usage

```ts
import { parseMorgueText } from '@dcss-stats/morgue-parser'

const result = parseMorgueText(morgueText)

if (result.ok) {
  console.log(result.record.species, result.record.ac, result.record.spells)
} else {
  console.error(result.failure.reason, result.failure.detail)
}
```

The built-in spell list already restores most truncated spell-table names. If a
caller wants to supplement or override that vocabulary, it can pass extra
spell names:

```ts
parseMorgueText(morgueText, {
  canonicalSpellNames: ["Iskenderun's Mystic Blast", 'Construct Spike Launcher'],
})
```
