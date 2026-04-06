# Morgue Parser

Browser-safe DCSS morgue parser core.

It parses pasted morgue text into structured JSON without any filesystem or
network access.

The parser accepts optional canonical vocabularies for:

- species names
- spell names

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

If the caller has access to a canonical spell list, it can restore truncated
spell-table names:

```ts
parseMorgueText(morgueText, {
  canonicalSpellNames: ["Iskenderun's Mystic Blast", 'Construct Spike Launcher'],
})
```
