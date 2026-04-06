import type { ArtifactKind, EquipmentItemSnapshot, EquipmentSnapshot } from './types'
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
]

const SHIELD_LABELS = ['tower shield', 'kite shield', 'buckler'] as const

const UNRAND_BODY_ARMOUR_NAMES = [
  'faerie dragon scales',
  'robe of Augmentation',
  "Lear's hauberk",
  'skin of Zhor',
  'salamander hide armour',
  'robe of Folly',
  "Maxwell's patent armour",
  'robe of Night',
  'scales of the Dragon King',
  'robe of Clouds',
  'moon troll leather armour',
  'orange crystal plate armour',
  'robe of Vines',
  "Kryia's mail coat",
  'armour of Talos',
  "Cigotuvi's embrace",
  "toga \"Victory\"",
  "swamp witch's dragon scales",
  "justicar's regalia",
] as const

const UNRAND_SHIELD_NAMES = [
  'tower shield of Ignorance',
  'shield "Bullseye"',
  'shield of Resistance',
  'shield of the Gong',
  "Storm Queen's Shield",
  "warlock's mirror",
] as const

const UNRAND_FOOTWEAR_NAMES = [
  "Black Knight's barding",
  'lightning scales',
  'boots of the spider',
  'seven-league boots',
  'mountain boots',
  'slick slippers',
] as const

const UNRAND_ORB_NAMES = [
  'crystal ball of Wucad Mu',
  'orb of Dispater',
  'sphere of Battle',
  "Charlatan's Orb",
  'skull of Zonguldrok',
] as const

const UNRAND_AMULET_NAMES = [
  'amulet of the Air',
  'amulet of Cekugob',
  'amulet of Tranquility',
  'necklace of Bloodlust',
  'brooch of Shielding',
  'amulet of Vitality',
  'macabre finger necklace',
  'amulet of invisibility',
  'dreamshard necklace',
  'amulet of Elemental Vulnerability',
  "Hermit's Pendant",
  'dreamdust necklace',
] as const

const UNRAND_RING_NAMES = [
  'ring of Shadows',
  'ring of the Hare',
  'ring of the Tortoise',
  'ring of the Mage',
  'ring of the Octopus King',
] as const

type EquipmentLine = {
  category: string | null
  text: string
}

type EquipmentSlot = 'bodyArmour' | 'shield' | 'footwear' | 'orb' | 'amulet' | 'ring'

const KNOWN_UNRAND_BY_SLOT: Record<EquipmentSlot, readonly string[]> = {
  bodyArmour: UNRAND_BODY_ARMOUR_NAMES,
  shield: UNRAND_SHIELD_NAMES,
  footwear: UNRAND_FOOTWEAR_NAMES,
  orb: UNRAND_ORB_NAMES,
  amulet: UNRAND_AMULET_NAMES,
  ring: UNRAND_RING_NAMES,
}

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

function cleanItemName(line: string): string {
  return line
    .replace(/^[a-z0-9] - /i, '')
    .replace(/\s+\((?:worn|haunted)\).*$/i, '')
    .replace(/\s+\{.*$/, '')
    .replace(/^\s*the\s+/i, '')
    .replace(/^\s*an?\s+/i, '')
    .replace(/^[+-]\d+\s+/, '')
    .replace(/"([^"]+)"/g, '"$1"')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractModifiersText(line: string): string | null {
  return line.match(/\{([^}]*)\}/)?.[1]?.trim() ?? null
}

function extractModifiers(modifiersText: string | null): string[] {
  if (!modifiersText) {
    return []
  }

  return modifiersText
    .split(/\s*,\s*/)
    .flatMap((segment) => {
      const trimmed = segment.trim()

      if (!trimmed) {
        return []
      }

      if (/^[A-Za-z][A-Za-z' -]+$/.test(trimmed) || /^orb [A-Za-z][A-Za-z' -]+$/i.test(trimmed)) {
        return [trimmed]
      }

      return trimmed.split(/\s+/)
    })
    .filter(Boolean)
}

function findKnownUnrand(slot: EquipmentSlot, rawName: string): string | undefined {
  return KNOWN_UNRAND_BY_SLOT[slot].find((name) => name.toLowerCase() === rawName.toLowerCase())
}

function getBodyArmourBaseLabel(rawName: string): string | undefined {
  const normalized = rawName.toLowerCase().replace(/"[^"]*"/g, '').replace(/\s+/g, ' ').trim()
  return BODY_ARMOUR_LABELS.find((label) => normalized.includes(label))
}

function getShieldBaseLabel(rawName: string): string | undefined {
  const lower = rawName.toLowerCase()
  return SHIELD_LABELS.find((label) => lower.includes(label))
}

function isRandartName(slot: EquipmentSlot, rawName: string, line: string): boolean {
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
    case 'orb':
      return /^orb of (?:the )?[A-Z]/.test(rawName)
    case 'bodyArmour':
    case 'shield':
    case 'footwear':
      return false
    default:
      return false
  }
}

function getArtifactKind(slot: EquipmentSlot, rawName: string, line: string): ArtifactKind {
  if (findKnownUnrand(slot, rawName)) {
    return 'unrand'
  }

  if (isRandartName(slot, rawName, line)) {
    return 'randart'
  }

  return 'normal'
}

function getDisplayName(slot: EquipmentSlot, rawName: string, artifactKind: ArtifactKind): string {
  const knownUnrand = findKnownUnrand(slot, rawName)
  if (knownUnrand) {
    return knownUnrand
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

  if (slot === 'bodyArmour') {
    return getBodyArmourBaseLabel(rawName) ?? rawName
  }

  if (slot === 'shield') {
    return getShieldBaseLabel(rawName) ?? rawName
  }

  return rawName
}

function buildEquipmentItem(slot: EquipmentSlot, line: string | undefined): EquipmentItemSnapshot | undefined {
  if (!line) {
    return undefined
  }

  const rawName = cleanItemName(line)
  const modifiersText = extractModifiersText(line)
  const artifactKind = getArtifactKind(slot, rawName, line)

  return {
    rawName,
    displayName: getDisplayName(slot, rawName, artifactKind),
    artifactKind,
    modifiersText,
    modifiers: extractModifiers(modifiersText),
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

  const headPatterns = [/\bhat\b/i, /\bhelmet\b/i, /\bcap\b/i, /\bhood\b/i]
  const glovesPatterns = [/\bgloves\b/i]
  const bootsPatterns = [/\bboots\b/i, /\bbarding\b/i]
  const cloakPatterns = [/\bcloak\b/i, /\bscarf\b/i]
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
  const orbLine = armourLines.find((line) => hasAny(line, orbPatterns))
  const bodyArmourLine = armourLines.find((line) => !hasAny(line, nonBodyPatterns))
  const amuletLine = jewelleryLines.find((line) => hasAny(line, amuletPatterns))
  const ringLines = jewelleryLines.filter((line) => hasAny(line, ringPatterns))

  const bodyArmourDetails = buildEquipmentItem('bodyArmour', bodyArmourLine)
  const shieldDetails = buildEquipmentItem('shield', shieldLine)
  const footwearDetails = buildEquipmentItem('footwear', footwearLine)
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
    orbDetails,
    amuletDetails,
    ringDetails,
    helmet: armourLines.some((line) => hasAny(line, headPatterns)),
    gloves: armourLines.some((line) => hasAny(line, glovesPatterns)),
    bootsOrBarding: Boolean(footwearLine),
    cloak: armourLines.some((line) => hasAny(line, cloakPatterns)),
  }
}
