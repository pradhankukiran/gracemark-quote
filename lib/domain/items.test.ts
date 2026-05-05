import { describe, it, expect } from 'vitest'
import {
  convertFrequencyToMonthly,
  classifyEntryName,
  dropEmployeeSideEntries,
  sumItems,
  buildAggregates,
  normalizeItems,
  canonicalizeKey,
  resolveMonthlyAmount,
  formatKeyName,
} from './items'

describe('convertFrequencyToMonthly', () => {
  it('divides yearly amounts by 12', () => {
    expect(convertFrequencyToMonthly(120, 'year')).toBeCloseTo(10, 10)
  })

  it('divides annual amounts by 12', () => {
    expect(convertFrequencyToMonthly(120, 'annual')).toBeCloseTo(10, 10)
  })

  it('divides quarterly amounts by 3', () => {
    expect(convertFrequencyToMonthly(30, 'quarter')).toBeCloseTo(10, 10)
  })

  it('divides semiannual amounts by 6', () => {
    expect(convertFrequencyToMonthly(60, 'semiannual')).toBeCloseTo(10, 10)
    expect(convertFrequencyToMonthly(120, 'semiannual')).toBeCloseTo(20, 10)
  })

  it('divides biannual amounts by 6', () => {
    expect(convertFrequencyToMonthly(60, 'biannual')).toBeCloseTo(10, 10)
    expect(convertFrequencyToMonthly(120, 'biannual')).toBeCloseTo(20, 10)
  })

  it('divides semi-annual (hyphenated) amounts by 6', () => {
    expect(convertFrequencyToMonthly(60, 'semi-annual')).toBeCloseTo(10, 10)
    expect(convertFrequencyToMonthly(120, 'semi-annual')).toBeCloseTo(20, 10)
  })

  it('expands biweekly amounts by 26/12', () => {
    expect(convertFrequencyToMonthly(100, 'biweekly')).toBeCloseTo(100 * (26 / 12), 10)
  })

  it('expands weekly amounts by 52/12', () => {
    expect(convertFrequencyToMonthly(7, 'week')).toBeCloseTo(7 * (52 / 12), 10)
  })

  it('expands daily amounts by 21.75', () => {
    expect(convertFrequencyToMonthly(10, 'day')).toBeCloseTo(217.5, 10)
  })

  it('passes one-time amounts through unchanged', () => {
    expect(convertFrequencyToMonthly(500, 'one_time')).toBe(500)
    expect(convertFrequencyToMonthly(500, 'one-time')).toBe(500)
  })

  it('passes through when frequency is missing or unknown', () => {
    expect(convertFrequencyToMonthly(99, undefined)).toBe(99)
    expect(convertFrequencyToMonthly(99, 'mystery')).toBe(99)
  })

  it('returns the input unchanged when amount is non-finite', () => {
    expect(Number.isNaN(convertFrequencyToMonthly(Number.NaN, 'year'))).toBe(true)
  })
})

describe('classifyEntryName', () => {
  it('classifies social security as statutory', () => {
    expect(classifyEntryName('Social Security Contribution')).toBe('statutory')
  })

  it('classifies base salary correctly', () => {
    expect(classifyEntryName('Base Salary')).toBe('base_salary')
    expect(classifyEntryName('Gross Pay')).toBe('base_salary')
  })

  it('classifies severance / probation as termination', () => {
    expect(classifyEntryName('Severance Provision')).toBe('termination')
    expect(classifyEntryName('Probation Reserve')).toBe('termination')
  })

  it('classifies allowance/voucher as allowance', () => {
    expect(classifyEntryName('Meal Voucher')).toBe('allowance')
    expect(classifyEntryName('Transportation Allowance')).toBe('allowance')
  })

  it('classifies onboarding/setup as one_time', () => {
    expect(classifyEntryName('Onboarding Fee')).toBe('one_time')
    expect(classifyEntryName('Setup Cost')).toBe('one_time')
  })

  it('classifies gracemark and provider fees', () => {
    expect(classifyEntryName('GraceMark Fee')).toBe('gracemark')
    expect(classifyEntryName('Provider Fee')).toBe('provider_fee')
  })

  it('falls back to "other" when nothing matches', () => {
    expect(classifyEntryName('Random Entry')).toBe('other')
  })
})

describe('dropEmployeeSideEntries', () => {
  it('removes employee-side deductions', () => {
    const items = [
      { key: 'employee_tax', name: 'Employee Tax' },
      { key: 'employer_contribution', name: 'Employer Social Security' },
      { key: 'misc', name: 'Take Home Pay' },
      { key: 'salary', name: 'Base Salary' },
    ]
    const out = dropEmployeeSideEntries(items)
    expect(out).toHaveLength(2)
    expect(out.map(i => i.key).sort()).toEqual(['employer_contribution', 'salary'])
  })

  it('returns the full list unchanged when no employee-side entries exist', () => {
    const items = [{ key: 'salary', name: 'Base Salary' }]
    expect(dropEmployeeSideEntries(items)).toHaveLength(1)
  })
})

