# Parser Design Changelog

This document records the major parser model changes, what changed, and why.

It complements [PARSER_MODEL.md](/Users/hyeon/playground/dcss-stats/packages/morgue-parser/PARSER_MODEL.md):

- `PARSER_MODEL.md` explains the current model
- `PARSER_CHANGELOG.md` explains how we got there and why the structure became
  more detailed over time

The parser is used by:

- the SQLite-backed dataset pipeline
- the browser paste parser UI
- downstream analysis and helper tools

Because of that, most changes below were driven by one principle:

- prefer reusable semantic fields over one-off presentation strings

## 1. Raw Morgue Version Preservation

### What changed

The parser now stores the raw morgue version token, for example:

- `0.34.1`
- `0.35-a0-257-gf9e06672e4`

instead of collapsing parsed output to a coarse bucket like `trunk`.

### Why

For trunk games, the commit suffix matters. Two morgues from:

- `0.35-a0-256-g859e8e3ba0`
- `0.35-a0-257-gf9e06672e4`

can come from meaningfully different game states.

The pipeline still keeps its own sampling buckets like `0.34` and `trunk`, but
the parsed row preserves the exact morgue version so downstream tools can:

- compare parser behavior across upstream Crawl revisions
- group runs by exact trunk build
- audit version-specific item or mutation behavior

## 2. Background Extraction

### What changed

The parser now stores `background` in addition to `species`, and preserves
`speciesVariant` when the canonical `species` loses useful detail.

Examples:

- `Formicid Fighter` -> `species: "Formicid"`, `background: "Fighter"`
- `Djinni Fire Elementalist` -> `species: "Djinni"`, `background: "Fire Elementalist"`
- `Red Draconian Summoner` -> `species: "Draconian"`, `speciesVariant: "Red Draconian"`, `background: "Summoner"`

### Why

Downstream tools often care about build archetype, not only species.

`species` alone is not enough for questions like:

- "how many Hexslingers reached Vaults?"
- "which backgrounds correlate with certain spell sets?"
- "which equipment patterns show up on Fighters vs Monks?"

This also matches how players actually talk about runs:

- species + background, not species alone

## 2.5. XL Extraction

### What changed

The parser now stores `xl` from the morgue stat line.

Examples:

- `XL:     1` -> `xl: 1`
- `XL:     27` -> `xl: 27`

### Why

`XL` is one of the most common grouping and power-level fields used by
downstream tooling.

It is also part of the same stable header block as:

- `AC`
- `EV`
- `SH`
- `Str`
- `Int`
- `Dex`

so it belongs in the same base-stats layer instead of being re-derived later.

## 3. Skills vs Effective Skills

### What changed

The parser now stores:

- `skills`
- `effectiveSkills`

instead of only a flattened skill list.

For a morgue line like:

```text
- Level 15.2(19.5) Fighting
```

the parser stores:

- `skills.fighting = 15.2`
- `effectiveSkills.fighting = 19.5`

### Why

The value shown in parentheses is the current displayed value after modifiers.
That matters for effects such as:

- Ashenzari boosts
- Heroism
- other temporary or passive skill modifiers

This split preserves:

- the stable trained skill level
- the effective current value seen by the player

without forcing every consumer to re-parse the original skill table string.

## 4. Mutations Became Structured Entries

### What changed

`mutations` changed from a flat string list to:

```ts
type MutationEntrySnapshot = {
  name: string
  level: number | null
}
```

Examples:

- `robust 3` -> `{ name: "robust", level: 3 }`
- `wild magic 1` -> `{ name: "wild magic", level: 1 }`
- `big wings` -> `{ name: "big wings", level: null }`

Parenthesized legacy entries are also normalized:

- `(nimble swimmer 1)` -> `{ name: "nimble swimmer", level: 1 }`

### Why

Mutation level matters for analysis.

A flat string is enough to render text, but not enough to answer:

- "does this character have robust at all?"
- "what level of robust?"
- "group all runs with wild magic regardless of level"

The parser still intentionally uses the `A:` line as the source of truth, so
this list includes:

- species innates
- form-derived traits
- actual mutations

That is deliberate: the goal is to preserve the active trait state at game end.

## 5. Equipment Summary vs Equipment Details

### What changed

The parser now keeps two layers for equipped items:

