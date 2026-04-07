# Morgue Parser Model

This document explains what the parser extracts, why the output is structured
the way it is, and which parts of the DCSS source tree informed the model.

The short version is:

- we do not want a thin "pretty string" parser
- we want a stable data model that downstream tools can query
- we therefore keep both a raw summary view and a more semantic detailed
  view for equipment and related character state

## Goals

The parser is used in more than one place:

- the dataset pipeline
- the browser paste UI
- downstream analysis and helper tools

Because of that, the model prefers:

- stable normalized fields over presentation-only strings
- enough structure to answer questions like:
  - "is this a normal hat of intelligence or a randart hat?"
  - "does this armour grant `rF++` intrinsically, or via artefact properties?"
  - "what exact skills does this character have?"
  - "what mutations or innate traits were active at death/escape?"

## Parser Pipeline

`parseMorgueText()` builds a record from five extractors:

1. `extractBaseStats()`
2. `extractEquipment()`
3. `extractSkills()`
4. `extractMutations()`
5. `extractSpells()`

The combined row is then validated by `validateStrict()`.

Code:

- `packages/morgue-parser/src/parseMorgueText.ts`
- `packages/morgue-parser/src/validateStrict.ts`

## Crawl Source References

The equipment model follows Crawl's item concepts rather than only the printed
English strings in morgues.

The main references are:

- `crawl/crawl-ref/source/item-def.h`
  - base item object categories like `OBJ_ARMOUR`, `OBJ_JEWELLERY`
  - subtype concept for specific items inside those categories
- `crawl/crawl-ref/source/item-name.cc`
  - how normal items, ego items, and artefacts are rendered into player-facing
    names
  - especially useful for distinguishing armour egos from jewellery subtypes
- `crawl/crawl-ref/source/item-prop.cc`
  - which armour egos are legal for which subtypes
  - intrinsic properties on armour bases such as dragon scales
- `crawl/crawl-ref/source/artefact.h`
  - fixed unrand property storage
- `crawl/crawl-ref/source/artefact.cc`
  - artefact property enumeration and the code paths that combine intrinsic item
    properties with artefact properties for display/evaluation

These files are the reason the parser treats these as different concepts:

- armour base type
- armour ego
- jewellery subtype effect
- randart/unrand artefact properties
- intrinsic base-item properties

## How Crawl Actually Stores Equipped Items

Crawl does not store a string like `"fire dragon scales of Undesirable Species"`
in a body-armour slot.

Instead, the player has an equipment set that points at actual inventory items.

Relevant structures:

- `crawl/crawl-ref/source/player-equip.h`
  - `player_equip_set`
  - `player_equip_entry`
- `crawl/crawl-ref/source/equipment-slot.h`
  - slot enums such as `SLOT_BODY_ARMOUR`, `SLOT_HELMET`, `SLOT_GLOVES`,
    `SLOT_BOOTS`, `SLOT_BARDING`, `SLOT_CLOAK`, `SLOT_RING`, `SLOT_AMULET`
  - `SLOT_HAUNTED_AUX` for poltergeist-compatible haunted auxiliary equipment
- `crawl/crawl-ref/source/player-equip.cc`
  - compatible slot mapping, including how `SLOT_HAUNTED_AUX` expands to
    helmet/gloves/boots/cloak compatibility
- `crawl/crawl-ref/source/item-def.h`
  - `item_def`

At a high level:

- `player_equip_set.items` is a list of equipped entries
- each `player_equip_entry` points to an inventory item and the slot it occupies
- the underlying `item_def` stores semantic item state such as:
  - `base_type`
  - `sub_type`
  - `plus`
  - `brand`
  - `unrand_idx`
  - extra props in `props`

So Crawl's internal model is much closer to:

- slot -> item object

than:

- slot -> rendered item name string

That is why this parser now keeps:

- raw equipped name at the slot summary level
- semantic decomposition in `...Details`

The raw summary is useful because it preserves exactly what the morgue exposed.
The detailed object is useful because it gets us closer to Crawl's semantic item
model.

## Base Stats

Base stats are intentionally simple:

