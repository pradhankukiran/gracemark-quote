import { describe, it, expect } from 'vitest'
import {
  roundToCents,
  resolveMonthlyAmount,
  formatPercentageInput,
  extractConvertedAmount,
  canonicalizeKey,
  formatKeyName,
  shouldDropEmployeeEntry,
  filterAllowancesByContractType,
  sanitizeLocalOfficeAmount,
  normalizeCountryIdentifier,
  findLocalOfficeCountryCodeInObject,
  readNumericValue,
  readOptionalNumericValue,
  resolveMonthlyValue,
  normalizeAllowanceLabel,
} from './pricing'

describe('roundToCents', () => {
  it('rounds to 2 decimal places via Math.round', () => {
    expect(roundToCents(1.236)).toBe(1.24)
    expect(roundToCents(1.234)).toBe(1.23)
  })

  it('returns 0 for 0 input', () => {
    expect(roundToCents(0)).toBe(0)
  })

  it('rounds negative values toward zero per Math.round semantics', () => {
    // Math.round(-1.235 * 100) -> Math.round(-123.5) -> -123 (rounds toward +∞ on .5)
    // Use values that don't hit .5 to keep this deterministic across platforms.
    expect(roundToCents(-1.236)).toBe(-1.24)
  })
})

describe('readNumericValue', () => {
  it('returns the value when finite number, fallback otherwise', () => {
    expect(readNumericValue(42)).toBe(42)
    expect(readNumericValue('42')).toBe(0)
    expect(readNumericValue(NaN)).toBe(0)
    expect(readNumericValue(undefined, 7)).toBe(7)
  })
})

describe('readOptionalNumericValue', () => {
  it('returns null for non-finite or non-number input', () => {
    expect(readOptionalNumericValue(42)).toBe(42)
    expect(readOptionalNumericValue('42')).toBeNull()
    expect(readOptionalNumericValue(NaN)).toBeNull()
    expect(readOptionalNumericValue(undefined)).toBeNull()
  })
})

describe('resolveMonthlyAmount', () => {
  it('returns finite numbers unchanged', () => {
    expect(resolveMonthlyAmount(1234.56)).toBe(1234.56)
  })

  it('parses comma-as-thousand-separator strings (e.g. R$ 25,000.00)', () => {
    expect(resolveMonthlyAmount('R$ 25,000.00')).toBeCloseTo(25000, 10)
  })

  it('parses European comma-as-decimal strings (e.g. R$ 25.000,00)', () => {
    expect(resolveMonthlyAmount('R$ 25.000,00')).toBeCloseTo(25000, 10)
  })

  it('returns 0 for empty/sanitized-to-empty strings', () => {
    expect(resolveMonthlyAmount('')).toBe(0)
    expect(resolveMonthlyAmount('  ')).toBe(0)
    expect(resolveMonthlyAmount('R$ ')).toBe(0)
  })

  it('returns 0 for undefined / null / non-finite', () => {
    expect(resolveMonthlyAmount(undefined)).toBe(0)
    expect(resolveMonthlyAmount(null)).toBe(0)
    expect(resolveMonthlyAmount(NaN)).toBe(0)
  })

  it('coerces bigint to number', () => {
    expect(resolveMonthlyAmount(BigInt(42))).toBe(42)
  })
})

describe('resolveMonthlyValue', () => {
  it('picks the first non-zero finite numeric candidate', () => {
    expect(resolveMonthlyValue(undefined, null, 0, 5)).toBe(5)
  })

  it('parses string candidates via parseNumericValue', () => {
    expect(resolveMonthlyValue('', '1,234.56')).toBeCloseTo(1234.56, 10)
  })

  it('returns 0 when no candidates qualify', () => {
    expect(resolveMonthlyValue(undefined, null, 0)).toBe(0)
  })
})