1. summary fields at the top level
2. semantic `...Details` objects

Examples:

- `bodyArmour`
- `shield`
- `helmets`
- `gloves`
- `footwear`
- `cloaks`
- `rings`

plus:

- `bodyArmourDetails`
- `shieldDetails`
- `helmetDetails`
- `glovesDetails`
- `footwearDetails`
- `cloakDetails`
- `ringDetails`

The summary fields now preserve the cleaned morgue-facing names.

Examples:

- `fire dragon scales of Undesirable Species`
- `ring of the Byakko`
- `Mad Mage's Maulers`

### Why

Downstream needs two different things:

1. the visible name the morgue showed
2. a semantic decomposition of the item

If we normalize too aggressively at the summary level, we lose auditability.
If we keep only strings, we lose semantic reuse.

So the current split is:

- summary fields are close to the raw morgue
- detail fields are close to Crawl's item model

This mirrors Crawl better, because Crawl internally stores something much closer
to:

- slot -> `item_def`

than:

- slot -> rendered string

Relevant Crawl source:

- [item-def.h](/Users/hyeon/playground/dcss-stats/crawl/crawl-ref/source/item-def.h)
- [player-equip.h](/Users/hyeon/playground/dcss-stats/crawl/crawl-ref/source/player-equip.h)
- [equipment-slot.h](/Users/hyeon/playground/dcss-stats/crawl/crawl-ref/source/equipment-slot.h)
- [player-equip.cc](/Users/hyeon/playground/dcss-stats/crawl/crawl-ref/source/player-equip.cc)

## 6. Armour Ego vs Jewellery Subtype vs Artefact

### What changed

The equipment detail model now distinguishes:

- `baseType`
- `enchant`
- `artifactKind`
- `ego`
- `subtypeEffect`

Examples:

- `+3 buckler {rC+}`
  - `baseType = "buckler"`
  - `artifactKind = "normal"`
  - `ego = "cold resistance"`

- `ring of wizardry`
  - `baseType = "ring"`
  - `artifactKind = "normal"`
  - `subtypeEffect = "wizardry"`

- `fire dragon scales of Undesirable Species`
  - `baseType = "fire dragon scales"`
  - `artifactKind = "randart"`
  - `ego = null`

### Why

These are not the same concept in Crawl.

For armour:

- `hat of intelligence`
- `buckler of cold resistance`

are ordinary armour base items plus an armour ego.

For jewellery:

- `ring of wizardry`
- `amulet of magic regeneration`

behave more like subtype families than armour egos.

Randarts and unrands are another layer again.

Keeping them separate makes it possible to answer:

- "is this a normal ego item?"
- "is this jewellery subtype fixed or artefact-driven?"
- "is this item generic, randart, or unrand?"

Relevant Crawl source:

- [item-name.cc](/Users/hyeon/playground/dcss-stats/crawl/crawl-ref/source/item-name.cc)
- [item-prop.cc](/Users/hyeon/playground/dcss-stats/crawl/crawl-ref/source/item-prop.cc)

## 7. Property Strings Became Structured Property Bags

### What changed

Equipment properties used to be stored mainly as string arrays like:

```json
["rF++", "rC-", "Will+", "Int+6"]
```

They now use structured bags:

```ts
type EquipmentPropertyBag = {
  numeric: Partial<Record<string, number>>
  flags: Partial<Record<string, true>>
  specials: string[]
}
```

and the parser stores four of them:

- `intrinsicProperties`
- `egoProperties`
- `artifactProperties`
- `properties`

### Why

String arrays were not good enough for stacked properties.

Example:

- `pearl dragon scales` intrinsically grant `rN+`
- a randart roll adds another `rN+`
- Crawl displays the result as `rN++`

A string-array parser could easily end up with nonsense like:

```json
["rN+", "rN++"]
```

The new model stores the real semantic result:

```json
{
  "intrinsicProperties": { "numeric": { "rN": 1 }, "flags": {}, "specials": [] },
  "artifactProperties": { "numeric": { "rN": 1 }, "flags": {}, "specials": [] },
  "properties": { "numeric": { "rN": 2 }, "flags": {}, "specials": [] }
}
```

This is much closer to Crawl's internal property model, where:

- base-item intrinsic properties are one source
- ego properties are another source
- artefact properties are another source
- the displayed effect is the merged total