- `version`
- `playerName`
- `species`
- `ac`
- `ev`
- `sh`
- `strength`
- `intelligence`
- `dexterity`

Notes:

- `version` stores the raw morgue version token, for example
  `0.35-a0-257-gf9e06672e4`, not a normalized bucket label like `trunk`
- `species` is normalized to canonical species names, for example colored
  draconians normalize to `Draconian`

Code:

- `packages/morgue-parser/src/extractBaseStats.ts`

## Skills

Skills live under two parallel objects:

- `skills`: the base trained skill values
- `effectiveSkills`: the current displayed values after temporary or passive
  modifiers are applied

Examples:

- `skills.fighting`
- `skills.axes`
- `skills.staves`
- `skills.armour`
- `skills.dodging`
- `skills.shields`
- `skills.spellcasting`
- `skills.conjurations`
- `skills.fireMagic`
- `skills.iceMagic`
- `skills.earthMagic`
- `skills.invocations`
- `skills.evocations`
- `effectiveSkills.fighting`
- `effectiveSkills.spellcasting`

Why this is nested:

- it groups skill state cleanly as one subsystem
- downstream consumers still get direct key access like `skills.armour`
- it avoids mixing dozens of skill keys with unrelated top-level record fields
- it preserves both the stable underlying value and the currently effective
  value without forcing consumers to reverse-engineer parenthesized morgue text

The parser accepts both older and newer morgue skill line formats, including
modern lines such as:

- `O Level 27 Fighting`
- `- Level 20.0(23.5) Short Blades`
- `+ Level 7.5 Armour`

When a skill line includes a parenthesized value, the parser stores:

- the first value in `skills`
- the parenthesized value in `effectiveSkills`

When no parenthesized value is present, `effectiveSkills` falls back to the
same value as `skills`.

Unknown future skills are ignored rather than causing a parse failure.

The keys inside `skills` are ordered to stay close to Crawl's skill screen:

- Fighting
- melee/weapon skills
- Armour, Dodging, Shields, Stealth
- Spellcasting
- spell schools
- Invocations, Evocations, Shapeshifting

Code:

- `packages/morgue-parser/src/extractSkills.ts`

## Mutations and Innate Traits

`mutations` is extracted from the `A:` line in the morgue header.

Important detail:

- this is not limited to "mutation-causing effects"
- it is the active trait list shown by Crawl in that morgue

So `mutations` may include:

- species innate traits
- god- or form-derived traits that appear on the `A:` line
- actual mutations such as `devolution 1`

This is intentional. The morgue's `A:` line is the most compact and stable
source of "active special character traits at game end".

Each entry is stored as:

```ts
type MutationEntrySnapshot = {
  name: string
  level: number | null
}
```

Examples:

- `horns 3` -> `{ name: "horns", level: 3 }`
- `devolution 1` -> `{ name: "devolution", level: 1 }`
- `big wings` -> `{ name: "big wings", level: null }`
- `+LOS` -> `{ name: "+LOS", level: null }`

The parser stops at section boundaries such as:

- ability prompt lines like `}:`
- action labels like `a:`
- orb lines like `0: Orb of Zot`
- prose lines beginning with `You`

Code:

- `packages/morgue-parser/src/extractMutations.ts`

## Spells

Each spell entry stores:

- `name`
- `failurePercent`
- `memorized`

The parser restores many truncated spell table names using a built-in canonical
spell vocabulary and optionally accepts caller-provided extra canonical names.

Examples of restored names:

- `Lehudib's Crystal Sp` -> `Lehudib's Crystal Spear`
- `Lee's Rapid Deconstr` -> `Lee's Rapid Deconstruction`
- `Iskenderun's Mystic Bla` -> `Iskenderun's Mystic Blast`

Code:

- `packages/morgue-parser/src/extractSpells.ts`
- `packages/morgue-parser/src/canonicalSpellNames.ts`

## Equipment Overview

Equipment is stored in two layers.

### 1. Slot summary fields

These fields now preserve the raw equipped item names from the morgue after
light cleanup such as removing:

