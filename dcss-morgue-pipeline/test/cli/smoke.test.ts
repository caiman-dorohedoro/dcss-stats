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
        '--server',
        'CAO,CBRG',
        '--data-dir',
        '/tmp/dcss-data',
        '--fresh',
        '--min-delay-ms',
        '50',
        '--timeout-ms',
        '2000',
      ],
      { runBootstrapCommand },
    )

    expect(runBootstrapCommand).toHaveBeenCalledWith({
      perBucket: 3,
      serverIds: ['CAO', 'CBRG'],
      dataDir: '/tmp/dcss-data',
      dryRun: false,
      fresh: true,
      minDelayMs: 50,
      timeoutMs: 2000,
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
      since: '2026-04-05T00:00:00.000Z',
      dryRun: true,
      fresh: false,
      dataDir: undefined,
      minDelayMs: undefined,
      timeoutMs: undefined,
      serverIds: undefined,
    })
    expect(result).toEqual({
      exitCode: 0,
      stdout: `Incremental completed.
Selected candidates: 4
Dry run enabled: skipped morgue fetch and parse.`,
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
})
