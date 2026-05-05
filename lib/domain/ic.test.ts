import { describe, it, expect } from 'vitest'
import { composeICQuote } from './ic'

describe('composeICQuote', () => {
  it('computes hourly quote with 40% markup, MSP=0, no extra fees', () => {
    const out = composeICQuote({
      rateAmount: 50,
      rateBasis: 'hourly',
      workedHours: 160,
      markupPercentage: 40,
      mspPercentage: 0,
      transactionCost: 0,
      backgroundCheckMonthlyFee: 0,
    })
    // payRate stays at 50, agencyFee = 20, billRate = 70
    expect(out.payRate).toBeCloseTo(50, 10)
    expect(out.agencyFee).toBeCloseTo(20, 10)
    expect(out.billRate).toBeCloseTo(70, 10)
    // Monthly multiples (× 160)
    expect(out.monthlyPayRate).toBeCloseTo(8000, 10)
    expect(out.monthlyAgencyFee).toBeCloseTo(3200, 10)
    expect(out.monthlyBillRate).toBeCloseTo(11200, 10)
    expect(out.mspFee).toBeCloseTo(0, 10)
    expect(out.totalMonthlyCosts).toBeCloseTo(8000, 10)
    expect(out.monthlyMarkup).toBeCloseTo(3200, 10)
  })

  it('divides monthly rate by workedHours when rateBasis is monthly', () => {
    const out = composeICQuote({
      rateAmount: 8000,
      rateBasis: 'monthly',
      workedHours: 160,
      markupPercentage: 40,
      mspPercentage: 0,
      transactionCost: 0,
      backgroundCheckMonthlyFee: 0,
    })
    // 8000/160 = 50/hr, identical to the hourly test above.
    expect(out.payRate).toBeCloseTo(50, 10)
    expect(out.billRate).toBeCloseTo(70, 10)
    expect(out.monthlyPayRate).toBeCloseTo(8000, 10)
    expect(out.monthlyBillRate).toBeCloseTo(11200, 10)
  })

  it('falls back to DEFAULT_IC_MARKUP (0.40) when markupPercentage is 0', () => {
    const out = composeICQuote({
      rateAmount: 100,
      rateBasis: 'hourly',
      workedHours: 160,
      markupPercentage: 0,
      mspPercentage: 0,
      transactionCost: 0,
      backgroundCheckMonthlyFee: 0,
    })
    // 0 is not > 0 so falls through to DEFAULT_IC_MARKUP (0.40)
    expect(out.agencyFee).toBeCloseTo(40, 10)
    expect(out.billRate).toBeCloseTo(140, 10)
  })

  it('falls back to DEFAULT_IC_MARKUP when markupPercentage is undefined', () => {
    const out = composeICQuote({
      rateAmount: 100,
      rateBasis: 'hourly',
      workedHours: 160,
      transactionCost: 0,
      backgroundCheckMonthlyFee: 0,
    })
    expect(out.agencyFee).toBeCloseTo(40, 10)
  })

  it('falls back to DEFAULT_IC_MARKUP when markupPercentage is NaN', () => {
    const out = composeICQuote({
      rateAmount: 100,
      rateBasis: 'hourly',
      workedHours: 160,
      markupPercentage: Number.NaN,
      mspPercentage: 0,
      transactionCost: 0,
      backgroundCheckMonthlyFee: 0,
    })
    expect(out.agencyFee).toBeCloseTo(40, 10)
    expect(out.billRate).toBeCloseTo(140, 10)
  })

  it('falls back to DEFAULT_IC_MARKUP when markupPercentage is negative', () => {
    const out = composeICQuote({
      rateAmount: 100,
      rateBasis: 'hourly',
      workedHours: 160,
      markupPercentage: -25,
      mspPercentage: 0,
      transactionCost: 0,
      backgroundCheckMonthlyFee: 0,
    })
    expect(out.agencyFee).toBeCloseTo(40, 10)
  })

  it('applies MSP fee when mspPercentage is positive', () => {
    const out = composeICQuote({
      rateAmount: 50,
      rateBasis: 'hourly',
      workedHours: 160,
      markupPercentage: 40,
      mspPercentage: 5, // 5% of bill rate
      transactionCost: 0,
      backgroundCheckMonthlyFee: 0,
    })
    // billRate=70, mspFeeHourly = 70 * 0.05 = 3.5, mspFee = 3.5 * 160 = 560
    expect(out.mspFee).toBeCloseTo(560, 10)
    // totalMonthlyCosts = 8000 + 0 + 0 + 560 = 8560
    expect(out.totalMonthlyCosts).toBeCloseTo(8560, 10)
    expect(out.monthlyMarkup).toBeCloseTo(11200 - 8560, 10)
  })

  it('includes transactionCost and backgroundCheckMonthlyFee in totalMonthlyCosts', () => {
    const out = composeICQuote({
      rateAmount: 50,
      rateBasis: 'hourly',
      workedHours: 160,
      markupPercentage: 40,
      mspPercentage: 0,
      transactionCost: 25,
      backgroundCheckMonthlyFee: 10,
    })
    expect(out.totalMonthlyCosts).toBeCloseTo(8000 + 25 + 10, 10)
    expect(out.monthlyMarkup).toBeCloseTo(11200 - 8035, 10)
  })
})
