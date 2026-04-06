import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { candidateRepo, parseResultRepo } from '../db/repos'
import type { ParseResultRow } from '../types'
import type { PipelineContext } from '../pipeline/runBootstrap'

function selectAuditRows(results: ParseResultRow[], sampleSize: number): ParseResultRow[] {
  const successes = results.filter((result) => result.parseStatus === 'success')
  const failures = results.filter((result) => result.parseStatus === 'failure')
  const successTarget = Math.min(Math.ceil(sampleSize / 2), successes.length)
  const failureTarget = Math.min(Math.floor(sampleSize / 2), failures.length)
  const selected: ParseResultRow[] = [
    ...successes.slice(0, successTarget),
    ...failures.slice(0, failureTarget),
  ]

  if (selected.length >= sampleSize) {
    return selected.slice(0, sampleSize)
  }

  const remainder = results.filter((result) => !selected.includes(result))
  return [...selected, ...remainder.slice(0, sampleSize - selected.length)]
}

export async function writeAuditBundle(
  ctx: PipelineContext,
  options: {
    sampleSize: number
  },
): Promise<string> {
  const results = parseResultRepo.listAll(ctx.db)
  const selected = selectAuditRows(results, options.sampleSize)
  const auditDir = ctx.paths?.auditDir ?? path.resolve(process.cwd(), 'data/audit')
  const fileName = `audit-${(ctx.now?.() ?? new Date().toISOString()).replace(/[:.]/g, '-')}.json`
  const filePath = path.resolve(auditDir, fileName)

  await mkdir(auditDir, { recursive: true })
  await writeFile(
    filePath,
    JSON.stringify(
      {
        generatedAt: ctx.now?.() ?? new Date().toISOString(),
        sampleSize: options.sampleSize,
        rows: selected.map((parseResult) => ({
          candidate: candidateRepo.get(ctx.db, parseResult.candidateId),
          parseResult,
        })),
      },
      null,
      2,
    ),
    'utf8',
  )

  return filePath
}
