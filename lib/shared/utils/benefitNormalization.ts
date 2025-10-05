import type { QuoteCost } from "@/lib/shared/types"
import type { StandardizedBenefitData } from "@/lib/types/enhancement"

export type BenefitKey = keyof StandardizedBenefitData['includedBenefits']

const YEARLY_BENEFIT_KEYS: ReadonlySet<BenefitKey> = new Set([
  'thirteenthSalary',
  'fourteenthSalary',
  'vacationBonus'
])

const normalizeForMatching = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const addMatchingCandidates = (source: string): string[] => {
  const trimmed = source.trim()
  if (!trimmed) return []

  const candidates = new Set<string>([
    trimmed,
    trimmed.toLowerCase(),
    trimmed.replace(/([a-z])([A-Z])/g, '$1 $2')
  ])

  Array.from(candidates).forEach(candidate => {
    const normalized = normalizeForMatching(candidate)
    if (normalized) {
      candidates.add(normalized)
      candidates.add(normalized.toLowerCase())
    }
  })

  return Array.from(candidates)
}

const BENEFIT_SYNONYMS: Array<{ key: BenefitKey; phrases: string[] }> = [
  {
    key: 'thirteenthSalary',
    phrases: [
      'christmas bonus',
      'christmas salary',
      'year end bonus',
      '13 month pay',
      '13 month salary',
      '13th salary',
      '13th month',
      'annual bonus'
    ]
  },
  {
    key: 'vacationBonus',
    phrases: [
      'annual leave bonus',
      'vacation allowance',
      'holiday allowance'
    ]
  },
  {
    key: 'severanceProvision',
    phrases: [
      'severance accrual',
      'severance accruals',
      'severance reserve',
      'severance provision',
      'termination reserve',
      'termination provision',
      'redundancy reserve',
      'redundancy provision',
      'end of service',
      'eos accrual',
      'eos provision',
      'gratuity'
    ]
  },
  {
    key: 'probationProvision',
    phrases: [
      'probation reserve',
      'probation provision',
      'probation accrual'
    ]
  }
]

const BENEFIT_PATTERNS: Array<{ key: BenefitKey; regex: RegExp }> = [
  {
    key: 'thirteenthSalary',
    regex: /(?:^|\b)(?:13(?:th)?(?:\s*month)?|13º|13o|thirteenth|trece[a-z]*|d[ée]cim[ao]\s*terc|aguinaldos?|christmas(?:[-\s]*(?:bonus|pay|salary))?|year[-\s]*end\s*(?:bonus|pay)|bonus\s*de\s*natal|gratific[aã]?[cç][aã]o\s*de\s*natal|sueldo\s*anual)/i
  },
  {
    key: 'fourteenthSalary',
    regex: /(?:^|\b)(?:14(?:th)?(?:\s*month)?|14º|14o|fourteenth|d[ée]cim[ao]\s*quart|decim[ao]\s*cuart)/i
  },
  {
    key: 'vacationBonus',
    regex: /(vacation|holiday|annual\s*leave)\s*(bonus|allowance|pay)/i
  },
  {
    key: 'transportationAllowance',
    regex: /(transport|commut|bus|metro|transit|car\s*allowance|auto\s*allowance|vehicle|travel\s*allowance|gas\s*allowance|fuel|vale\s*transport)/i
  },
  {
    key: 'remoteWorkAllowance',
    regex: /(remote|work\s*from\s*home|wfh|telework|home\s*office|telecommut|distance\s*work|home.*allowance|office.*allowance)/i
  },
  {
    key: 'mealVouchers',
    regex: /(meal|food|voucher|ticket\s*restaurant|lunch|dining|cafeteria|vale\s*refei[cç][aã]o|vale\s*aliment|restaurant\s*card|food\s*card)/i
  },
  {
    key: 'socialSecurity',
    regex: /(social\s*security|social\s*insur|employer\s*contrib|pension|\bni\b|inps|ssf|contrib.*social|fica|ssi|unemployment\s*insur|disability\s*insur|workers.*comp|\bfgts\b|indemnity\s*fund|severance\s*indemnity)/i
  },
  {
    key: 'healthInsurance',
    regex: /(health\s*insur|medical\s*insur|\bhi\b|health.*care|medical.*care|dental|vision|life\s*insur|disability.*insur)/i
  },
  {
    key: 'severanceProvision',
    regex: /(severance|termination|redundancy|indemnity|gratuity|separation)\s*(?:provisions?|accruals?|costs?|payments?|pay|funds?|reserves?|liabilit(?:y|ies)|obligations?|packages?|charges?|estimates?|benefits?|allowances?)/i
  },
  {
    key: 'probationProvision',
    regex: /(probation)\s*(?:provisions?|accruals?|costs?|payments?|pay|termination|obligations?)/i
  }
]