- the inventory letter
- leading article
- leading enchant prefix
- trailing `(worn)`

Singular slot summaries:

- `bodyArmour`
- `shield`
- `orb`
- `amulet`

List-valued slot summaries:

- `helmets`
- `gloves`
- `footwear`
- `cloaks`
- `rings`

Other equipment flags:

- `bootsOrBarding`

Examples:

- `bodyArmour: "fire dragon scales of Undesirable Species"`
- `shield: "buckler of cold resistance"`
- `helmets: ["hat of intelligence"]`
- `footwear: ["pair of boots of flying"]`
- `cloaks: ["cloak of willpower"]`
- `amulet: "amulet of magic regeneration"`
- `rings: ["ring of wizardry", "ring of the Byakko"]`
- `gloves: ["Mad Mage's Maulers"]`

These are meant to preserve the exact morgue-facing identity of the equipped
item. They are intentionally not the main semantic layer anymore.

The list-valued aux slots are deliberate. Crawl can support more than one
compatible aux item in edge cases such as poltergeists, whose haunted auxiliary
equipment is modeled through `SLOT_HAUNTED_AUX`. Morgues for those characters
can show multiple haunted hats, boots, cloaks, or gloves at once, so the parser
keeps them all instead of collapsing to a single slot string.

### 2. Detailed slot objects

Each equipped slot may also carry a detailed object or list of objects:

- `bodyArmourDetails`
- `shieldDetails`
- `footwearDetails`
- `orbDetails`
- `amuletDetails`
- `ringDetails`
- `helmetDetails`
- `glovesDetails`
- `cloakDetails`

The aux detail fields are arrays:

- `helmetDetails: EquipmentItemSnapshot[]`
- `glovesDetails: EquipmentItemSnapshot[]`
- `footwearDetails: EquipmentItemSnapshot[]`
- `cloakDetails: EquipmentItemSnapshot[]`

The detailed object shape is `EquipmentItemSnapshot`.

## EquipmentItemSnapshot

```ts
type EquipmentItemSnapshot = {
  rawName: string
  displayName: string
  objectClass: 'armour' | 'jewellery'
  equipState: 'worn' | 'haunted'
  isCursed: boolean
  baseType: string | null
  enchant: number | null
  artifactKind: 'normal' | 'randart' | 'unrand'
  ego: string | null
  subtypeEffect: string | null
  propertiesText: string | null
  properties: string[]
  intrinsicProperties: string[]
  egoProperties: string[]
  artifactProperties: string[]
}
```

### Field meanings

#### `rawName`

The original resolved item name from the inventory/equipment lines.

Examples:

- `fire dragon scales of Undesirable Species`
- `ring of the Byakko`
- `Mad Mage's Maulers`

#### `displayName`

The normalized semantic display name that callers can use when they want a more
interpreted label than the raw morgue name.

Examples:

- normal armour ego: `buckler of cold resistance`
- normal jewellery: `ring of wizardry`
- randart ring: `randart ring`
- unrand glove: `Mad Mage's Maulers`

#### `objectClass`

A coarse Crawl-style category:

- `armour`
- `jewellery`

This intentionally mirrors Crawl's large item categories more than our UI slot
names do.

#### `equipState`

The wearing state preserved from the morgue line:

- `worn`
- `haunted`

This exists because poltergeist morgues explicitly distinguish normal equipped
items from haunted auxiliary items.

#### `isCursed`

Whether the morgue line marked the item as cursed.

This is stored as state instead of being left embedded in the item name because
cursedness is not part of Crawl's item identity.

#### `baseType`

The item subtype or base item identity, when we can infer it.

Examples:

- `buckler`
- `hat`
- `boots`
- `fire dragon scales`
- `amulet`
- `ring`

This comes from Crawl's subtype concept. In Crawl terms, this is the part that
distinguishes things like `ARM_HELMET` vs `ARM_HAT` or one jewellery subtype
family vs another.

#### `enchant`

The parsed `+N` enchantment, if present.

Examples:

- `+3 buckler`
- `+2 hat`
- `+8 fire dragon scales`

#### `artifactKind`

One of:

