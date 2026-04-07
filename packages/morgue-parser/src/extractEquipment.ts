import type {
  ArtifactKind,
  EquipmentItemSnapshot,
  EquipmentObjectClass,
  EquipmentSnapshot,
} from './types'
import { splitSections } from './splitSections'

const BODY_ARMOUR_LABELS = [
  'quicksilver dragon scales',
  'golden dragon scales',
  'shadow dragon scales',
  'storm dragon scales',
  'pearl dragon scales',
  'ice dragon scales',
  'fire dragon scales',
  'acid dragon scales',
  'swamp dragon scales',
  'steam dragon scales',
  'crystal plate armour',
  'troll leather armour',
  'animal skin',
  'plate armour',
  'chain mail',
  'scale mail',
  'ring mail',
  'leather armour',
  'robe',
] as const

const SHIELD_LABELS = ['tower shield', 'kite shield', 'buckler'] as const
const HELMET_LABELS = ['helmet', 'hat', 'hood', 'crown', 'mask', 'cap'] as const
const CLOAK_LABELS = ['cloak', 'scarf'] as const

type EquipmentLine = {
  category: string | null
  text: string
}

type EquipmentSlot =
  | 'bodyArmour'
  | 'shield'
  | 'footwear'
  | 'helmet'
  | 'gloves'
  | 'cloak'
  | 'orb'
  | 'amulet'
  | 'ring'

type KnownUnrand = {
  name: string
  baseType?: string
}

const UNRAND_BODY_ARMOUR_ITEMS = [
  { name: 'faerie dragon scales', baseType: 'faerie dragon scales' },
  { name: 'robe of Augmentation', baseType: 'robe' },
  { name: "Lear's hauberk" },
  { name: 'skin of Zhor', baseType: 'animal skin' },
  { name: 'salamander hide armour', baseType: 'salamander hide armour' },
  { name: 'robe of Folly', baseType: 'robe' },
  { name: "Maxwell's patent armour" },
  { name: 'robe of Night', baseType: 'robe' },
  { name: 'scales of the Dragon King' },
  { name: 'robe of Clouds', baseType: 'robe' },
  { name: 'moon troll leather armour', baseType: 'troll leather armour' },
  { name: 'orange crystal plate armour', baseType: 'crystal plate armour' },
  { name: 'robe of Vines', baseType: 'robe' },
  { name: "Kryia's mail coat" },
  { name: 'armour of Talos' },
  { name: "Cigotuvi's embrace" },
  { name: 'toga "Victory"', baseType: 'robe' },
  { name: "swamp witch's dragon scales", baseType: 'swamp dragon scales' },
  { name: "justicar's regalia" },
] as const satisfies readonly KnownUnrand[]

const UNRAND_SHIELD_ITEMS = [
  { name: 'tower shield of Ignorance', baseType: 'tower shield' },
  { name: 'shield "Bullseye"' },
  { name: 'shield of Resistance' },
  { name: 'shield of the Gong' },
  { name: "Storm Queen's Shield" },
  { name: "warlock's mirror" },
] as const satisfies readonly KnownUnrand[]

const UNRAND_FOOTWEAR_ITEMS = [
  { name: "Black Knight's barding", baseType: 'barding' },
  { name: 'lightning scales' },
  { name: 'boots of the spider', baseType: 'boots' },
  { name: 'seven-league boots', baseType: 'boots' },
  { name: 'mountain boots', baseType: 'boots' },
  { name: 'slick slippers', baseType: 'boots' },
] as const satisfies readonly KnownUnrand[]

