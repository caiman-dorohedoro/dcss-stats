import { DEFAULT_SPECIES_NAMES } from './canonicalSpecies'
import type { BaseStatsSnapshot } from './types'

const SORTED_SPECIES_NAMES = [...DEFAULT_SPECIES_NAMES].sort((left, right) => right.length - left.length)

type ExtractBaseStatsOptions = {
  speciesNames?: readonly string[]
}

function parseVersion(text: string): BaseStatsSnapshot['version'] {
  const versionText = text.match(/Dungeon Crawl Stone Soup version ([^\s(]+)/)?.[1]

  if (!versionText) {
    throw new Error('Could not find morgue version line')
  }

  return versionText
}

function parsePlayerName(text: string): string | null {
  const summaryLineName = text.match(/^\s*\d+\s+(\S+)\s+the\b/m)?.[1]

  if (summaryLineName) {
    return summaryLineName
  }

  const titleLineName = text.match(/^\s*(\S+)\s+the\s+.+Turns:/m)?.[1]

  if (titleLineName) {
    return titleLineName
  }

  return null
}

function matchSpecies(descriptor: string, speciesNames: readonly string[]): string {
  const normalizedDescriptor = descriptor.trim().replace(
    /^[A-Za-z]+ Draconian(?:\b.*)?$/,
    'Draconian',
  )
  const species = speciesNames.find(
    (name) => normalizedDescriptor === name || normalizedDescriptor.startsWith(`${name} `),
  )

  if (!species) {
    throw new Error(`Could not match species from line: ${descriptor}`)
  }

  return species
}

function parseSpecies(text: string, speciesNames: readonly string[]): string {
  const beganAsDescriptor = text.match(/^\s*Began as an? (.+?) on [A-Z][a-z]{2} \d{1,2}, \d{4}\.$/m)?.[1]

  if (beganAsDescriptor) {
    return matchSpecies(beganAsDescriptor, speciesNames)
  }

  const directDescriptor = text.match(/You are an? (.+?)\./)?.[1]

  if (directDescriptor) {
    return matchSpecies(directDescriptor, speciesNames)
  }

  const titleDescriptor = text.match(/^[^\n]*\(([^)]+)\)\s+Turns:/m)?.[1]

  if (titleDescriptor) {
    return matchSpecies(titleDescriptor, speciesNames)
  }

  throw new Error('Could not find species line')
}

function parsePrimaryStats(text: string) {
  const legacyMatch = text.match(/You have (\d+) Strength, (\d+) Intelligence and (\d+) Dexterity\./)

  if (legacyMatch) {
    return {
      strength: Number(legacyMatch[1]),
      intelligence: Number(legacyMatch[2]),
      dexterity: Number(legacyMatch[3]),
    }
  }

  const strength = text.match(/\bStr:\s+(\d+)/)?.[1]
  const intelligence = text.match(/\bInt:\s+(\d+)/)?.[1]
  const dexterity = text.match(/\bDex:\s+(\d+)/)?.[1]

  if (!strength || !intelligence || !dexterity) {
    throw new Error('Could not parse primary stats')
  }

  return {
    strength: Number(strength),
    intelligence: Number(intelligence),
    dexterity: Number(dexterity),
  }
}

function parseDefensiveStats(text: string) {
  const ac = text.match(/\bAC:\s+(-?\d+)/)?.[1]
  const ev = text.match(/\bEV:\s+(-?\d+)/)?.[1]
  const sh = text.match(/\bSH:\s+(-?\d+)/)?.[1]

  if (!ac || !ev || !sh) {
    throw new Error('Could not parse AC/EV/SH')
  }

  return {
    ac: Number(ac),
    ev: Number(ev),
    sh: Number(sh),
  }
}

export function extractBaseStats(text: string, options?: ExtractBaseStatsOptions): BaseStatsSnapshot {
  const speciesNames = [...(options?.speciesNames ?? SORTED_SPECIES_NAMES)].sort(
    (left, right) => right.length - left.length,
  )

  return {
    playerName: parsePlayerName(text),
    version: parseVersion(text),
    species: parseSpecies(text, speciesNames),
    ...parseDefensiveStats(text),
    ...parsePrimaryStats(text),
  }
}
