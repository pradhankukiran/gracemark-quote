// Pure Acid Test compose kernel. Produces breakdown + summary numbers in
// local currency from already-resolved monthly inputs. No FX, no I/O, no
// React, no rounding — caller (page.tsx today, a Server Action tomorrow)
// resolves currencies, runs Promise.all on convertCurrency, and stitches
// USD fields into the final result.
//
// Mirrors `buildAcidTestCalculation` in `app/quote/page.tsx` — the local
// branch only. The async USD branch stays in the wrapper.

import {
  GRACEMARK_FEE_PERCENTAGE,
  PROVIDER_FEE_RATIO,
} from "@/lib/constants"

export interface AcidTestComposeInput {
  /** Already-resolved monthly base salary in the local currency. */
  baseSalaryMonthly: number
  /** Already-resolved monthly statutory cost in the local currency. */
  statutoryMonthly: number
  /** Already-resolved monthly allowances in the local currency. */
  allowancesMonthly: number
  /** Already-resolved monthly termination accrual in the local currency. */
  terminationMonthly: number
  /** Total onboarding cost in the local currency (one-time, pass-through). */
  onboardingTotal: number
  /** Total of all one-time costs in the local currency (includes onboarding). */
  oneTimeTotal: number
  /** Monthly bill rate in the local currency. */
  billRate: number
  /** Contract duration in months. */
  duration: number
  /** When true, termination accrual is included in recurring monthly cost. */
  isAllInclusive: boolean
  /** GraceMark target fee as a fraction (e.g. 0.45). Falls back to GRACEMARK_FEE_PERCENTAGE if non-finite. */
  feePercentage?: number
}

export interface AcidTestComposeBreakdown {
  salaryTotal: number
  statutoryTotal: number
  allowancesTotal: number
  /** Zero when `isAllInclusive` is false. */
  terminationTotal: number
  oneTimeTotal: number
  onboardingTotal: number
  recurringMonthly: number
  recurringTotal: number
}

export interface AcidTestComposeBillRateComposition {
  salaryMonthly: number
  statutoryMonthly: number
  /** Zero when `isAllInclusive` is false. */
  terminationMonthly: number
  allowancesMonthly: number
  /** Actual GraceMark fee derived from `billRate - recurringMonthly`. */
  gracemarkFeeMonthly: number
  providerFeeMonthly: number
  /** `recurringMonthly + targetGracemarkFeeMonthly`. */
  expectedBillRate: number
  /** Echoes the input `billRate`. */
  actualBillRate: number
  /** `billRate - expectedBillRate`. */
  rateDiscrepancy: number
  /** Actual fee as a fraction of recurringMonthly (0 when recurringMonthly is 0). */
  gracemarkFeePercentage: number
  targetGracemarkFeeMonthly: number
  /** The applied target fee fraction (after the GRACEMARK_FEE_PERCENTAGE fallback). */
  targetGracemarkFeePercentage: number
}

export interface AcidTestComposeSummary {
  billRateMonthly: number
  durationMonths: number
  /** `billRate * duration + onboardingTotal`. */
  revenueTotal: number
  /** `recurringTotal + oneTimeTotal`. */
  totalCost: number
  /** `revenueTotal - totalCost`, in local currency. */
  profitLocal: number
  /** Monthly margin (== `gracemarkFeeMonthly`). */
  marginMonthly: number
  /** `marginMonthly * duration - nonPassThroughOneTimeLocal`. */
  marginTotal: number
  /** `profitLocal > 0`. The USD minimum check is layered on by the wrapper. */
  meetsPositive: boolean
}

export interface AcidTestComposeOutput {
  breakdown: AcidTestComposeBreakdown
  billRateComposition: AcidTestComposeBillRateComposition
  summary: AcidTestComposeSummary
  /** `max(0, oneTimeTotal - onboardingTotal)`. Exposed so the wrapper can reuse it for the USD margin. */
  nonPassThroughOneTimeLocal: number
  /** The fee fraction that was actually applied (after the non-finite fallback). */
  appliedFeePercentage: number
}

/**
 * Compute the Acid Test breakdown / bill-rate composition / summary from
 * already-resolved local-currency monthly inputs. Pure and deterministic.
 *
 * The caller is responsible for FX-converting the relevant fields to USD
 * and for layering the `MIN_PROFIT_THRESHOLD_USD` minimum check on top —
 * those concerns are intentionally outside the kernel.
 */