describe('sumItems', () => {
  it('sums monthly_amount across items', () => {
    expect(
      sumItems([
        { monthly_amount: 100 },
        { monthly_amount: 200 },
      ]),
    ).toBe(300)
  })

  it('returns 0 for an empty list', () => {
    expect(sumItems([])).toBe(0)
  })

  it('handles a single item', () => {
    expect(sumItems([{ monthly_amount: 42 }])).toBe(42)
  })
})

describe('buildAggregates', () => {
  it('sums each bucket and folds onboarding into oneTimeTotal', () => {
    const out = buildAggregates({
      baseSalary: { salary: 1000 },
      statutoryMandatory: { ss: 200, tax: 50 },
      allowancesBenefits: { meal: 100 },
      terminationCosts: { sev: 80 },
      oneTimeFees: { setup: 300 },
      onboardingFees: { onb: 200 },
    })
    expect(out.baseSalaryMonthly).toBeCloseTo(1000, 10)
    expect(out.statutoryMonthly).toBeCloseTo(250, 10)
    expect(out.allowancesMonthly).toBeCloseTo(100, 10)
    expect(out.terminationMonthly).toBeCloseTo(80, 10)
    expect(out.onboardingTotal).toBeCloseTo(200, 10)
    // oneTimeTotal = oneTimeFees + onboardingFees = 300 + 200
    expect(out.oneTimeTotal).toBeCloseTo(500, 10)
  })

  it('treats undefined / empty buckets as 0', () => {
    const out = buildAggregates({
      baseSalary: {},
      statutoryMandatory: {},
      allowancesBenefits: {},
      terminationCosts: {},
      oneTimeFees: {},
      onboardingFees: {},
    })
    expect(out.baseSalaryMonthly).toBe(0)
    expect(out.statutoryMonthly).toBe(0)
    expect(out.oneTimeTotal).toBe(0)
    expect(out.onboardingTotal).toBe(0)
  })
})

describe('normalizeItems', () => {
  it('coerces a list of mixed-shape entries into NormalizedCostItems', () => {
    const out = normalizeItems([
      { key: 'base_salary', name: 'Base Salary', monthly_amount: 5000 },
      { key: 'social_security', name: 'Social Security', amount: '1,234.56' },
      { name: 'Meal Voucher', value: 200 },
    ])
    expect(out).toHaveLength(3)
    expect(out[0].key).toBe('base_salary')
    expect(out[0].name).toBe('Base Salary')
    expect(out[0].monthly_amount).toBeCloseTo(5000, 10)
    expect(out[1].key).toBe('social_security_contributions')
    expect(out[1].monthly_amount).toBeCloseTo(1234.56, 10)
    // Falls back to name as keyBase when key is missing.
    expect(out[2].key).toBe('meal_vouchers')
    expect(out[2].monthly_amount).toBe(200)
  })

  it('drops non-object entries', () => {
    expect(normalizeItems([null, undefined, 'foo' as unknown, 42 as unknown])).toEqual([])
  })

  it('returns [] for non-array inputs', () => {
    expect(normalizeItems(null as unknown as unknown[])).toEqual([])
  })

  it('preserves explicit "0" amounts', () => {
    const out = normalizeItems([{ key: 'k', name: 'Name', monthly_amount: '0' }])
    expect(out).toHaveLength(1)
    expect(out[0].monthly_amount).toBe(0)
  })
})

describe('items.canonicalizeKey (mirror of pricing.canonicalizeKey)', () => {
  it('returns social_security_contributions for Social Security entries', () => {
    expect(canonicalizeKey('social_security', 'Social Security')).toBe(
      'social_security_contributions',
    )
  })

  it('returns base_salary when name has "base salary"', () => {
    expect(canonicalizeKey('arbitrary', 'Base Salary')).toBe('base_salary')
  })
})

describe('items.resolveMonthlyAmount (mirror of pricing.resolveMonthlyAmount)', () => {
  it('parses comma-as-thousand-separator strings', () => {
    expect(resolveMonthlyAmount('25,000.00')).toBeCloseTo(25000, 10)
  })

  it('parses comma-as-decimal-separator strings', () => {
    expect(resolveMonthlyAmount('25.000,00')).toBeCloseTo(25000, 10)
  })

  it('returns 0 for empty input', () => {
    expect(resolveMonthlyAmount('')).toBe(0)
  })
})

describe('items.formatKeyName', () => {
  it('converts snake_case to Title Case', () => {
    expect(formatKeyName('thirteenth_salary')).toBe('Thirteenth Salary')
  })
})
