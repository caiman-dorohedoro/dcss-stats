import PQueue from 'p-queue'

export type RequestThrottleOptions = {
  concurrencyPerKey?: number
  intervalMs?: number
  intervalCap?: number
}

export type RequestThrottleRunOptions = {
  key: string
}

export type RequestThrottle = {
  run: <T>(options: RequestThrottleRunOptions, task: () => Promise<T>) => Promise<T>
}

export const createRequestThrottle = ({
  concurrencyPerKey = 1,
  intervalMs = 1_000,
  intervalCap = 1,
}: RequestThrottleOptions = {}): RequestThrottle => {
  const queues = new Map<string, PQueue>()

  const getQueue = (key: string) => {
    const existing = queues.get(key)

    if (existing) {
      return existing
    }

    const created = new PQueue({
      concurrency: Math.max(1, concurrencyPerKey),
      interval: Math.max(0, intervalMs),
      intervalCap: Math.max(1, intervalCap),
      carryoverConcurrencyCount: true,
    })

    queues.set(key, created)
    return created
  }

  return {
    run: async <T>({ key }: RequestThrottleRunOptions, task: () => Promise<T>) => {
      return getQueue(key).add(task) as Promise<T>
    },
  }
}
