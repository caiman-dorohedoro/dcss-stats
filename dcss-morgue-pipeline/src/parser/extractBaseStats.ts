import { data as seedData } from '../../../apps/api/prisma/seedData'
import type { BaseStatsSnapshot } from '../types'

const SPECIES_NAMES = seedData.races
  .map(([, name]) => name)
  .filter(Boolean)
  .sort((left, right) => right.length - left.length)

function parseVersion(text: string): BaseStatsSnapshot['version'] {
  const versionText = text.match(/Dungeon Crawl Stone Soup version ([^\n]+)/)?.[1]

  if (!versionText) {
    throw new Error('Could not find morgue version line')
  }

  if (/0\.34/i.test(versionText)) {
    return '0.34'
  }

  const versionMatch = versionText.match(/0\.(\d+)/)

  if (versionMatch && Number.parseInt(versionMatch[1], 10) > 34) {
    return 'trunk'
  }

  if (/git|trunk/i.test(versionText)) {
    return 'trunk'
  }

  throw new Error(`Unsupported morgue version: ${versionText}`)
}

function matchSpecies(descriptor: string): string {
  const normalizedDescriptor = descriptor.trim().replace(
    /^[A-Za-z]+ Draconian(?:\b.*)?$/,
    'Draconian',
  )
  const species = SPECIES_NAMES.find(
    (name) => normalizedDescriptor === name || normalizedDescriptor.startsWith(`${name} `),
  )

  if (!species) {
    throw new Error(`Could not match species from line: ${descriptor}`)
  }

  return species
}

function parseSpecies(text: string): string {
  const beganAsDescriptor = text.match(/^\s*Began as an? (.+?) on [A-Z][a-z]{2} \d{1,2}, \d{4}\.$/m)?.[1]

  if (beganAsDescriptor) {
    return matchSpecies(beganAsDescriptor)
  }

  const directDescriptor = text.match(/You are an? (.+?)\./)?.[1]

  if (directDescriptor) {
    return matchSpecies(directDescriptor)
  }

  const titleDescriptor = text.match(/^[^\n]*\(([^)]+)\)\s+Turns:/m)?.[1]

  if (titleDescriptor) {
    return matchSpecies(titleDescriptor)
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

export function extractBaseStats(text: string): BaseStatsSnapshot {
  return {
    version: parseVersion(text),
    species: parseSpecies(text),
    ...parseDefensiveStats(text),
    ...parsePrimaryStats(text),
  }
}