const UNRAND_HEAD_ITEMS = [
  { name: 'hat of the Bear Spirit', baseType: 'hat' },
  { name: 'hat of the Alchemist', baseType: 'hat' },
  { name: 'hat of Pondering', baseType: 'hat' },
  { name: 'hat of the High Council', baseType: 'hat' },
  { name: 'crown of Dyrovepreva', baseType: 'crown' },
  { name: 'hood of the Assassin', baseType: 'hood' },
  { name: 'helm of the ram' },
  { name: 'Mask of the Dragon', baseType: 'mask' },
  { name: 'Mask of the Thief', baseType: 'mask' },
  { name: 'shining eye crown', baseType: 'crown' },
] as const satisfies readonly KnownUnrand[]

const UNRAND_GLOVE_ITEMS = [
  { name: "Delatra's gloves", baseType: 'gloves' },
  { name: "fencer's gloves", baseType: 'gloves' },
  { name: 'gloves of the gadgeteer', baseType: 'gloves' },
  { name: "Mad Mage's Maulers", baseType: 'gloves' },
] as const satisfies readonly KnownUnrand[]

const UNRAND_CLOAK_ITEMS = [
  { name: 'cloak of Starlight', baseType: 'cloak' },
  { name: 'cloak of Flash', baseType: 'cloak' },
  { name: 'cloak of the Thief', baseType: 'cloak' },
  { name: 'dragonskin cloak', baseType: 'cloak' },
  { name: 'ratskin cloak', baseType: 'cloak' },
  { name: 'scarf of invisibility', baseType: 'scarf' },
] as const satisfies readonly KnownUnrand[]

const UNRAND_ORB_ITEMS = [
  { name: 'crystal ball of Wucad Mu', baseType: 'orb' },
  { name: 'orb of Dispater', baseType: 'orb' },
  { name: 'sphere of Battle', baseType: 'orb' },
  { name: "Charlatan's Orb", baseType: 'orb' },
  { name: 'skull of Zonguldrok', baseType: 'orb' },
] as const satisfies readonly KnownUnrand[]

const UNRAND_AMULET_ITEMS = [
  { name: 'amulet of the Air', baseType: 'amulet' },
  { name: 'amulet of Cekugob', baseType: 'amulet' },
  { name: 'amulet of Tranquility', baseType: 'amulet' },
  { name: 'necklace of Bloodlust', baseType: 'amulet' },
  { name: 'brooch of Shielding', baseType: 'amulet' },
  { name: 'amulet of Vitality', baseType: 'amulet' },
  { name: 'macabre finger necklace', baseType: 'amulet' },
  { name: 'amulet of invisibility', baseType: 'amulet' },
  { name: 'dreamshard necklace', baseType: 'amulet' },
  { name: 'amulet of Elemental Vulnerability', baseType: 'amulet' },
  { name: "Hermit's Pendant", baseType: 'amulet' },
  { name: 'dreamdust necklace', baseType: 'amulet' },
] as const satisfies readonly KnownUnrand[]

const UNRAND_RING_ITEMS = [
  { name: 'ring of Shadows', baseType: 'ring' },
  { name: 'ring of the Hare', baseType: 'ring' },
  { name: 'ring of the Tortoise', baseType: 'ring' },
  { name: 'ring of the Mage', baseType: 'ring' },
  { name: 'ring of the Octopus King', baseType: 'ring' },
] as const satisfies readonly KnownUnrand[]

const KNOWN_UNRAND_BY_SLOT: Record<EquipmentSlot, readonly KnownUnrand[]> = {
  bodyArmour: UNRAND_BODY_ARMOUR_ITEMS,
  shield: UNRAND_SHIELD_ITEMS,
  footwear: UNRAND_FOOTWEAR_ITEMS,
  helmet: UNRAND_HEAD_ITEMS,
  gloves: UNRAND_GLOVE_ITEMS,
  cloak: UNRAND_CLOAK_ITEMS,
  orb: UNRAND_ORB_ITEMS,
  amulet: UNRAND_AMULET_ITEMS,
  ring: UNRAND_RING_ITEMS,
}

