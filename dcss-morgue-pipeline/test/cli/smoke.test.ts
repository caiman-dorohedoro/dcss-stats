import { describe, expect, it, vi } from 'vitest'
import { runCli } from '../../src/cli'

describe('runCli', () => {
  it('prints usage for no command', async () => {
    await expect(runCli([])).resolves.toEqual({
      exitCode: 1,
      stdout: `Usage: dcss-morgue <command> [options]
Commands:
  bootstrap
  incremental
  audit`,
    })
  })

  it('parses bootstrap options and runs the command handler', async () => {
    const runBootstrapCommand = vi.fn().mockResolvedValue({
      selectedCandidates: 3,
      parsedSuccesses: 2,
      parsedFailures: 1,
    })

    const result = await runCli(
      [
        'bootstrap',
        '--per-bucket',
        '3',
        '--min-xl',
        '10',
        '--server',
        'CAO,CBRG',
        '--data-dir',
        '/tmp/dcss-data',
        '--fresh',
        '--fresh-logfiles',
        '--verbose',
        '--initial-tail-bytes',
        '4096',
        '--backfill-chunk-bytes',
        '8192',
        '--min-delay-ms',
        '50',
        '--timeout-ms',
        '2000',
      ],
      { runBootstrapCommand },
    )

    expect(runBootstrapCommand).toHaveBeenCalledWith({
      perBucket: 3,
      minXl: 10,
      serverIds: ['CAO', 'CBRG'],
      dataDir: '/tmp/dcss-data',
      dryRun: false,
      fresh: true,
      freshLogfiles: true,
      initialTailBytes: 4096,
      backfillChunkBytes: 8192,
      minDelayMs: 50,
      timeoutMs: 2000,
      verbose: true,
    })
    expect(result).toEqual({
      exitCode: 0,
      stdout: `Bootstrap completed.
Selected candidates: 3
Parsed successes: 2
Parsed failures: 1`,
    })
  })

  it('supports incremental dry-run output', async () => {
    const runIncrementalCommand = vi.fn().mockResolvedValue({
      selectedCandidates: 4,
      parsedSuccesses: 0,
      parsedFailures: 0,
    })

    const result = await runCli(
      ['incremental', '--dry-run', '--since', '2026-04-05T00:00:00Z'],
      { runIncrementalCommand },
    )

    expect(runIncrementalCommand).toHaveBeenCalledWith({
      perBucket: 10,
      minXl: undefined,
      since: '2026-04-05T00:00:00.000Z',
      dryRun: true,
      fresh: false,
      freshLogfiles: false,
      dataDir: undefined,
      initialTailBytes: undefined,
      minDelayMs: undefined,
      timeoutMs: undefined,
      serverIds: undefined,
      verbose: false,
    })
    expect(result).toEqual({
      exitCode: 0,
      stdout: `Incremental completed.
Selected candidates: 4
Dry run enabled: skipped morgue fetch and parse.`,
    })
  })

  it('passes min-xl through incremental options', async () => {
    const runIncrementalCommand = vi.fn().mockResolvedValue({
      selectedCandidates: 1,
      parsedSuccesses: 0,
      parsedFailures: 0,
    })

    await runCli(
      ['incremental', '--dry-run', '--since', '2026-04-05T00:00:00Z', '--min-xl', '12'],
      { runIncrementalCommand },
    )

    expect(runIncrementalCommand).toHaveBeenCalledWith({
      perBucket: 10,
      minXl: 12,
      since: '2026-04-05T00:00:00.000Z',
      dryRun: true,
      fresh: false,
      freshLogfiles: false,
      dataDir: undefined,
      initialTailBytes: undefined,
      minDelayMs: undefined,
      timeoutMs: undefined,
      serverIds: undefined,
      verbose: false,
    })
  })

  it('prints audit output path', async () => {
    const runAuditCommand = vi.fn().mockResolvedValue('/tmp/dcss-data/audit/audit-1.json')

    const result = await runCli(['audit', '--sample-size', '4'], { runAuditCommand })

    expect(runAuditCommand).toHaveBeenCalledWith({
      sampleSize: 4,
      dataDir: undefined,
      minDelayMs: undefined,
      timeoutMs: undefined,
      serverIds: undefined,
    })
    expect(result).toEqual({
      exitCode: 0,
      stdout: 'Audit bundle written to /tmp/dcss-data/audit/audit-1.json',
    })
  })

  it('rejects unknown server ids', async () => {
    await expect(runCli(['bootstrap', '--server', 'NOPE'])).resolves.toEqual({
      exitCode: 1,
      stdout: 'Unknown server id(s): NOPE',
    })
  })

  it('rejects CUE because it is no longer an active public server target', async () => {
    await expect(runCli(['bootstrap', '--server', 'CUE'])).resolves.toEqual({
      exitCode: 1,
      stdout: 'Unknown server id(s): CUE',
    })
  })
})
