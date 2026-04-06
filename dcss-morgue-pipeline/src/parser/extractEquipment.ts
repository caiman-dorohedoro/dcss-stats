import type { EquipmentSnapshot } from '../types'
import { splitSections } from './splitSections'

const BODY_ARMOUR_LABELS = [
  'plate armour',
  'chain mail',
  'scale mail',
  'ring mail',
  'leather armour',
  'robe',
] as const

const SHIELD_LABELS = ['tower shield', 'kite shield', 'buckler'] as const

type EquipmentLine = {
  category: string | null
  text: string
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

function normalizeBodyArmour(line: string | undefined): string | undefined {
  if (!line) {
    return 'none'
  }

  const lower = line.toLowerCase()
  const match = BODY_ARMOUR_LABELS.find((label) => lower.includes(label))

  return match
}

function normalizeShield(line: string | undefined): string | undefined {
  if (!line) {
    return 'none'
  }

  const lower = line.toLowerCase()
  const match = SHIELD_LABELS.find((label) => lower.includes(label))

  return match
}

export function extractEquipment(text: string): EquipmentSnapshot {
  const section = splitSections(text).equipment
  const lines = parseEquipmentLines(section)
  const equippedLines = lines.filter((line) => isEquipped(line.text))
  const armourLines = equippedLines
    .filter((line) => line.category === null || line.category === 'Armour')
    .map((line) => line.text)

  const headPatterns = [/\bhat\b/i, /\bhelmet\b/i, /\bcap\b/i, /\bhood\b/i]
  const glovesPatterns = [/\bgloves\b/i]
  const bootsPatterns = [/\bboots\b/i, /\bbarding\b/i]
  const cloakPatterns = [/\bcloak\b/i]
  const shieldPatterns = SHIELD_LABELS.map((label) => new RegExp(`\\b${label}\\b`, 'i'))

  const shieldLine = armourLines.find((line) => hasAny(line, shieldPatterns))
  const bodyArmourLine = armourLines.find((line) =>
    BODY_ARMOUR_LABELS.some((label) => line.toLowerCase().includes(label)),
  )

  return {
    bodyArmour: normalizeBodyArmour(bodyArmourLine),
    shield: normalizeShield(shieldLine),
    helmet: armourLines.some((line) => hasAny(line, headPatterns)),
    gloves: armourLines.some((line) => hasAny(line, glovesPatterns)),
    bootsOrBarding: armourLines.some((line) => hasAny(line, bootsPatterns)),
    cloak: armourLines.some((line) => hasAny(line, cloakPatterns)),
  }
}