const ARMOUR_EGO_PROPERTIES_BY_NAME: Record<string, string[]> = {
  'fire resistance': ['rF+'],
  'cold resistance': ['rC+'],
  'poison resistance': ['rPois'],
  'see invisible': ['SInv'],
  invisibility: ['+Inv'],
  strength: ['Str+3'],
  dexterity: ['Dex+3'],
  intelligence: ['Int+3'],
  ponderousness: ['Ponderous'],
  flying: ['Fly'],
  willpower: ['Will+'],
  protection: ['AC+3'],
  stealth: ['Stlth+'],
  resistance: ['rC+', 'rF+'],
  'positive energy': ['rN+'],
  'the Archmagi': ['Archmagi'],
  'corrosion resistance': ['rCorr'],
  reflection: ['Reflect'],
  'spirit shield': ['Spirit'],
  hurling: ['Hurl'],
  repulsion: ['Repulsion'],
  harm: ['Harm'],
  shadows: ['Shadows'],
  rampaging: ['Rampage'],
  infusion: ['Infuse'],
  light: ['Light'],
  wrath: ['*Rage'],
  mayhem: ['Mayhem'],
  guile: ['Guile'],
  energy: ['Energy'],
  sniping: ['Snipe'],
  ice: ['Ice'],
  fire: ['Fire'],
  air: ['Air'],
  earth: ['Earth'],
  archery: ['Archery'],
  command: ['Command'],
  death: ['Death'],
  resonance: ['Resonance'],
  parrying: ['Parrying'],
  glass: ['Glass'],
  pyromania: ['Pyromania'],
  stardust: ['Stardust'],
  mesmerism: ['Mesmerism'],
  attunement: ['Attunement'],
}

const ARMOUR_EGO_NAME_BY_NORMALIZED = new Map(
  Object.keys(ARMOUR_EGO_PROPERTIES_BY_NAME).map((ego) => [ego.toLowerCase(), ego]),
)

const ARMOUR_EGO_BY_PROPERTY_SIGNATURE = new Map(
  Object.entries(ARMOUR_EGO_PROPERTIES_BY_NAME).map(([ego, properties]) => [
    properties.join(' '),
    ego,
  ]),
)

const INTRINSIC_PROPERTIES_BY_ARMOUR_BASE_TYPE: Record<string, string[]> = {
  'troll leather armour': ['Regen+'],
  'acid dragon scales': ['rCorr'],
  'quicksilver dragon scales': ['Will+'],
  'swamp dragon scales': ['rPois'],
  'fire dragon scales': ['rF++', 'rC-'],
  'ice dragon scales': ['rC++', 'rF-'],
  'pearl dragon scales': ['rN+'],
  'storm dragon scales': ['rElec'],
  'shadow dragon scales': ['Stlth+'],
  'golden dragon scales': ['rF+', 'rC+', 'rPois'],
}

const FIXED_JEWELLERY_PROPERTIES_BY_EFFECT: Record<string, string[]> = {
  'protection from fire': ['rF+'],
  'poison resistance': ['rPois'],
  'protection from cold': ['rC+'],
  'see invisible': ['SInv'],
  'resist corrosion': ['rCorr'],
  wizardry: ['Wiz'],
  'magical power': ['MP+9'],
  flight: ['Fly'],
  'positive energy': ['rN+'],
  willpower: ['Will+'],
  'magic regeneration': ['RegenMP+'],
  'the acrobat': ['Acrobat'],
  'guardian spirit': ['Spirit'],
  faith: ['Faith'],
  reflection: ['Reflect'],
  regeneration: ['Regen+'],
  wildshape: ['Wildshape'],
  chemistry: ['Chemistry'],
  dissipation: ['Dissipate'],
}

const SCALAR_JEWELLERY_PROPERTY_PREFIX_BY_EFFECT: Record<string, string> = {
  protection: 'AC',
  slaying: 'Slay',
  evasion: 'EV',
  stealth: 'Stlth',
  strength: 'Str',
  dexterity: 'Dex',
  intelligence: 'Int',
}

