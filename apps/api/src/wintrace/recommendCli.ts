import path from 'node:path'
import { loadWinTraceVersionBundle, readWinTraceVersionBundle } from './io'
import { buildProgressiveSkillRecommendations, buildSkillRecommendations } from './recommendations'
import { getSkillTraceLabel } from './skillTrace'

const parseBooleanFlag = (flagName: string) => {
  return process.argv.includes(flagName)
}

const parseStringOption = (optionName: string) => {
  const entry = process.argv.find((argument) => argument.startsWith(`${optionName}=`))
  return entry?.slice(optionName.length + 1)
}

const parseNumberOption = (optionName: string, fallback: number) => {
  const value = parseStringOption(optionName)
  const parsed = value ? Number(value) : NaN

  return Number.isFinite(parsed) ? parsed : fallback
}

const parseListOption = (optionName: string) => {
  const value = parseStringOption(optionName)

  return value
    ? value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : []
}

const parseNullableStringOption = (optionName: string) => {
  const value = parseStringOption(optionName)

  if (value === undefined) {
    return undefined
  }

  const normalized = value.trim().toLowerCase()

  if (['', 'null', 'none', 'atheist'].includes(normalized)) {
    return null
  }

  return value
}

const formatPercent = (value: number) => `${(value * 100).toFixed(0)}%`

const formatLevel = (value: number) => {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

const describeFilterValue = (value: string | null | undefined) => {
  if (value === undefined) {
    return '*'
  }

  return value === null ? 'null' : value
}

const main = async () => {
  const bundleOption = parseStringOption('--bundle')
  const outputDir = parseStringOption('--output-dir')
  const requestedVersionMinor = parseStringOption('--version') ?? parseStringOption('--version-minor')
  const xl = parseNumberOption('--xl', NaN)
  const nextWindow = parseNumberOption('--next-window', 3)
  const minSample = parseNumberOption('--min-sample', 10)
  const top = parseNumberOption('--top', 10)
  const race = parseStringOption('--race')
  const className = parseStringOption('--class')
  const finalGod = parseNullableStringOption('--final-god')
  const godAtXl = parseNullableStringOption('--god-at-xl')
  const skillIds = parseListOption('--skill-ids')
  const noFallback = parseBooleanFlag('--no-fallback')
  const json = parseBooleanFlag('--json')

  if (!Number.isFinite(xl) || xl < 1) {
    throw new Error('Missing or invalid --xl option. Example: --xl=10')
  }

  const loaded = bundleOption
    ? {
        manifestPath: null,
        manifest: null,
        versionMinor: requestedVersionMinor ?? null,
        ...(await readWinTraceVersionBundle({
          bundlePath: path.resolve(process.cwd(), bundleOption),
        })),
      }
    : await loadWinTraceVersionBundle({
        outputDir,
        versionMinor: requestedVersionMinor,
      })
  const effectiveVersionMinor = requestedVersionMinor ?? loaded.bundle.versionMinor
  const recommendation =
    !noFallback && (race || className)
      ? buildProgressiveSkillRecommendations({
          records: loaded.bundle.games,
          xl,
          nextWindow,
          versionMinor: effectiveVersionMinor,
          race,
          className,
          finalGod,
          godAtXl,
          skillIds: skillIds.length > 0 ? skillIds : undefined,
          minSample,
        })
      : buildSkillRecommendations({
          records: loaded.bundle.games,
          xl,
          nextWindow,
          versionMinor: effectiveVersionMinor,
          race,
          className,
          finalGod,
          godAtXl,
          skillIds: skillIds.length > 0 ? skillIds : undefined,
        })
  const topSkills = recommendation.skills.slice(0, Math.max(top, 0))
  const output = {
    bundle: {
      bundlePath: loaded.bundlePath,
      versionMinor: loaded.bundle.versionMinor,
      revision: loaded.bundle.revision,
      gameCount: loaded.bundle.gameCount,
    },
    recommendation: {
      ...recommendation,
      skills: topSkills.map((skill) => ({
        ...skill,
        skillName: getSkillTraceLabel(skill.skillId),
      })),
    },
  }

  if (json) {
    console.log(JSON.stringify(output, null, 2))
    return
  }

  console.log(
    [
      `bundle=${loaded.bundle.versionMinor}`,
      `revision=${loaded.bundle.revision}`,
      `games=${loaded.bundle.gameCount}`,
      `sample=${recommendation.sampleSize}`,
      `xl=${recommendation.xl}`,
      `nextWindow=${recommendation.nextWindow}`,
      'matchedBy' in recommendation ? `matchedBy=${recommendation.matchedBy}` : null,
    ]
      .filter(Boolean)
      .join(' '),
  )
  console.log(
    [
      `filters version=${effectiveVersionMinor ?? '*'}`,
      `race=${describeFilterValue(race)}`,
      `class=${describeFilterValue(className)}`,
      `finalGod=${describeFilterValue(finalGod)}`,
      `godAtXl=${describeFilterValue(godAtXl)}`,
      'sampleThreshold' in recommendation ? `minSample=${recommendation.sampleThreshold}` : null,
    ]
      .filter(Boolean)
      .join(' '),
  )

  if (topSkills.length === 0) {
    console.log('no matching skill recommendations')
    return
  }

  for (const [index, skill] of topSkills.entries()) {
    console.log(
      [
        `${index + 1}. ${getSkillTraceLabel(skill.skillId)} (${skill.skillId})`,
        `trainNow=${formatPercent(skill.trainedAtXlRate)} (${skill.trainedAtXlCount}/${skill.sampleSize})`,
        `next=${formatPercent(skill.trainedNextWindowRate)} (${skill.trainedNextWindowCount}/${skill.sampleSize})`,
        `nonZero=${formatPercent(skill.nonZeroRate)} (${skill.nonZeroCount}/${skill.sampleSize})`,
        `median=${formatLevel(skill.levelSummary.median)}`,
        `p25-p75=${formatLevel(skill.levelSummary.p25)}-${formatLevel(skill.levelSummary.p75)}`,
      ].join(' | '),
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