export function composeAcidTest(input: AcidTestComposeInput): AcidTestComposeOutput {
  const {
    baseSalaryMonthly,
    statutoryMonthly,
    allowancesMonthly,
    terminationMonthly,
    onboardingTotal,
    oneTimeTotal,
    billRate,
    duration,
    isAllInclusive,
    feePercentage,
  } = input

  // Component totals for full assignment (breakdown display).
  const salaryTotal = baseSalaryMonthly * duration
  const statutoryTotal = statutoryMonthly * duration
  const allowancesTotal = allowancesMonthly * duration
  // Only include termination cost when the quote is all-inclusive.
  const terminationTotal = isAllInclusive ? terminationMonthly * duration : 0
  const nonPassThroughOneTimeLocal = Math.max(0, oneTimeTotal - onboardingTotal)

  // Recurring monthly cost from categorized components.
  const recurringMonthly = computeRecurringMonthly({
    baseSalaryMonthly,
    statutoryMonthly,
    allowancesMonthly,
    terminationMonthly,
    isAllInclusive,
  })

  // Target Gracemark fee (policy) and expected bill rate.
  const appliedFeePercentage = Number.isFinite(feePercentage)
    ? (feePercentage as number)
    : GRACEMARK_FEE_PERCENTAGE
  const targetGracemarkFeeMonthly = recurringMonthly * appliedFeePercentage
  const expectedBillRateMonthly = recurringMonthly + targetGracemarkFeeMonthly

  // Actual Gracemark fee based on the current bill rate.
  const actualGracemarkFeeMonthly = billRate - recurringMonthly
  const actualGracemarkFeePercentage =
    recurringMonthly !== 0 ? actualGracemarkFeeMonthly / recurringMonthly : 0

  // Provider fee share — never negative.
  const providerFeeMonthly = computeProviderFeeMonthly(actualGracemarkFeeMonthly)

  // Cash-flow totals.
  const recurringTotal = recurringMonthly * duration
  const totalCostsGracemark = recurringTotal + oneTimeTotal
  const actualRevenueTotal = billRate * duration + onboardingTotal
  const rateDiscrepancy = billRate - expectedBillRateMonthly
  const profitLocal = actualRevenueTotal - totalCostsGracemark

  const marginMonthly = actualGracemarkFeeMonthly
  const marginTotal = marginMonthly * duration - nonPassThroughOneTimeLocal

  const meetsPositive = profitLocal > 0

  return {
    breakdown: Object.freeze({
      salaryTotal,
      statutoryTotal,
      allowancesTotal,
      terminationTotal,
      oneTimeTotal,
      onboardingTotal,
      recurringMonthly,
      recurringTotal,
    }),
    billRateComposition: Object.freeze({
      salaryMonthly: baseSalaryMonthly,
      statutoryMonthly,
      terminationMonthly: isAllInclusive ? terminationMonthly : 0,
      allowancesMonthly,
      gracemarkFeeMonthly: actualGracemarkFeeMonthly,
      providerFeeMonthly,
      expectedBillRate: expectedBillRateMonthly,
      actualBillRate: billRate,
      rateDiscrepancy,
      gracemarkFeePercentage: actualGracemarkFeePercentage,
      targetGracemarkFeeMonthly,
      targetGracemarkFeePercentage: appliedFeePercentage,
    }),
    summary: Object.freeze({
      billRateMonthly: billRate,
      durationMonths: duration,
      revenueTotal: actualRevenueTotal,
      totalCost: totalCostsGracemark,
      profitLocal,
      marginMonthly,
      marginTotal,
      meetsPositive,
    }),
    nonPassThroughOneTimeLocal,
    appliedFeePercentage,
  }
}

/**
 * Recurring monthly cost = base salary + statutory + allowances, plus
 * termination accrual when the quote is all-inclusive.
 */
export function computeRecurringMonthly(input: {
  baseSalaryMonthly: number
  statutoryMonthly: number
  allowancesMonthly: number
  terminationMonthly: number
  isAllInclusive: boolean
}): number {
  return (
    input.baseSalaryMonthly +
    input.statutoryMonthly +
    input.allowancesMonthly +
    (input.isAllInclusive ? input.terminationMonthly : 0)
  )
}

/**
 * Provider fee = `PROVIDER_FEE_RATIO * max(actualGracemarkFeeMonthly, 0)`.
 * Negative GraceMark fees (bill rate below recurring cost) clamp to 0.
 */
export function computeProviderFeeMonthly(actualGracemarkFeeMonthly: number): number {
  return Math.max(actualGracemarkFeeMonthly, 0) * PROVIDER_FEE_RATIO
}