const RECOGNIZED_PROPERTY_WORDS = new Set([
  'SInv',
  'Fly',
  'Reflect',
  'Faith',
  'Acrobat',
  'Spirit',
  'Chemistry',
  'Dissipate',
  'Wildshape',
  'Shadows',
  'Harm',
  'Rampage',
  'Repulsion',
  'Archmagi',
  'Light',
  'Mayhem',
  'Guile',
  'Energy',
  'Stardust',
  'Mesmerism',
  'Attunement',
  'Ice',
  'Fire',
  'Air',
  'Earth',
  'Archery',
  'Command',
  'Death',
  'Resonance',
  'Parrying',
  'Glass',
  'Pyromania',
  'Hurl',
  'Snipe',
  'Bear',
  'VampMP',
  'Ponderous',
])

const BODY_ARMOUR_PATTERNS = BODY_ARMOUR_LABELS.map((label) => ({
  label,
  baseType: label,
}))

const SHIELD_PATTERNS = SHIELD_LABELS.map((label) => ({
  label,
  baseType: label,
}))

const HELMET_PATTERNS = HELMET_LABELS.map((label) => ({
  label,
  baseType: label,
}))

const CLOAK_PATTERNS = CLOAK_LABELS.map((label) => ({
  label,
  baseType: label,
}))

const FOOTWEAR_PATTERNS = [
  { label: 'pair of boots', baseType: 'boots' },
  { label: 'boots', baseType: 'boots' },
  { label: 'barding', baseType: 'barding' },
] as const

const GLOVE_PATTERNS = [
  { label: 'pair of gloves', baseType: 'gloves' },
  { label: 'gloves', baseType: 'gloves' },
] as const

const BASE_PATTERNS_BY_SLOT = {
  bodyArmour: BODY_ARMOUR_PATTERNS,
  shield: SHIELD_PATTERNS,
  footwear: FOOTWEAR_PATTERNS,
  helmet: HELMET_PATTERNS,
  gloves: GLOVE_PATTERNS,
  cloak: CLOAK_PATTERNS,
  orb: [{ label: 'orb', baseType: 'orb' }],
  amulet: [{ label: 'amulet', baseType: 'amulet' }],
  ring: [{ label: 'ring', baseType: 'ring' }],
} as const

function isEquipped(line: string): boolean {
  const lower = line.toLowerCase()
  return lower.includes('(worn)') || lower.includes('(haunted)')
}

function isCategoryHeading(line: string): boolean {
  return /^[A-Z][A-Za-z &'-]+$/.test(line)
}

function isItemLine(line: string): boolean {
  return /^[a-zA-Z0-9] - /.test(line)
}

function parseEquipmentLines(section: string): EquipmentLine[] {
  const lines: EquipmentLine[] = []
  let currentCategory: string | null = null

  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim()

    if (!line) {
      continue
    }

    if (isCategoryHeading(line) && !isItemLine(line)) {
      currentCategory = line
      continue
    }

    if (isItemLine(line)) {
      lines.push({
        category: currentCategory,
        text: line,
      })
    }
  }

  return lines
}

function hasAny(line: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(line))
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function exactNamePatterns(items: readonly KnownUnrand[]): RegExp[] {
  return items.map((item) => new RegExp(`\\b${escapeRegex(item.name)}\\b`, 'i'))
}

