import PQueue from 'p-queue'

export function createHostQueues({ minDelayMs }: { minDelayMs: number }) {
  const queues = new Map<string, PQueue>()

  return {
    forHost(host: string) {
      if (!queues.has(host)) {
        queues.set(
          host,
          new PQueue({
            concurrency: 1,
            intervalCap: 1,
            interval: minDelayMs,
          }),
        )
      }

      return queues.get(host)!
    },
  }
}
