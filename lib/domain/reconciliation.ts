// Pure reconciliation primitives. No React state, no I/O, no DOM.
// Safe to call from anywhere — Server Actions, route handlers, hooks.

import { VARIANCE_LOWER_BOUND, VARIANCE_UPPER_BOUND } from "@/lib/constants"

export interface PricedProvider<P extends string = string> {
  provider: P
  price: number
}

export interface AnalyzedProvider<P extends string = string> extends PricedProvider<P> {
  inRange: boolean
}

export interface VarianceResult<P extends string = string> {
  /** Every provider with an `inRange` flag against the Deel anchor band. */
  analyzed: AnalyzedProvider<P>[]
  /** Subset of `analyzed` where `inRange` is true. */
  candidates: AnalyzedProvider<P>[]
  /** Highest-priced in-range provider, or null when no provider is in range. */
  winner: AnalyzedProvider<P> | null
  lowerBound: number
  upperBound: number
}

/**
 * Apply the Deel-anchored variance band and pick the highest-priced in-range
 * provider. Deterministic — same inputs always produce the same winner.
 *
 * Bounds: `[deelPrice * VARIANCE_LOWER_BOUND, deelPrice * VARIANCE_UPPER_BOUND]`
 * (defaults to ±4% from `lib/constants`).
 */
export function selectVarianceWinner<P extends string>(
  prices: PricedProvider<P>[],
  deelPrice: number,
  options?: { lowerBound?: number; upperBound?: number }
): VarianceResult<P> {
  const lower = deelPrice * (options?.lowerBound ?? VARIANCE_LOWER_BOUND)
  const upper = deelPrice * (options?.upperBound ?? VARIANCE_UPPER_BOUND)

  const analyzed: AnalyzedProvider<P>[] = prices.map((p) => ({
    ...p,
    inRange: p.price >= lower && p.price <= upper,
  }))

  const candidates = analyzed.filter((p) => p.inRange)
  const winner =
    candidates.length === 0
      ? null
      : candidates.reduce((max, current) =>
          current.price > max.price ? current : max,
        )

  return { analyzed, candidates, winner, lowerBound: lower, upperBound: upper }
}
