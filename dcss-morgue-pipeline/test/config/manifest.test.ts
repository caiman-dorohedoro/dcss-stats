import { describe, expect, it } from 'vitest'
import {
  ACTIVE_SERVER_IDS,
  getBucketForSourceVersion,
  getServerManifest,
} from '../../src/config/manifest'
import {
  CANONICAL_BODY_ARMOUR,
  CANONICAL_SHIELDS,
  CANONICAL_SPELL_SCHOOLS,
} from '../../src/config/canonical'

describe('manifest', () => {
  it('includes CAO and CBRG for normalized 0.34/trunk buckets', () => {
    expect(ACTIVE_SERVER_IDS).toContain('CAO')
    expect(ACTIVE_SERVER_IDS).toContain('CBRG')
    expect(ACTIVE_SERVER_IDS).not.toContain('CUE')
    expect(getServerManifest('CAO').buckets).toEqual(['0.34', 'trunk'])
  })

  it('encodes source version labels separately from normalized buckets', () => {
    const cao = getServerManifest('CAO')
    expect(cao.logfiles.trunk.sourceVersionLabel).toBe('git')
    expect(cao.logfiles.trunk.url).toBe('http://crawl.akrasiac.org/logfile-git')
    expect(cao.morgueRule.kind).toBe('rawdata-player-dir')
  })

  it('maps supported source labels through the manifest and rejects unsupported versions', () => {
    expect(getBucketForSourceVersion('CAO', '0.34')).toBe('0.34')
    expect(getBucketForSourceVersion('CAO', '0.34.0')).toBe('0.34')
    expect(getBucketForSourceVersion('CAO', '0.34-b1')).toBe('0.34')
    expect(getBucketForSourceVersion('CAO', 'git')).toBe('trunk')
    expect(getBucketForSourceVersion('CAO', '0.35-a0')).toBe('trunk')
    expect(() => getBucketForSourceVersion('CAO', '0.33')).toThrow(
      'Unsupported source version for CAO: 0.33',
    )
    expect(() => getBucketForSourceVersion('CAO', '0.8.0-a0')).toThrow(
      'Unsupported source version for CAO: 0.8.0-a0',
    )
  })

  it('defines canonical labels with none sentinels', () => {
    expect(CANONICAL_BODY_ARMOUR).toContain('none')
    expect(CANONICAL_SHIELDS).toContain('none')
    expect(CANONICAL_SPELL_SCHOOLS).toContain('fire magic')
  })
})
