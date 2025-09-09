import { ProviderType, StandardizedBenefitData, RemoteAPIResponse, RivermateAPIResponse, OysterAPIResponse, GenericProviderResponse } from "@/lib/types/enhancement"

// Shape used by EnhancementEngine normalizer
interface NormalizedQuoteLike {
  provider: string
  baseCost: number
  currency: string
  country: string
  monthlyTotal: number
  breakdown?: Record<string, number | undefined>
  originalResponse: RemoteAPIResponse | RivermateAPIResponse | OysterAPIResponse | GenericProviderResponse
}

const nowIso = () => new Date().toISOString()

const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const cleaned = v.replace(/[$,\s]/g, '')
    const n = Number.parseFloat(cleaned)
    return isFinite(n) ? n : 0
  }
  return 0
}

const monthlyize = (amount: number, frequency?: string) => {
  if (!frequency) return amount
  const f = frequency.toLowerCase()
  if (f.includes('year')) return amount / 12
  if (f.includes('month')) return amount
  return amount
}

// Enhanced categorization heuristics for line item names with broader patterns
const categorize = (nameRaw: string): keyof StandardizedBenefitData["includedBenefits"] | undefined => {
  const name = (nameRaw || '').toString().toLowerCase()
  if (!name) return undefined
  
  // 13th Salary patterns (multiple languages and variations)
  if (/(^|\s)13(th)?|thirteenth|aguinaldo|decim[ao]\s*terc|christmas\s*bonus|13.*salary|salary.*13|bonus.*13/.test(name)) {
    return 'thirteenthSalary'
  }
  
  // 14th Salary patterns
  if (/(^|\s)14(th)?|fourteenth|14.*salary|salary.*14|bonus.*14/.test(name)) {
    return 'fourteenthSalary'
  }
  
  // Vacation bonus patterns (multiple variations)
  if (/vacation|holiday\s*bonus|annual\s*bonus|vacation\s*pay|vacation\s*allowance|prima\s*vacanza/.test(name)) {
    return 'vacationBonus'
  }
  
  // Transportation patterns (expanded international coverage)
  if (/transport|commut|bus|metro|transit|car\s*allowance|auto\s*allowance|vehicle|travel\s*allowance|gas\s*allowance|fuel|vale\s*transport/.test(name)) {
    return 'transportAllowance'
  }
  
  // Remote work patterns (comprehensive coverage)
  if (/remote|work\s*from\s*home|wfh|telework|home\s*office|telecommut|distance\s*work|home.*allowance|office.*allowance/.test(name)) {
    return 'remoteWorkAllowance'
  }
  
  // Meal vouchers patterns (international variations)
  if (/meal|food|voucher|ticket\s*restaurant|lunch|dining|cafeteria|vale\s*refeição|vale\s*aliment|restaurant\s*card|food\s*card/.test(name)) {
    return 'mealVouchers'
  }
  
  // Social Security patterns (expanded international coverage)
  if (/social\s*security|social\s*insur|employer\s*contrib|pension|ni\b|inps|ssf|contrib.*social|fica|ssi|unemployment\s*insur|disability\s*insur|workers.*comp/.test(name)) {
    return 'socialSecurity'
  }
  
  // Health Insurance patterns (comprehensive)
  if (/health\s*insur|medical\s*insur|hi\b|health.*care|medical.*care|dental|vision|life\s*insur|disability.*insur/.test(name)) {
    return 'healthInsurance'
  }
  
  return undefined
}

type BenefitsMap = StandardizedBenefitData["includedBenefits"]

const addBenefit = (map: BenefitsMap, key: string, amount: number, freq: 'monthly' | 'yearly' = 'monthly', desc?: string) => {
  if (amount <= 0) return
  if (!map[key as keyof BenefitsMap]) {
    // @ts-expect-error - dynamic key assignment into benefits map; runtime keys are validated by categorize()
    map[key] = { amount: 0, frequency: freq, description: desc }
  }
  // @ts-expect-error - merging amounts on a dynamically addressed benefit entry
  map[key].amount = toNumber(map[key as keyof BenefitsMap]?.amount || 0) + amount
}

// Remote raw response types (partial)
interface RemoteBreakdownItem { name: string; amount: number }

export class ProviderInclusionsExtractor {
  static extract(provider: ProviderType, q: NormalizedQuoteLike): StandardizedBenefitData {
    const included: BenefitsMap = {}

    // Always try to include statutory contributions if we can identify them
    if (q.breakdown?.statutoryContributions) {
      addBenefit(included, 'socialSecurity', toNumber(q.breakdown.statutoryContributions), 'monthly', 'Employer statutory contributions')
    }

    // Provider-specific parsing of originalResponse for richer inclusions
    try {
      switch (provider) {
        case 'remote':
          this.extractRemote(q.originalResponse, included)
          break
        case 'rivermate':
          this.extractRivermate(q.originalResponse, included)
          break
        case 'oyster':
          this.extractOyster(q.originalResponse, included)
          break
        case 'deel':
        case 'rippling':
        case 'skuad':
        case 'velocity':
          this.extractGenericQuote(q.originalResponse, included)
          break
        default:
          this.extractGenericQuote(q.originalResponse, included)
      }
    } catch {
      // Be resilient: fallback to using available breakdowns only
      // console.warn('Inclusions extraction fallback:', e)
    }

    // Compute total
    const totalMonthlyBenefits = Object.values(included).reduce((sum: number, item: unknown) => {
      const benefit = item as { amount?: number } | undefined
      return sum + toNumber(benefit?.amount || 0)
    }, 0)

    const response: StandardizedBenefitData = {
      provider,
      baseSalary: toNumber(q.baseCost),
      currency: q.currency,
      country: q.country,
      monthlyTotal: toNumber(q.monthlyTotal),
      includedBenefits: included,
      totalMonthlyBenefits,
      extractionConfidence: this.estimateConfidence(provider, included),
      extractedAt: nowIso()
    }

    return response
  }