describe('formatPercentageInput', () => {
  it('formats whole-number ratios without decimal', () => {
    expect(formatPercentageInput(0.45)).toBe('45')
    expect(formatPercentageInput(1)).toBe('100')
  })

  it('formats decimal ratios with up to 2 decimals, trimming trailing zeros', () => {
    // 0.123 -> 12.30 (toFixed(2)) -> trims to "12.3"
    expect(formatPercentageInput(0.123)).toBe('12.3')
    // 0.4567 -> 45.67
    expect(formatPercentageInput(0.4567)).toBe('45.67')
  })

  it('returns empty string for non-finite input', () => {
    expect(formatPercentageInput(Number.NaN)).toBe('')
    expect(formatPercentageInput(Infinity)).toBe('')
  })
})

describe('extractConvertedAmount', () => {
  it('returns target_amount when conversion succeeds', () => {
    expect(
      extractConvertedAmount({
        success: true,
        data: {
          exchange_rate: '1',
          source_currency: { code: 'USD', name: 'US Dollar', symbol: '$' },
          target_currency: { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
          source_amount: 100,
          target_amount: 525.5,
        },
      }),
    ).toBe(525.5)
  })

  it('returns undefined when conversion failed or missing', () => {
    expect(extractConvertedAmount(null)).toBeUndefined()
    expect(extractConvertedAmount(undefined)).toBeUndefined()
    expect(extractConvertedAmount({ success: false })).toBeUndefined()
  })
})

describe('canonicalizeKey', () => {
  it('maps Social Security to social_security_contributions', () => {
    expect(canonicalizeKey('social_security', 'Social Security')).toBe(
      'social_security_contributions',
    )
  })

  it('detects base_salary from name OR key', () => {
    expect(canonicalizeKey('arbitrary', 'Base Salary')).toBe('base_salary')
    expect(canonicalizeKey('base_salary', 'Whatever')).toBe('base_salary')
  })

  it('falls through to the normalized key when nothing matches', () => {
    expect(canonicalizeKey('My Random Field', 'Misc Cost')).toBe('my_random_field')
  })

  it('maps transportation allowance to transportation_allowance', () => {
    expect(canonicalizeKey('transport', 'Transportation Allowance')).toBe(
      'transportation_allowance',
    )
  })
})

describe('formatKeyName', () => {
  it('converts snake_case to Title Case', () => {
    expect(formatKeyName('social_security_contributions')).toBe(
      'Social Security Contributions',
    )
  })

  it('converts camelCase to Title Case', () => {
    expect(formatKeyName('thirteenthSalary')).toBe('Thirteenth Salary')
  })

  it('handles mixed inputs', () => {
    expect(formatKeyName('base_salaryMonthly')).toBe('Base Salary Monthly')
  })
})

describe('shouldDropEmployeeEntry', () => {
  it('returns true for employee_tax key', () => {
    expect(shouldDropEmployeeEntry({ key: 'employee_tax', name: 'Anything' })).toBe(true)
  })

  it('returns true for income tax in name', () => {
    expect(shouldDropEmployeeEntry({ key: 'irrelevant', name: 'Income Tax' })).toBe(true)
  })

  it('returns false for benign employer-side entries', () => {
    expect(
      shouldDropEmployeeEntry({ key: 'employer_contribution', name: 'Employer Contribution' }),
    ).toBe(false)
  })

  it('returns true for take home / net pay phrasing', () => {
    expect(shouldDropEmployeeEntry({ key: 'misc', name: 'Take Home Pay' })).toBe(true)
    expect(shouldDropEmployeeEntry({ key: 'misc', name: 'Net Salary' })).toBe(true)
  })
})

describe('filterAllowancesByContractType', () => {
  it('removes transportation when contractType is remote', () => {
    const items = [
      { name: 'Transportation Allowance' },
      { name: 'Meal Voucher' },
    ]
    const out = filterAllowancesByContractType(items, 'remote')
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('Meal Voucher')
  })

  it('removes remote/WFH when contractType is on-site', () => {
    const items = [
      { name: 'Remote Work Allowance' },
      { name: 'Meal Voucher' },
    ]
    const out = filterAllowancesByContractType(items, 'on-site')
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('Meal Voucher')
  })

  it('returns the same reference when nothing is filtered (hybrid contract)', () => {
    const items = [{ name: 'Transportation Allowance' }, { name: 'Remote Work' }]
    expect(filterAllowancesByContractType(items, 'hybrid')).toBe(items)
  })

  it('returns the same reference when contractType is missing', () => {
    const items = [{ name: 'Transportation Allowance' }]
    expect(filterAllowancesByContractType(items, undefined)).toBe(items)
  })

  it('handles empty or non-array inputs gracefully', () => {
    expect(filterAllowancesByContractType([], 'remote')).toEqual([])
  })
})

describe('sanitizeLocalOfficeAmount', () => {
  it('returns 0 for missing / N/A / No / none values', () => {
    expect(sanitizeLocalOfficeAmount(undefined)).toBe(0)
    expect(sanitizeLocalOfficeAmount('')).toBe(0)
    expect(sanitizeLocalOfficeAmount('N/A')).toBe(0)
    expect(sanitizeLocalOfficeAmount('No')).toBe(0)
    expect(sanitizeLocalOfficeAmount('none')).toBe(0)
  })

  it('parses positive numeric strings', () => {
    expect(sanitizeLocalOfficeAmount('150.50')).toBeCloseTo(150.5, 10)
  })

  it('returns 0 for non-positive parsed values', () => {
    expect(sanitizeLocalOfficeAmount('-50')).toBe(0)
    expect(sanitizeLocalOfficeAmount('0')).toBe(0)
  })
})

describe('normalizeCountryIdentifier', () => {
  it('returns the same code when already a known ISO2', () => {
    expect(normalizeCountryIdentifier('CO')).toBe('CO')
    expect(normalizeCountryIdentifier('br')).toBe('BR')
  })

  it('maps known ISO3 codes', () => {
    expect(normalizeCountryIdentifier('COL')).toBe('CO')
    expect(normalizeCountryIdentifier('BRA')).toBe('BR')
    expect(normalizeCountryIdentifier('MEX')).toBe('MX')
  })

  it('maps full country names', () => {
    expect(normalizeCountryIdentifier('Colombia')).toBe('CO')
    expect(normalizeCountryIdentifier('brazil')).toBe('BR')
    expect(normalizeCountryIdentifier('Brasil')).toBe('BR')
  })

  it('returns null when no mapping is known', () => {
    expect(normalizeCountryIdentifier('XYZ')).toBeNull()
    expect(normalizeCountryIdentifier(undefined)).toBeNull()
    expect(normalizeCountryIdentifier('')).toBeNull()
  })
})

describe('findLocalOfficeCountryCodeInObject', () => {
  it('returns the code when found in a flat object via candidate key', () => {
    expect(findLocalOfficeCountryCodeInObject({ country: 'Colombia' })).toBe('CO')
    expect(findLocalOfficeCountryCodeInObject({ countryCode: 'BR' })).toBe('BR')
  })

  it('walks nested arrays and objects', () => {
    expect(findLocalOfficeCountryCodeInObject({ data: [{ country: 'Mexico' }] })).toBe('MX')
  })

  it('returns null when no identifier exists', () => {
    expect(findLocalOfficeCountryCodeInObject({ foo: 'bar' })).toBeNull()
    expect(findLocalOfficeCountryCodeInObject(null)).toBeNull()
  })
})

describe('normalizeAllowanceLabel', () => {
  it('strips non-alphanumerics and lowercases', () => {
    expect(normalizeAllowanceLabel('Meal Voucher!!!')).toBe('meal voucher')
    expect(normalizeAllowanceLabel('  Transport_Allowance  ')).toBe('transport allowance')
  })

  it('returns empty string for falsy input', () => {
    expect(normalizeAllowanceLabel('')).toBe('')
  })
})
