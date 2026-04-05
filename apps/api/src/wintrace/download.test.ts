import { gzipSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'
import { decodeTextPayload, detectCompression } from './download'

describe('detectCompression', () => {
  test('detects plain text when there is no compression signal', () => {
    expect(detectCompression(Buffer.from('plain text'), 'https://example.com/file', 'text/plain')).toBe(
      'none',
    )
  })

  test('detects gzip from magic bytes', () => {
    expect(
      detectCompression(gzipSync(Buffer.from('hello')), 'https://example.com/file', 'text/plain'),
    ).toBe('gzip')
  })

  test('detects bzip2 from file metadata even without decoding the body', () => {
    expect(detectCompression(Buffer.from('not-real'), 'https://example.com/file.bz2', null)).toBe(
      'bzip2',
    )
  })
})

describe('decodeTextPayload', () => {
  test('decodes plain text payloads', async () => {
    await expect(
      decodeTextPayload({
        input: Buffer.from('hello world'),
        sourceUrl: 'https://example.com/file',
        contentType: 'text/plain',
      }),
    ).resolves.toEqual({
      compression: 'none',
      text: 'hello world',
    })
  })

  test('decodes gzip payloads', async () => {
    await expect(
      decodeTextPayload({
        input: gzipSync(Buffer.from('hello gzip')),
        sourceUrl: 'https://example.com/file',
        contentType: 'application/octet-stream',
      }),
    ).resolves.toEqual({
      compression: 'gzip',
      text: 'hello gzip',
    })
  })
})
