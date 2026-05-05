import { describe, it, expect } from 'vitest'
import {
  composeAcidTest,
  computeRecurringMonthly,
  computeProviderFeeMonthly,
} from './acidTest'

describe('computeRecurringMonthly', () => {
  it('sums salary + statutory + allowances and adds termination when all-inclusive', () => {
    const total = computeRecurringMonthly({
      baseSalaryMonthly: 1000,
      statutoryMonthly: 200,
      allowancesMonthly: 100,
      terminationMonthly: 80,
      isAllInclusive: true,
    })
    expect(total).toBeCloseTo(1380, 10)
  })

  it('excludes termination when isAllInclusive is false', () => {
    const total = computeRecurringMonthly({
      baseSalaryMonthly: 1000,
      statutoryMonthly: 200,
      allowancesMonthly: 100,
      terminationMonthly: 80,
      isAllInclusive: false,
    })
    expect(total).toBeCloseTo(1300, 10)
  })
})

describe('computeProviderFeeMonthly', () => {
  it('returns 30% of the gracemark fee when positive', () => {
    expect(computeProviderFeeMonthly(620)).toBeCloseTo(186, 10)
  })

  it('clamps negative gracemark fees to 0', () => {
    expect(computeProviderFeeMonthly(-100)).toBe(0)
  })

  it('returns 0 for a 0 gracemark fee', () => {
    expect(computeProviderFeeMonthly(0)).toBe(0)
  })
})

describe('composeAcidTest', () => {
  // Common worked example used by the assertions below.
  const baseInput = {
    baseSalaryMonthly: 1000,
    statutoryMonthly: 200,
    allowancesMonthly: 100,
    terminationMonthly: 80,
    onboardingTotal: 300,
    oneTimeTotal: 500,
    billRate: 2000,
    duration: 12,
    isAllInclusive: true,
    feePercentage: 0.45,
  }

  it('all-inclusive worked example: breakdown / summary numbers match hand-calculated truth', () => {
    const out = composeAcidTest(baseInput)
    // Breakdown
    expect(out.breakdown.salaryTotal).toBeCloseTo(12000, 10)
    expect(out.breakdown.statutoryTotal).toBeCloseTo(2400, 10)
    expect(out.breakdown.allowancesTotal).toBeCloseTo(1200, 10)
    expect(out.breakdown.terminationTotal).toBeCloseTo(960, 10)
    expect(out.breakdown.recurringMonthly).toBeCloseTo(1380, 10)
    expect(out.breakdown.recurringTotal).toBeCloseTo(16560, 10)
    expect(out.breakdown.oneTimeTotal).toBe(500)
    expect(out.breakdown.onboardingTotal).toBe(300)

    // Summary
    expect(out.summary.totalCost).toBeCloseTo(17060, 10)
    expect(out.summary.revenueTotal).toBeCloseTo(24300, 10)
    expect(out.summary.profitLocal).toBeCloseTo(7240, 10)
    expect(out.summary.marginMonthly).toBeCloseTo(620, 10)
    expect(out.summary.marginTotal).toBeCloseTo(7240, 10)
    expect(out.summary.meetsPositive).toBe(true)
    expect(out.summary.billRateMonthly).toBe(2000)
    expect(out.summary.durationMonths).toBe(12)

    // Bill-rate composition
    expect(out.billRateComposition.gracemarkFeeMonthly).toBeCloseTo(620, 10)
    expect(out.billRateComposition.providerFeeMonthly).toBeCloseTo(186, 10)
    expect(out.billRateComposition.targetGracemarkFeeMonthly).toBeCloseTo(621, 10)
    expect(out.billRateComposition.expectedBillRate).toBeCloseTo(2001, 10)
    expect(out.billRateComposition.rateDiscrepancy).toBeCloseTo(-1, 10)
    expect(out.billRateComposition.targetGracemarkFeePercentage).toBeCloseTo(0.45, 10)
    expect(out.billRateComposition.actualBillRate).toBe(2000)
    expect(out.billRateComposition.terminationMonthly).toBe(80)

    // Misc
    expect(out.nonPassThroughOneTimeLocal).toBeCloseTo(200, 10)
    expect(out.appliedFeePercentage).toBe(0.45)
  })

  it('terminationTotal is 0 and termination excluded from recurringMonthly when isAllInclusive is false', () => {
    const out = composeAcidTest({ ...baseInput, isAllInclusive: false })
    expect(out.breakdown.terminationTotal).toBe(0)
    expect(out.breakdown.recurringMonthly).toBeCloseTo(1300, 10)
    expect(out.breakdown.recurringTotal).toBeCloseTo(1300 * 12, 10)
    expect(out.billRateComposition.terminationMonthly).toBe(0)
  })

  it('appliedFeePercentage falls back to GRACEMARK_FEE_PERCENTAGE (0.45) when feePercentage is undefined', () => {
    const out = composeAcidTest({ ...baseInput, feePercentage: undefined })
    expect(out.appliedFeePercentage).toBe(0.45)
    expect(out.billRateComposition.targetGracemarkFeePercentage).toBe(0.45)
  })

  it('appliedFeePercentage falls back to GRACEMARK_FEE_PERCENTAGE when feePercentage is NaN', () => {
    const out = composeAcidTest({ ...baseInput, feePercentage: Number.NaN })
    expect(out.appliedFeePercentage).toBe(0.45)
  })

  it('respects an explicit feePercentage override', () => {
    const out = composeAcidTest({ ...baseInput, feePercentage: 0.5 })
    expect(out.appliedFeePercentage).toBe(0.5)
    expect(out.billRateComposition.targetGracemarkFeeMonthly).toBeCloseTo(1380 * 0.5, 10)
  })

  it('reports meetsPositive=false when revenue does not cover costs', () => {
    // Tiny billRate ensures revenueTotal < totalCost.
    const out = composeAcidTest({ ...baseInput, billRate: 100 })
    expect(out.summary.profitLocal).toBeLessThan(0)
    expect(out.summary.meetsPositive).toBe(false)
  })

  it('clamps providerFeeMonthly to 0 when bill rate is below recurring cost', () => {
    const out = composeAcidTest({ ...baseInput, billRate: 1000 })
    // gracemarkFeeMonthly = 1000 - 1380 = -380, so providerFee clamps to 0
    expect(out.billRateComposition.gracemarkFeeMonthly).toBeCloseTo(-380, 10)
    expect(out.billRateComposition.providerFeeMonthly).toBe(0)
  })

  it('nonPassThroughOneTimeLocal is 0 when oneTimeTotal <= onboardingTotal', () => {
    const out = composeAcidTest({ ...baseInput, oneTimeTotal: 300 })
    expect(out.nonPassThroughOneTimeLocal).toBe(0)
  })
})
