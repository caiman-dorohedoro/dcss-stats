import type { FormSnapshot } from './types'

function isStatusContinuation(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) {
    return false
  }

  if (/^[A-Z][A-Za-z0-9 %}'-]*:/.test(trimmed) || /^\}:/.test(trimmed) || /^\d+:/.test(trimmed)) {
    return false
  }

  return true
}

export function extractForm(text: string): FormSnapshot {
  const lines = text.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.trim().startsWith('@:')) {
      continue
    }

    const parts = [line.trim().slice(2).trim()]
    let cursor = index + 1

    while (cursor < lines.length && isStatusContinuation(lines[cursor])) {
      parts.push(lines[cursor].trim())
      cursor += 1
    }

    const statusText = parts.join(' ')
    const match = statusText.match(/\b([A-Za-z-]+-form)\b/)
    return {
      form: match?.[1] ?? null,
    }
  }

  return {
    form: null,
  }
}