- `normal`
- `randart`
- `unrand`

Why this matters:

- normal armour can have egos
- randarts and unrands carry artefact properties
- downstream tools often need to distinguish those cases

#### `ego`

Used for normal armour egos only.

Examples:

- `cold resistance`
- `intelligence`
- `flying`
- `willpower`

This follows Crawl's armour ego concept from `item-name.cc` and
`item-prop.cc`.

We do not overload this for randarts or jewellery.

#### `subtypeEffect`

Used for normal jewellery effects.

Examples:

- `wizardry`
- `magic regeneration`
- `reflection`
- `willpower`

This is separate from `ego` because Crawl jewellery names like
`ring of wizardry` or `amulet of magic regeneration` behave more like subtype
families than armour egos.

#### `propertiesText`

The raw brace-text property payload when present.

Example:

- `rF++ rC- rN+ Will+ Int+6 Slay-5`

This is kept for debugging, audit, and future re-interpretation.

#### `properties`

The final normalized property list for the item.

This is the primary downstream field to query when you need to answer things
like:

- does the item give `rF`?
- does it boost `Int`?
- does it have `Will+`?

Examples:

- `["rC+"]`
- `["Int+3"]`
- `["Fly"]`
- `["rF++", "rC-", "rN+", "Will+", "Int+6", "Slay-5"]`

#### `intrinsicProperties`

Properties that come from the base item itself, independent of randart or ego.

Example:

```json
{
  "baseType": "fire dragon scales",
  "intrinsicProperties": ["rF++", "rC-"]
}
```

This is based on Crawl's base armour flags in `item-prop.cc`.

#### `egoProperties`

Properties introduced by a normal armour ego.

Examples:

- `buckler of cold resistance` -> `["rC+"]`
- `hat of intelligence` -> `["Int+3"]`
- `pair of boots of flying` -> `["Fly"]`

#### `artifactProperties`

Properties attributed to a randart or unrand artefact layer.

Example:

```json
{
  "baseType": "fire dragon scales",
  "artifactKind": "randart",
  "artifactProperties": ["rN+", "Will+", "Int+6", "Slay-5"]
}
```

This follows Crawl's artefact property system in `artefact.cc` and
`artefact.h`.

## Why We Split Properties This Way

The parser keeps all three property buckets because downstream use cases often
care about source, not just the combined effect.

Examples:

- "did the item roll extra Willpower, or is that just the base item?"
- "is this an ego hat or a randart hat?"
- "should a tool treat this as a generic base item with an ego, or as a unique
  artefact?"

At the same time, consumers often want the final answer immediately, so the
model also exposes combined `properties`.

In other words:

- `properties` is the convenient answer
- `intrinsicProperties`, `egoProperties`, and `artifactProperties` are the
  explanatory answer

## Equipment Examples

### Normal armour ego

Morgue:

```text
+3 buckler {rC+}
```

Parsed model:

```json
{
  "objectClass": "armour",
  "baseType": "buckler",
  "enchant": 3,
  "artifactKind": "normal",
  "ego": "cold resistance",
  "displayName": "buckler of cold resistance",
  "properties": ["rC+"],
  "intrinsicProperties": [],
  "egoProperties": ["rC+"],
  "artifactProperties": []
}
```

### Normal armour ego with stat bonus

Morgue:

```text
+2 hat {Int+3}
```

Parsed model:

```json
{
  "objectClass": "armour",
  "baseType": "hat",
  "enchant": 2,
  "artifactKind": "normal",
  "ego": "intelligence",
  "displayName": "hat of intelligence",
  "properties": ["Int+3"],
  "intrinsicProperties": [],
  "egoProperties": ["Int+3"],
  "artifactProperties": []
}
```

### Normal armour ego with utility effect

Morgue:

```text
+2 pair of boots {Fly}
```

Parsed model:

```json
{
  "objectClass": "armour",
  "baseType": "boots",
  "enchant": 2,
  "artifactKind": "normal",
  "ego": "flying",
  "displayName": "pair of boots of flying",
  "properties": ["Fly"],
  "intrinsicProperties": [],
  "egoProperties": ["Fly"],
  "artifactProperties": []
}
```

