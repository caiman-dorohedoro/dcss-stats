import type { ParsedMorgueRecord } from '../types'

export class ParseFailure extends Error {
  constructor(
    public readonly reason: string,
    public readonly detail: string | null = null,
  ) {
    super(detail ?? reason)
    this.name = 'ParseFailure'
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function validateStrict(row: Partial<ParsedMorgueRecord>): ParsedMorgueRecord {
  if (!row.species) {
    throw new ParseFailure('missing_required_field', 'species')
  }

  if (!isFiniteNumber(row.strength) || !isFiniteNumber(row.intelligence) || !isFiniteNumber(row.dexterity)) {
    throw new ParseFailure('stat_parse_failed')
  }

  if (!isFiniteNumber(row.xl)) {
    throw new ParseFailure('xl_parse_failed')
  }

  if (!isFiniteNumber(row.ac) || !isFiniteNumber(row.ev) || !isFiniteNumber(row.sh)) {
    throw new ParseFailure('combat_stat_parse_failed')
  }

  if (row.bodyArmour === undefined) {
    throw new ParseFailure('ambiguous_body_armour')
  }

  if (row.shield === undefined) {
    throw new ParseFailure('ambiguous_shield')
  }

  if (
    !row.skills
    || !isFiniteNumber(row.skills.armour)
    || !isFiniteNumber(row.skills.dodging)
    || !isFiniteNumber(row.skills.shields)
    || !isFiniteNumber(row.skills.spellcasting)
  ) {
    throw new ParseFailure('skill_parse_failed')
  }

  if (row.spells === undefined) {
    throw new ParseFailure('spell_section_parse_failed')
  }

  return row as ParsedMorgueRecord
}