function normalizeSpacing(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function cleanItemName(line: string): string {
  return normalizeSpacing(
    line
      .replace(/^[a-z0-9] - /i, '')
      .replace(/\s+\((?:worn|haunted)\).*$/i, '')
      .replace(/\s+\{.*$/, '')
      .replace(/^\s*the\s+/i, '')
      .replace(/^\s*an?\s+/i, '')
      .replace(/^[+-]\d+\s+/, ''),
  )
}

function extractEnchantment(line: string): number | null {
  const match = line.match(/^[a-z0-9] - (?:the |an? )?([+-]\d+)/i)
  return match ? Number.parseInt(match[1], 10) : null
}

function extractPropertiesText(line: string): string | null {
  return line.match(/\{([^}]*)\}/)?.[1]?.trim() ?? null
}

function extractProperties(propertiesText: string | null): string[] {
  if (!propertiesText) {
    return []
  }

  return propertiesText
    .split(/\s*,\s*/)
    .flatMap((segment) => normalizeSpacing(segment).split(/\s+/))
    .filter(Boolean)
}

function looksLikePropertyToken(token: string): boolean {
  return (
    /^[*^+-]/.test(token)
    || /^(?:r[A-Z][A-Za-z]*[+-]*|Will[+-]*|Str[+-]?\d+|Dex[+-]?\d+|Int[+-]?\d+|MP[+-]?\d+|HP[+-]?\d+|AC[+-]?\d+|EV[+-]?\d+|SH[+-]?\d+|Slay[+-]?\d+|RegenMP[+-]*|Regen[+-]*|Stlth[+-]*)$/i.test(
      token,
    )
    || RECOGNIZED_PROPERTY_WORDS.has(token)
  )
}

function uniqueProperties(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    if (seen.has(value)) {
      continue
    }

    seen.add(value)
    result.push(value)
  }

  return result
}

function subtractProperties(values: readonly string[], toRemove: readonly string[]): string[] {
  const remaining = [...values]

  for (const value of toRemove) {
    const index = remaining.indexOf(value)
    if (index >= 0) {
      remaining.splice(index, 1)
    }
  }

  return remaining
}

function getObjectClass(slot: EquipmentSlot): EquipmentObjectClass {
  return slot === 'amulet' || slot === 'ring' ? 'jewellery' : 'armour'
}

function findKnownUnrand(slot: EquipmentSlot, rawName: string): KnownUnrand | undefined {
  return KNOWN_UNRAND_BY_SLOT[slot].find((item) => item.name.toLowerCase() === rawName.toLowerCase())
}