const YEARLY_NAME_PATTERNS: RegExp[] = [
  BENEFIT_PATTERNS[0].regex,
  BENEFIT_PATTERNS[1].regex,
  BENEFIT_PATTERNS[2].regex
]

const sanitizeKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const parseAmount = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9,\.\-]/g, '').replace(/,(?=\d{3}(?:\D|$))/g, '').replace(',', '.')
    const parsed = Number.parseFloat(cleaned)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export const identifyBenefitKey = (name: string | undefined | null): BenefitKey | undefined => {
  if (!name) return undefined
  const candidates = addMatchingCandidates(name)
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeForMatching(candidate)
    const compactCandidate = normalizedCandidate.replace(/\s+/g, '')

    for (const { key, regex } of BENEFIT_PATTERNS) {
      if (regex.test(candidate) || regex.test(normalizedCandidate)) return key
    }

    for (const { key, phrases } of BENEFIT_SYNONYMS) {
      if (phrases.some(phrase => {
        const normalizedPhrase = normalizeForMatching(phrase)
        const compactPhrase = normalizedPhrase.replace(/\s+/g, '')
        return normalizedCandidate.includes(normalizedPhrase) || compactCandidate.includes(compactPhrase)
      })) {
        return key
      }
    }
  }
  return undefined
}

export const normalizeBenefitAmount = (
  amount: number,
  opts: { benefitKey?: BenefitKey; rawName?: string; frequency?: string; referenceMonthly?: number } = {}
): number => {
  if (!Number.isFinite(amount) || amount <= 0) return 0

  const name = (opts.rawName || '').toString()
  const frequency = (opts.frequency || '').toLowerCase()
  const referenceMonthly = Number(opts.referenceMonthly) || 0

  const isYearlyByKey = opts.benefitKey ? YEARLY_BENEFIT_KEYS.has(opts.benefitKey) : false
  const isYearlyByName = name ? YEARLY_NAME_PATTERNS.some(pattern => pattern.test(name)) : false
  const isYearlyByFrequency = frequency.includes('year') || frequency.includes('annual')

  const expectedMonthlyFromReference = referenceMonthly > 0 ? Number((referenceMonthly / 12).toFixed(2)) : 0

  if (opts.benefitKey && YEARLY_BENEFIT_KEYS.has(opts.benefitKey) && referenceMonthly > 0) {
    if (frequency.includes('month')) {
      const diffFromExpected = Math.abs(amount - expectedMonthlyFromReference)
      const diffFromReference = Math.abs(amount - referenceMonthly)
      const toleranceExpected = expectedMonthlyFromReference * 0.25
      const toleranceReference = referenceMonthly * 0.25

      if (diffFromExpected <= toleranceExpected) {
        return Number(amount.toFixed(2))
      }

      if (diffFromReference <= toleranceReference || amount > expectedMonthlyFromReference * 2) {
        return expectedMonthlyFromReference
      }
    }
  }

  if (frequency.includes('month')) {
    return Number(amount.toFixed(2))
  }

  if (isYearlyByKey || isYearlyByName || isYearlyByFrequency) {
    const monthly = amount / 12
    return monthly > 0 ? monthly : 0
  }

  return amount
}

type AggregationEntry = {
  name: string
  amount: number
  country?: string
  country_code?: string
  index: number
}

export const normalizeAndDeduplicateQuoteCosts = (costs: QuoteCost[], opts: { baseMonthly?: number } = {}): QuoteCost[] => {
  const groups = new Map<string, AggregationEntry>()
  const baseMonthlyReference = Number(opts.baseMonthly) || 0

  costs.forEach((cost, index) => {
    const rawAmount = parseAmount(cost.amount)
    if (rawAmount <= 0) return

    const benefitKey = identifyBenefitKey(cost.name)
    const frequencyValue = (cost.frequency || '').toLowerCase()
    const normalizedAmount = normalizeBenefitAmount(rawAmount, {
      benefitKey,
      rawName: cost.name,
      frequency: frequencyValue,
      referenceMonthly: baseMonthlyReference
    })

    if (normalizedAmount <= 0) return

    const keyBase = benefitKey ? `benefit:${benefitKey}` : `name:${sanitizeKey(cost.name || '') || `idx_${index}`}`
    const displayName = (cost.name && cost.name.trim().length > 0)
      ? cost.name
      : 'Cost Item'

    const existing = groups.get(keyBase)
    if (existing) {
      existing.amount += normalizedAmount
    } else {
      groups.set(keyBase, {
        name: displayName,
        amount: normalizedAmount,
        country: cost.country,
        country_code: cost.country_code,
        index
      })
    }
  })

  return Array.from(groups.values())
    .sort((a, b) => a.index - b.index)
    .map(entry => ({
      name: entry.name,
      amount: entry.amount.toFixed(2),
      frequency: 'monthly',
      country: entry.country,
      country_code: entry.country_code
    }))
}