### Randart armour on an intrinsic base

Morgue:

```text
+8 fire dragon scales of Undesirable Species {rF++ rC- rN+ Will+ Int+6 Slay-5}
```

Parsed model:

```json
{
  "objectClass": "armour",
  "baseType": "fire dragon scales",
  "enchant": 8,
  "artifactKind": "randart",
  "ego": null,
  "displayName": "fire dragon scales",
  "properties": ["rF++", "rC-", "rN+", "Will+", "Int+6", "Slay-5"],
  "intrinsicProperties": ["rF++", "rC-"],
  "egoProperties": [],
  "artifactProperties": ["rN+", "Will+", "Int+6", "Slay-5"]
}
```

### Normal jewellery

Morgue:

```text
ring of wizardry
amulet of magic regeneration
```

Parsed model:

```json
{
  "objectClass": "jewellery",
  "baseType": "ring",
  "artifactKind": "normal",
  "subtypeEffect": "wizardry",
  "displayName": "ring of wizardry",
  "properties": ["Wiz"]
}
```

```json
{
  "objectClass": "jewellery",
  "baseType": "amulet",
  "artifactKind": "normal",
  "subtypeEffect": "magic regeneration",
  "displayName": "amulet of magic regeneration",
  "properties": ["RegenMP+"]
}
```

### Unrand equipment

Morgue:

```text
+3 Mad Mage's Maulers {Infuse+∞ VampMP -Cast}
```

Parsed model:

```json
{
  "objectClass": "armour",
  "baseType": "gloves",
  "enchant": 3,
  "artifactKind": "unrand",
  "displayName": "Mad Mage's Maulers",
  "properties": ["Infuse+∞", "VampMP", "-Cast"],
  "artifactProperties": ["Infuse+∞", "VampMP", "-Cast"]
}
```

### Cursed haunted aux equipment

Morgue:

```text
the cursed +3 pair of gauntlets of War (haunted) {Slay+5, Self, Comp}
```

Parsed model:

```json
{
  "rawName": "pair of gauntlets of War",
  "displayName": "gauntlets of War",
  "objectClass": "armour",
  "equipState": "haunted",
  "isCursed": true,
  "baseType": "gloves",
  "enchant": 3,
  "artifactKind": "unrand",
  "properties": ["Slay+5", "Self", "Comp"],
  "artifactProperties": ["Slay+5", "Self", "Comp"]
}
```

## Summary Naming Rules

The slot summary fields keep the cleaned morgue-facing item names.

Examples:

- `bodyArmour: "fire dragon scales of Undesirable Species"`
- `helmets: ["hat of intelligence"]`
- `gloves: ["Mad Mage's Maulers"]`
- `rings: ["ring of wizardry", "ring of the Byakko"]`

Why:

- summary fields should match what the morgue visibly showed
- downstream tools often want a quick readable label without opening detail
- details still retain the semantic `displayName` and all structural fields

## Tests and Golden Fixtures

This model is validated with both focused parser tests and full morgue golden
fixtures.

Important test files:

- `dcss-morgue-pipeline/test/parser/extractEquipment.test.ts`
- `dcss-morgue-pipeline/test/parser/parseMorgue.test.ts`
- `dcss-morgue-pipeline/test/parser/parseMorgueTextGolden.test.ts`

The `full/` fixture directory is especially important because it locks the
entire parser output against real morgues rather than only tiny synthetic
snippets.

## Current Limits

The current parser is intentionally structured, but it is still a morgue parser,
not a full item database.

Important limits:

- only the property families we can identify confidently are split into
  `intrinsicProperties`, `egoProperties`, and `artifactProperties`
- some items may still rely on `propertiesText` plus the combined `properties`
  if Crawl's full internal decomposition is not inferable from the morgue text
  alone
- `objectClass` is currently coarse and uses only `armour` and `jewellery`
  because that is enough for the currently modeled equipped slots

When in doubt:

- `propertiesText` is the closest preserved raw source
- `properties` is the best normalized final answer
