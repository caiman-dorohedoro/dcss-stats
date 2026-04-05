import { describe, expect, test } from 'vitest'
import { createRequestThrottle } from './requestThrottle'

describe('createRequestThrottle', () => {
  test('serializes requests with the same key', async () => {
    const throttle = createRequestThrottle({
      concurrencyPerKey: 1,
      intervalMs: 0,
      intervalCap: 1,
    })
    const blocker = Promise.withResolvers<void>()
    const order: string[] = []

    const first = throttle.run({ key: 'CNC' }, async () => {
      order.push('start-1')
      await blocker.promise
      order.push('end-1')
    })
    const second = throttle.run({ key: 'CNC' }, async () => {
      order.push('start-2')
      order.push('end-2')
    })

    await Promise.resolve()
    expect(order).toEqual(['start-1'])

    blocker.resolve()
    await Promise.all([first, second])

    expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2'])
  })

  test('keeps different keys independent', async () => {
    const throttle = createRequestThrottle({
      concurrencyPerKey: 1,
      intervalMs: 0,
      intervalCap: 1,
    })
    const order: string[] = []

    await Promise.all([
      throttle.run({ key: 'CNC' }, async () => {
        order.push('cnc')
      }),
      throttle.run({ key: 'CDI' }, async () => {
        order.push('cdi')
      }),
    ])

    expect(order.sort()).toEqual(['cdi', 'cnc'])
  })
})
