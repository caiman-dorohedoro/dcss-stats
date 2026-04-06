import type { MagicModifiersSnapshot } from '../types'
import { splitSections } from './splitSections'

function parseModifier(section: string, label: string): number | undefined {
  const raw = section.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'))?.[1]?.trim()

  if (!raw) {
    return undefined
  }

  if (!/^\d+$/.test(raw)) {
    return undefined
  }

  return Number(raw)
}

export function extractMagicModifiers(text: string): MagicModifiersSnapshot {
  const section = splitSections(text).magicModifiers

  if (!section) {
    return {
      wizardry: 0,
      channel: 0,
      wildMagic: 0,
    }
  }

  return {
    wizardry: parseModifier(section, 'Wizardry'),
    channel: parseModifier(section, 'Channel'),
    wildMagic: parseModifier(section, 'Wild Magic'),
  }
}
