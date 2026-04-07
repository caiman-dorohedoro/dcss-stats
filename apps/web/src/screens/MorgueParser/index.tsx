'use client'

import { parseMorgueText, type ParseMorgueTextResult } from '@dcss-stats/morgue-parser'
import { startTransition, useMemo, useState } from 'react'

export function MorgueParserScreen() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<ParseMorgueTextResult | null>(null)

  const sortedSpells = useMemo(() => {
    if (!result?.ok) {
      return []
    }

    return [...result.record.spells].sort((left, right) => {
      if (left.failurePercent !== right.failurePercent) {
        return left.failurePercent - right.failurePercent
      }

      if (left.memorized !== right.memorized) {
        return left.memorized ? -1 : 1
      }

      return left.name.localeCompare(right.name)
    })
  }, [result])

  const prettyJson = useMemo(() => {
    if (!result) {
      return ''
    }

    return JSON.stringify(result.ok ? result.record : result.failure, null, 2)
  }, [result])

  const summarizedRings = useMemo(() => {
    if (!result?.ok) {
      return 'none'
    }

    return summarizeRings(result.record.rings)
  }, [result])

  const summarizedAmulet = useMemo(() => {
    if (!result?.ok) {
      return 'none'
    }

    return summarizeAmulet(result.record.amulet)
  }, [result])

  const summarizedFootwear = useMemo(() => {
    if (!result?.ok) {
      return 'none'
    }

    return summarizeEquipmentList(result.record.footwear)
  }, [result])

  const summarizedMutations = useMemo(() => {
    if (!result?.ok) {
      return 'none'
    }

    return result.record.mutations.length > 0
      ? result.record.mutations
          .map((entry) => (entry.level === null ? entry.name : `${entry.name} ${entry.level}`))
          .join(', ')
      : 'none'
  }, [result])

  const handleParse = () => {
    startTransition(() => {
      setResult(parseMorgueText(input))
    })
  }

  const handleClear = () => {
    setInput('')
    setResult(null)
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-6 md:py-10">
      <section className="rounded-3xl border border-gray-200 bg-linear-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
        <div className="max-w-3xl space-y-4">
          <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold tracking-[0.22em] text-amber-900 uppercase dark:bg-amber-500/15 dark:text-amber-200">
            Morgue Parser
          </span>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-950 md:text-4xl dark:text-white">
              Paste a DCSS morgue and get structured JSON back
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-gray-600 md:text-base dark:text-zinc-300">
              The parser runs entirely in your browser. Paste raw morgue text on the left, then
              parse it into the same structured fields the pipeline stores: species, AC/EV/SH,
              equipment, skills, spell library, and memorized spells.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-950 dark:text-white">Morgue Text</h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Paste the full morgue text exactly as copied from a server or browser tab.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={handleClear}
              >
                Clear
              </button>
              <button
                type="button"
                disabled={!input.trim()}
                className="rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300 dark:disabled:bg-amber-800"
                onClick={handleParse}
              >
                Parse JSON
              </button>
            </div>
          </div>

          <textarea
            value={input}
            placeholder="Dungeon Crawl Stone Soup version 0.34.0 (webtiles) character file..."
            className="min-h-[30rem] w-full resize-y rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-xs leading-6 text-gray-900 outline-none placeholder:text-gray-400 focus:border-amber-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-amber-500 dark:focus:bg-zinc-950"
            onChange={(event) => setInput(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-950 dark:text-white">Parse Result</h2>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Success returns a normalized record. Failures return a strict parser reason.
                </p>
              </div>
              <StatusBadge result={result} />
            </div>

            {result?.ok && (
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryItem label="Player" value={result.record.playerName ?? '-'} />
                <SummaryItem label="Species" value={result.record.species} />
                <SummaryItem label="Version" value={result.record.version} />
                <SummaryItem label="AC / EV / SH" value={`${result.record.ac} / ${result.record.ev} / ${result.record.sh}`} />
                <SummaryItem label="Body Armour" value={result.record.bodyArmour} />
                <SummaryItem label="Footwear" value={summarizedFootwear} />
                <SummaryItem label="Shield" value={result.record.shield} />
                <SummaryItem label="Orb" value={result.record.orb} />
                <SummaryItem label="Amulet" value={summarizedAmulet} />
                <SummaryItem label="Rings" value={summarizedRings} />
                <SummaryItem label="Traits / Mutations" value={summarizedMutations} />
                <SummaryItem label="Spellcasting" value={String(result.record.skills.spellcasting)} />
                <SummaryItem label="Spell Count" value={String(result.record.spells.length)} />
              </dl>
            )}

            {result && !result.ok && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
                <div className="font-semibold">{result.failure.reason}</div>
                {result.failure.detail && <div className="mt-1 text-xs opacity-80">{result.failure.detail}</div>}
              </div>
            )}

            {result?.ok && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-950 dark:text-white">Spell List</h3>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                      Sorted by lowest failure rate first.
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-800 uppercase dark:bg-amber-500/15 dark:text-amber-300">
                    {sortedSpells.length} spells
                  </span>
                </div>

                {sortedSpells.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-800">
                    <div className="grid grid-cols-[minmax(0,1fr)_6rem_7rem] bg-gray-100 px-3 py-2 text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:bg-zinc-800 dark:text-zinc-400">
                      <div>Spell</div>
                      <div className="text-right">Failure</div>
                      <div className="text-right">Memorized</div>
                    </div>
                    <div className="max-h-80 overflow-auto">
                      {sortedSpells.map((spell) => (
                        <div
                          key={`${spell.name}-${spell.failurePercent}-${spell.memorized ? 'y' : 'n'}`}
                          className="grid grid-cols-[minmax(0,1fr)_6rem_7rem] items-center gap-3 border-t border-gray-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                        >
                          <div className="min-w-0 truncate font-medium text-gray-900 dark:text-zinc-100">
                            {spell.name}
                          </div>
                          <div className="text-right font-mono text-gray-700 dark:text-zinc-300">
                            {spell.failurePercent}%
                          </div>
                          <div className="flex justify-end">
                            <span
                              className={
                                spell.memorized
                                  ? 'rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold tracking-wide text-emerald-800 uppercase dark:bg-emerald-500/15 dark:text-emerald-300'
                                  : 'rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold tracking-wide text-gray-600 uppercase dark:bg-zinc-800 dark:text-zinc-300'
                              }
                            >
                              {spell.memorized ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-6 text-sm text-gray-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                    This morgue does not list memorized spells or a spell library.
                  </div>
                )}
              </div>
            )}

            <pre className="mt-4 max-h-[40rem] overflow-auto rounded-2xl border border-gray-200 bg-gray-950 p-4 text-xs leading-6 text-gray-100 dark:border-zinc-800">
              {prettyJson || '// Parsed JSON will appear here.'}
            </pre>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-gray-950 dark:text-white">Notes</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600 dark:text-zinc-300">
              <li>Pipeline-only metadata like server ID and morgue URL is not part of this client-side parse.</li>
              <li>Spell names are parsed client-side too, but browser usage skips local Crawl repo lookups.</li>
              <li>Long spell names that are already truncated in the pasted table may stay truncated here.</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}

function summarizeRings(rings: string[]): string {
  return summarizeEquipmentList(rings)
}

function summarizeEquipmentList(values: string[]): string {
  if (values.length === 0) {
    return 'none'
  }

  const counts = new Map<string, number>()

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([label, count]) => (count > 1 ? `${label} x${count}` : label))
    .join(', ')
}

function summarizeAmulet(amulet: string): string {
  return amulet
}

function StatusBadge({ result }: { result: ParseMorgueTextResult | null }) {
  if (!result) {
    return (
      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:bg-zinc-800 dark:text-zinc-400">
        Idle
      </span>
    )
  }

  if (result.ok) {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-800 uppercase dark:bg-emerald-500/15 dark:text-emerald-300">
        Success
      </span>
    )
  }

  return (
    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-rose-800 uppercase dark:bg-rose-500/15 dark:text-rose-300">
      Failure
    </span>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <dt className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-zinc-100">{value}</dd>
    </div>
  )
}