Relevant Crawl source:

- [artefact.h](/Users/hyeon/playground/dcss-stats/crawl/crawl-ref/source/artefact.h)
- [artefact.cc](/Users/hyeon/playground/dcss-stats/crawl/crawl-ref/source/artefact.cc)
- [item-prop.cc](/Users/hyeon/playground/dcss-stats/crawl/crawl-ref/source/item-prop.cc)

### Why keep `propertiesText` too

`propertiesText` is still preserved because morgues are the raw source and not
every token can be confidently mapped to a numeric or boolean property.

This is especially useful for:

- audit/debugging
- future parser improvements
- niche effects that still live in `specials`

## 8. Poltergeist and Haunted Aux Slots

### What changed

The parser now supports multiple equipped auxiliary items for:

- `helmets`
- `gloves`
- `footwear`
- `cloaks`

These are arrays, not single values.

Each detail entry also records:

- `equipState = "worn" | "haunted" | "melded"`

### Why

Poltergeist equipment rules do not match a normal single-slot model. Crawl
gives Poltergeist haunted aux capacity, and morgues explicitly show those items
as `(haunted)`.

If the parser forced a normal one-item-per-slot model, it would:

- silently drop equipped items
- misrepresent Poltergeist gear state

Relevant Crawl source:

- [equipment-slot.h](/Users/hyeon/playground/dcss-stats/crawl/crawl-ref/source/equipment-slot.h)
- [player-equip.cc](/Users/hyeon/playground/dcss-stats/crawl/crawl-ref/source/player-equip.cc)

## 9. Melded Equipment and Form State

### What changed

The parser now preserves:

- `equipState = "melded"` for melded gear
- `talisman`
- `talismanDetails`
- `form`

Examples:

- `death talisman of Lan Byow`
- `granite talisman "Iffich"`
- `form = "death-form"`
- `form = "statue-form"`

### Why

For shapeshifting or form-aware tools, the current body state matters just as
much as species or inventory.

Without explicit form parsing, downstream tools cannot reliably answer:

- "was this character in a form at death?"
- "which talisman was active?"
- "why was body armour melded?"

This also matters for validating equipped state against what the header shows.

## 10. Default Spell Canonicalization

### What changed

The shared parser now ships with a built-in canonical spell list, so truncated
morgue spell names are restored by default.

Examples:

- `Lehudib's Crystal Sp` -> `Lehudib's Crystal Spear`
- `Nazja's Percussive T` -> `Nazja's Percussive Tempering`
- `Iskenderun's Mystic Bla` -> `Iskenderun's Mystic Blast`

### Why

This makes browser-side parsing and pipeline-side parsing agree without needing
an external vocabulary wrapper in every call site.

It also prevents drift where:

- the pipeline sees canonical spell names
- but the browser paste tool still sees truncated table labels

## 11. Full Morgue Goldens as the Main Regression Safety Net

### What changed

The parser now leans heavily on full-morgue golden fixtures under:

- [dcss-morgue-pipeline/test/fixtures/morgue/full](/Users/hyeon/playground/dcss-stats/dcss-morgue-pipeline/test/fixtures/morgue/full)

with expected output under:

- [dcss-morgue-pipeline/test/fixtures/morgue/expected](/Users/hyeon/playground/dcss-stats/dcss-morgue-pipeline/test/fixtures/morgue/expected)

### Why

Small synthetic tests are still useful, but many parser bugs only show up when
all of these interact at once:

- wrapped mutation lines
- inventory descriptions interleaved with equipped items
- Ashenzari cursed equipment
- Poltergeist haunted aux gear
- talisman + form state
- truncated spell tables
- older vs newer skill table formats

The full golden set makes it much easier to:

- add a real morgue
- inspect the parsed JSON
- tighten the parser
- lock the behavior in place

## Summary

The parser became more detailed because downstream consumers need to ask more
than "what pretty text was on the morgue screen?"

The current model tries to keep both:

- raw morgue-faithful values for auditability
- semantic fields that are useful for analytics, helper tools, and build-aware
  logic

In practice, that is why the parser now preserves:

- exact version strings
- background
- base and effective skills
- structured mutations
- explicit form/talisman state
- raw equipment names
- semantic equipment details
- source-aware property bags