function detectBaseType(slot: EquipmentSlot, rawName: string, knownUnrand?: KnownUnrand): string | null {
  if (knownUnrand?.baseType) {
    return knownUnrand.baseType
  }

  const normalized = normalizeSpacing(rawName.toLowerCase().replace(/"[^"]*"/g, ''))

  for (const candidate of BASE_PATTERNS_BY_SLOT[slot]) {
    if (
      normalized === candidate.label
      || normalized.startsWith(`${candidate.label} `)
      || normalized.startsWith(`${candidate.label} of `)
    ) {
      return candidate.baseType
    }
  }

  return null
}

function getDisplayBaseName(slot: EquipmentSlot, baseType: string | null): string | null {
  if (!baseType) {
    return null
  }

  switch (slot) {
    case 'footwear':
      return baseType === 'barding' ? 'barding' : 'pair of boots'
    case 'gloves':
      return 'pair of gloves'
    case 'ring':
      return 'ring'
    case 'amulet':
      return 'amulet'
    default:
      return baseType
  }
}

function extractSuffixAfterBase(rawName: string, slot: EquipmentSlot, baseType: string | null): string | null {
  if (!baseType) {
    return null
  }

  const normalized = normalizeSpacing(rawName.replace(/"[^"]*"/g, ''))
  const candidateLabels =
    slot === 'footwear' && baseType === 'boots'
      ? ['pair of boots', 'boots']
      : slot === 'gloves' && baseType === 'gloves'
        ? ['pair of gloves', 'gloves']
        : [getDisplayBaseName(slot, baseType) ?? baseType]

  for (const label of candidateLabels) {
    const match = normalized.match(new RegExp(`^${escapeRegex(label)} of (.+)$`, 'i'))
    if (match) {
      return normalizeSpacing(match[1])
    }
  }

  return null
}

function canonicalArmourEgo(name: string | null): string | null {
  if (!name) {
    return null
  }

  return ARMOUR_EGO_NAME_BY_NORMALIZED.get(name.toLowerCase()) ?? null
}

function inferArmourEgo(rawName: string, slot: EquipmentSlot, baseType: string | null, properties: string[]): string | null {
  const explicit = canonicalArmourEgo(extractSuffixAfterBase(rawName, slot, baseType))
  if (explicit) {
    return explicit
  }

  return ARMOUR_EGO_BY_PROPERTY_SIGNATURE.get(properties.join(' ')) ?? null
}

function isRandartJewellery(slot: EquipmentSlot, rawName: string, line: string): boolean {
  if (/^[a-z0-9] - the /i.test(line)) {
    return true
  }

  if (/".+?"/.test(rawName)) {
    return true
  }

  switch (slot) {
    case 'amulet':
      return /^amulet of (?:the )?[A-Z]/.test(rawName) || /necklace/i.test(rawName)
    case 'ring':
      return /^ring of (?:the )?[A-Z]/.test(rawName)
    default:
      return false
  }
}

function isRandartArmour(rawName: string, line: string, slot: EquipmentSlot, baseType: string | null): boolean {
  if (/^[a-z0-9] - the /i.test(line)) {
    return true
  }

  if (/".+?"/.test(rawName)) {
    return true
  }

  const suffix = extractSuffixAfterBase(rawName, slot, baseType)
  return Boolean(suffix && !canonicalArmourEgo(suffix))
}

function getArtifactKind(
  slot: EquipmentSlot,
  rawName: string,
  line: string,
  objectClass: EquipmentObjectClass,
  baseType: string | null,
): ArtifactKind {
  if (findKnownUnrand(slot, rawName)) {
    return 'unrand'
  }

  if (objectClass === 'jewellery') {
    return isRandartJewellery(slot, rawName, line) ? 'randart' : 'normal'
  }

  return isRandartArmour(rawName, line, slot, baseType) ? 'randart' : 'normal'
}

function inferSubtypeEffect(slot: EquipmentSlot, rawName: string, artifactKind: ArtifactKind): string | null {
  if (artifactKind !== 'normal') {
    return null
  }

  if (slot === 'ring') {
    return rawName.match(/^ring of (.+)$/i)?.[1]?.toLowerCase() ?? null
  }

  if (slot === 'amulet') {
    return rawName.match(/^amulet of (.+)$/i)?.[1]?.toLowerCase() ?? null
  }

  return null
}

function formatScalarProperty(prefix: string, value: number | null): string[] {
  if (value === null || value === 0) {
    return []
  }

  const sign = value > 0 ? `+${value}` : `${value}`
  return [`${prefix}${sign}`]
}

function inferJewelleryIntrinsicProperties(subtypeEffect: string | null, enchant: number | null): string[] {
  if (!subtypeEffect) {
    return []
  }

  if (subtypeEffect in SCALAR_JEWELLERY_PROPERTY_PREFIX_BY_EFFECT) {
    return formatScalarProperty(SCALAR_JEWELLERY_PROPERTY_PREFIX_BY_EFFECT[subtypeEffect], enchant)
  }

  return FIXED_JEWELLERY_PROPERTIES_BY_EFFECT[subtypeEffect] ?? []
}

function inferIntrinsicProperties(
  objectClass: EquipmentObjectClass,
  baseType: string | null,
  subtypeEffect: string | null,
  enchant: number | null,
): string[] {
  if (objectClass === 'jewellery') {
    return inferJewelleryIntrinsicProperties(subtypeEffect, enchant)
  }

  if (!baseType) {
    return []
  }

  return INTRINSIC_PROPERTIES_BY_ARMOUR_BASE_TYPE[baseType] ?? []
}

function inferDisplayProperties(
  extractedProperties: string[],
  intrinsicProperties: string[],
  egoProperties: string[],
  artifactKind: ArtifactKind,
): string[] {
  if (extractedProperties.length === 0) {
    return uniqueProperties([...intrinsicProperties, ...egoProperties])
  }

  const recognizedProperties = extractedProperties.filter((property) => looksLikePropertyToken(property))
  if (
    artifactKind === 'normal'
    && recognizedProperties.length === 0
    && (intrinsicProperties.length > 0 || egoProperties.length > 0)
  ) {
    return uniqueProperties([...intrinsicProperties, ...egoProperties])
  }

  return extractedProperties
}

function getDisplayName(
  slot: EquipmentSlot,
  rawName: string,
  artifactKind: ArtifactKind,
  baseType: string | null,
  ego: string | null,
  subtypeEffect: string | null,
): string {
  const knownUnrand = findKnownUnrand(slot, rawName)
  if (knownUnrand) {
    return knownUnrand.name
  }

  if (slot === 'amulet' && artifactKind === 'randart') {
    return 'randart amulet'
  }

  if (slot === 'ring' && artifactKind === 'randart') {
    return 'randart ring'
  }

  if (slot === 'orb' && artifactKind === 'randart') {
    return 'randart orb'
  }

  if (artifactKind === 'randart') {
    if (slot === 'bodyArmour' || slot === 'shield' || slot === 'orb') {
      return baseType ?? rawName
    }

    return rawName
  }

  if (artifactKind === 'normal' && ego && getObjectClass(slot) === 'armour') {
    const displayBase = getDisplayBaseName(slot, baseType)
    return displayBase ? `${displayBase} of ${ego}` : rawName
  }

  if (artifactKind === 'normal' && subtypeEffect) {
    const displayBase = getDisplayBaseName(slot, baseType)
    return displayBase ? `${displayBase} of ${subtypeEffect}` : rawName
  }

  if (slot === 'bodyArmour' || slot === 'shield') {
    return baseType ?? rawName
  }

  return rawName
}

function buildEquipmentItem(slot: EquipmentSlot, line: string | undefined): EquipmentItemSnapshot | undefined {
  if (!line) {
    return undefined
  }

  const rawName = cleanItemName(line)
  const propertiesText = extractPropertiesText(line)
  const extractedProperties = extractProperties(propertiesText)
  const objectClass = getObjectClass(slot)
  const knownUnrand = findKnownUnrand(slot, rawName)
  const baseType = detectBaseType(slot, rawName, knownUnrand)
  const enchant = extractEnchantment(line)
  const artifactKind = getArtifactKind(slot, rawName, line, objectClass, baseType)
  const subtypeEffect = inferSubtypeEffect(slot, rawName, artifactKind)
  const ego =
    objectClass === 'armour' && artifactKind === 'normal'
      ? inferArmourEgo(rawName, slot, baseType, extractedProperties)
      : null
  const intrinsicProperties = inferIntrinsicProperties(objectClass, baseType, subtypeEffect, enchant)
  const egoProperties = artifactKind === 'normal' && ego ? ARMOUR_EGO_PROPERTIES_BY_NAME[ego] ?? [] : []
  const properties = inferDisplayProperties(extractedProperties, intrinsicProperties, egoProperties, artifactKind)
  const artifactProperties =
    artifactKind === 'normal' ? [] : subtractProperties(properties, intrinsicProperties)

  return {
    rawName,
    displayName: getDisplayName(slot, rawName, artifactKind, baseType, ego, subtypeEffect),
    objectClass,
    baseType,
    enchant,
    artifactKind,
    ego,
    subtypeEffect,
    propertiesText,
    properties,
    intrinsicProperties,
    egoProperties,
    artifactProperties,
  }
}

export function extractEquipment(text: string): EquipmentSnapshot {
  const section = splitSections(text).equipment
  const lines = parseEquipmentLines(section)
  const equippedLines = lines.filter((line) => isEquipped(line.text))
  const armourLines = equippedLines
    .filter((line) => line.category === null || line.category === 'Armour')
    .map((line) => line.text)
  const jewelleryLines = equippedLines
    .filter((line) => line.category === 'Jewellery')
    .map((line) => line.text)

  const headPatterns = [
    /\bhat\b/i,
    /\bhelmet\b/i,
    /\bcap\b/i,
    /\bhood\b/i,
    ...exactNamePatterns(UNRAND_HEAD_ITEMS),
  ]
  const glovesPatterns = [/\bgloves\b/i, ...exactNamePatterns(UNRAND_GLOVE_ITEMS)]
  const bootsPatterns = [/\bboots\b/i, /\bbarding\b/i]
  const cloakPatterns = [/\bcloak\b/i, /\bscarf\b/i, ...exactNamePatterns(UNRAND_CLOAK_ITEMS)]
  const shieldPatterns = SHIELD_LABELS.map((label) => new RegExp(`\\b${label}\\b`, 'i'))
  const orbPatterns = [/\borb\b/i]
  const amuletPatterns = [/\bamulet\b/i, /\bnecklace\b/i, /\bpendant\b/i, /\bbrooch\b/i]
  const ringPatterns = [/\bring\b/i]
  const nonBodyPatterns = [
    ...headPatterns,
    ...glovesPatterns,
    ...bootsPatterns,
    ...cloakPatterns,
    ...shieldPatterns,
    ...orbPatterns,
  ]

  const shieldLine = armourLines.find((line) => hasAny(line, shieldPatterns))
  const footwearLine = armourLines.find((line) => hasAny(line, bootsPatterns))
  const helmetLine = armourLines.find((line) => hasAny(line, headPatterns))
  const glovesLine = armourLines.find((line) => hasAny(line, glovesPatterns))
  const cloakLine = armourLines.find((line) => hasAny(line, cloakPatterns))
  const orbLine = armourLines.find((line) => hasAny(line, orbPatterns))
  const bodyArmourLine = armourLines.find((line) => !hasAny(line, nonBodyPatterns))
  const amuletLine = jewelleryLines.find((line) => hasAny(line, amuletPatterns))
  const ringLines = jewelleryLines.filter((line) => hasAny(line, ringPatterns))

  const bodyArmourDetails = buildEquipmentItem('bodyArmour', bodyArmourLine)
  const shieldDetails = buildEquipmentItem('shield', shieldLine)
  const footwearDetails = buildEquipmentItem('footwear', footwearLine)
  const helmetDetails = buildEquipmentItem('helmet', helmetLine)
  const glovesDetails = buildEquipmentItem('gloves', glovesLine)
  const cloakDetails = buildEquipmentItem('cloak', cloakLine)
  const orbDetails = buildEquipmentItem('orb', orbLine)
  const amuletDetails = buildEquipmentItem('amulet', amuletLine)
  const ringDetails = ringLines
    .map((line) => buildEquipmentItem('ring', line))
    .filter((item): item is EquipmentItemSnapshot => Boolean(item))

  return {
    bodyArmour: bodyArmourDetails?.displayName ?? 'none',
    shield: shieldDetails?.displayName ?? 'none',
    footwear: footwearDetails?.displayName ?? 'none',
    orb: orbDetails?.displayName ?? 'none',
    amulet: amuletDetails?.displayName ?? 'none',
    rings: ringDetails.map((ring) => ring.displayName),
    bodyArmourDetails,
    shieldDetails,
    footwearDetails,
    helmetDetails,
    glovesDetails,
    cloakDetails,
    orbDetails,
    amuletDetails,
    ringDetails,
    helmet: helmetDetails?.displayName ?? 'none',
    gloves: glovesDetails?.displayName ?? 'none',
    bootsOrBarding: Boolean(footwearLine),
    cloak: cloakDetails?.displayName ?? 'none',
  }
}