  private static extractRemote(original: RemoteAPIResponse, included: BenefitsMap) {
    // Two shapes: RemoteAPIResponse or RemoteQuote
    const costs = original?.employment?.employer_currency_costs
    if (costs) {
      // Totals
      if (typeof costs.monthly_contributions_total === 'number') {
        addBenefit(included, 'socialSecurity', toNumber(costs.monthly_contributions_total), 'monthly', 'Employer statutory contributions')
      }
      if (typeof costs.monthly_benefits_total === 'number' && costs.monthly_benefits_total > 0) {
        // Distribute benefits breakdown into categories
        const arr: RemoteBreakdownItem[] = Array.isArray(costs.monthly_benefits_breakdown) ? costs.monthly_benefits_breakdown : []
        for (const it of arr) {
          const key = categorize(it?.name || '')
          if (key) addBenefit(included, key as string, toNumber(it?.amount || 0), 'monthly', it?.name)
        }
      }
      const contribArr: RemoteBreakdownItem[] = Array.isArray(costs.monthly_contributions_breakdown) ? costs.monthly_contributions_breakdown : []
      for (const it of contribArr) {
        const key = categorize(it?.name || '') || 'socialSecurity'
        addBenefit(included, key as string, toNumber(it?.amount || 0), 'monthly', it?.name)
      }
      return
    }
    // Optimized RemoteQuote: keep contributions as socialSecurity if present
    if (typeof original?.contributions === 'number') {
      addBenefit(included, 'socialSecurity', toNumber(original.contributions), 'monthly', 'Employer statutory contributions')
    }
  }

  private static extractRivermate(original: RivermateAPIResponse, included: BenefitsMap) {
    // Optimized RivermateQuote: taxItems[] and accruals/fees
    const taxItems = Array.isArray(original?.taxItems) ? original.taxItems : []
    for (const it of taxItems) {
      const key = categorize(it?.name || '') || 'socialSecurity'
      addBenefit(included, key as string, toNumber(it?.amount || 0), 'monthly', it?.name)
    }
  }

  private static extractOyster(original: OysterAPIResponse, included: BenefitsMap) {
    const contribs = Array.isArray(original?.contributions) ? original.contributions : []
    for (const it of contribs) {
      const key = categorize(it?.name || '') || 'socialSecurity'
      addBenefit(included, key as string, toNumber(it?.amount || 0), 'monthly', it?.name)
    }
  }

  private static extractGenericQuote(original: GenericProviderResponse, included: BenefitsMap) {
    // Generic Quote has costs[] with frequency and amount strings
    const costs = Array.isArray(original?.costs) ? original.costs : []
    for (const c of costs) {
      const key = categorize(c?.name || '') || 'socialSecurity'
      const amt = monthlyize(toNumber(c?.amount), c?.frequency)
      addBenefit(included, key as string, amt, 'monthly', c?.name)
    }
    // If employer_costs is provided as a total string, add as social security
    if (original?.employer_costs) {
      const total = toNumber(original.employer_costs)
      if (total > 0) addBenefit(included, 'socialSecurity', total, 'monthly', 'Employer statutory contributions')
    }
  }

  private static estimateConfidence(provider: ProviderType, included: BenefitsMap): number {
    const keys = Object.keys(included)
    if (keys.length === 0) return 0.3
    
    // Base confidence varies by provider's data structure quality
    const providerBaseConfidence = {
      'remote': 0.7,      // Remote has detailed breakdown
      'rivermate': 0.65,  // Good structured data
      'oyster': 0.6,      // Decent structured data
      'deel': 0.5,        // Generic structure
      'rippling': 0.5,    // Generic structure
      'skuad': 0.5,       // Generic structure
      'velocity': 0.5     // Generic structure
    }
    
    const baseConfidence = providerBaseConfidence[provider] || 0.45
    
    // Increase confidence based on number of categorized benefits found
    const benefitBonus = keys.length * 0.04
    
    // Additional bonus if we found mandatory benefits (13th salary, social security)
    const hasMandatoryBenefits = keys.some(key => 
      ['thirteenthSalary', 'fourteenthSalary', 'socialSecurity'].includes(key)
    )
    const mandatoryBonus = hasMandatoryBenefits ? 0.1 : 0
    
    return Math.min(0.9, baseConfidence + benefitBonus + mandatoryBonus)
  }
}
