export type SectionMap = {
  header: string
  equipment: string
  skills: string
  spells: string
  magicModifiers: string
}

const SECTION_HEADINGS = ['Inventory', 'Equipment', 'Skills', 'Spells', 'Magic Modifiers'] as const

function splitLines(text: string): string[] {
  return text.split('\n')
}

function isHeadingLine(line: string, headings: readonly string[]): boolean {
  return headings.some((heading) => line.trim() === `${heading}:`)
}

function collectIndentedBlock(
  lines: string[],
  startIndex: number,
  options: {
    acceptsLine: (line: string) => boolean
  },
): string {
  const collected: string[] = []

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]

    if (isHeadingLine(line, SECTION_HEADINGS)) {
      break
    }

    if (line.trim().length === 0) {
      if (collected.length > 0) {
        collected.push(line)
      }
      continue
    }

    if (!options.acceptsLine(line)) {
      break
    }

    collected.push(line)
  }

  return collected.join('\n').trim()
}

function collectInventory(lines: string[]): string {
  const startIndex = lines.findIndex((line) => isHeadingLine(line, ['Inventory', 'Equipment']))

  if (startIndex === -1) {
    return ''
  }

  return collectIndentedBlock(lines, startIndex + 1, {
    // Inventory includes wrapped description text between item lines.
    // Keep the whole block until the next top-level section and let
    // the equipment parser ignore non-item lines.
    acceptsLine: () => true,
  })
}

function collectSkills(lines: string[]): string {
  const startIndex = lines.findIndex((line) => isHeadingLine(line, ['Skills']))

  if (startIndex === -1) {
    return ''
  }

  return collectIndentedBlock(lines, startIndex + 1, {
    acceptsLine: (line) => {
      const trimmed = line.trim()
      return (
        trimmed.length === 0 ||
        /^(?:[O+*-]\s+)?Level\s+[0-9]+(?:\.[0-9])?(?:\([0-9]+(?:\.[0-9])?\))?\s+/.test(trimmed)
      )
    },
  })
}

function collectSpells(lines: string[]): string {
  const startIndex = lines.findIndex((line) => isHeadingLine(line, ['Spells']))

  if (startIndex === -1) {
    return ''
  }

  return collectIndentedBlock(lines, startIndex + 1, {
    acceptsLine: (line) => {
      const trimmed = line.trim()
      return trimmed.length === 0 || /^(\*?\s*.+?\s+\d+%)$/.test(trimmed)
    },
  })
}

function collectMagicModifiers(lines: string[]): string {
  const startIndex = lines.findIndex((line) => isHeadingLine(line, ['Magic Modifiers']))

  if (startIndex === -1) {
    return ''
  }

  return collectIndentedBlock(lines, startIndex + 1, {
    acceptsLine: (line) => {
      const trimmed = line.trim()
      return trimmed.length === 0 || /^(Wizardry|Channel|Wild Magic):/.test(trimmed)
    },
  })
}

export function splitSections(text: string): SectionMap {
  const lines = splitLines(text)
  const inventoryStart = lines.findIndex((line) => isHeadingLine(line, ['Inventory', 'Equipment']))
  const skillsStart = lines.findIndex((line) => isHeadingLine(line, ['Skills']))
  const boundaryIndexes = [inventoryStart, skillsStart].filter((index) => index >= 0)
  const headerEnd = boundaryIndexes.length > 0 ? Math.min(...boundaryIndexes) : lines.length

  return {
    header: lines.slice(0, headerEnd).join('\n').trim(),
    equipment: collectInventory(lines),
    skills: collectSkills(lines),
    spells: collectSpells(lines),
    magicModifiers: collectMagicModifiers(lines),
  }
}
