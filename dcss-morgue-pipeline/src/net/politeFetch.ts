import { createHostQueues } from './hostQueues'

type FetchLike = typeof fetch

export type PoliteFetch = typeof fetch

function getRequestSignal(signal: AbortSignal | null | undefined, timeoutMs: number): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)

  if (!signal) {
    return timeoutSignal
  }

  return AbortSignal.any([signal, timeoutSignal])
}

export function createPoliteFetch(options: {
  minDelayMs: number
  timeoutMs: number
  fetchImpl?: FetchLike
}): PoliteFetch {
  const queues = createHostQueues({ minDelayMs: options.minDelayMs })
  const fetchImpl = options.fetchImpl ?? fetch

  return async (url: URL | RequestInfo, init?: RequestInit) => {
    const requestUrl = url instanceof Request ? url.url : url.toString()
    const host = new URL(requestUrl).host

    const response = await queues.forHost(host).add(() =>
      fetchImpl(url, {
        ...init,
        signal: getRequestSignal(init?.signal, options.timeoutMs),
      }),
    )

    if (!response) {
      throw new Error(`Queued request for ${host} did not produce a response`)
    }

    return response
  }
}
