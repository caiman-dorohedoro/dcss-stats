import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { createHostQueues } from '../../src/net/hostQueues'

describe('createHostQueues', () => {
  it('allows cross-host parallelism while serializing requests within a host', async () => {
    const queues = createHostQueues({ minDelayMs: 5 })
    const startedAt = Date.now()
    const marks: Record<string, number> = {}

    const run = (host: string, label: string) =>
      queues.forHost(host).add(async () => {
        marks[`${label}:start`] = Date.now() - startedAt
        await delay(20)
        marks[`${label}:end`] = Date.now() - startedAt
      })

    await Promise.all([run('crawl.akrasiac.org', 'cao-1'), run('crawl.akrasiac.org', 'cao-2'), run('crawl.br', 'cbrg-1')])

    expect(marks['cao-2:start']).toBeGreaterThanOrEqual(marks['cao-1:end'])
    expect(marks['cbrg-1:start']).toBeLessThan(marks['cao-1:end'])
  })
})
