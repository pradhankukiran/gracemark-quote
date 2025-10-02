import { ProviderType, StandardizedBenefitData, RemoteAPIResponse, RivermateAPIResponse, OysterAPIResponse, GenericProviderResponse } from "@/lib/types/enhancement"
import { identifyBenefitKey, normalizeBenefitAmount } from "@/lib/shared/utils/benefitNormalization"

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

type BenefitsMap = StandardizedBenefitData["includedBenefits"]

const addBenefit = (map: BenefitsMap, key: string, amount: number, freq: 'monthly' | 'yearly' = 'monthly', desc?: string) => {
  if (amount <= 0) return
  if (!map[key as keyof BenefitsMap]) {
    // @ts-expect-error - dynamic key assignment into benefits map; runtime keys are validated by identifyBenefitKey()
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
    const baseMonthlyReference = toNumber(q.baseCost)

    // Always try to include statutory contributions if we can identify them
    if (q.breakdown?.statutoryContributions) {
      addBenefit(included, 'socialSecurity', toNumber(q.breakdown.statutoryContributions), 'monthly', 'Employer statutory contributions')
    }

    // Provider-specific parsing of originalResponse for richer inclusions
    try {
      switch (provider) {
        case 'remote':
          this.extractRemote(q.originalResponse, included, baseMonthlyReference)
          break
        case 'rivermate':
          this.extractRivermate(q.originalResponse, included, baseMonthlyReference)
          break
        case 'oyster':
          this.extractOyster(q.originalResponse, included, baseMonthlyReference)
          break
        case 'deel':
        case 'rippling':
        case 'skuad':
        case 'velocity':
          this.extractGenericQuote(q.originalResponse, included, baseMonthlyReference)
          break
        default:
          this.extractGenericQuote(q.originalResponse, included, baseMonthlyReference)
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

  private static extractRemote(original: RemoteAPIResponse, included: BenefitsMap, referenceMonthly: number) {
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
          const categorizedKey = identifyBenefitKey(it?.name || '')
          if (!categorizedKey) continue
          const amount = normalizeBenefitAmount(toNumber(it?.amount || 0), {
            benefitKey: categorizedKey,
            rawName: it?.name,
            referenceMonthly
          })
          addBenefit(included, categorizedKey as string, amount, 'monthly', it?.name)
        }
      }
      const contribArr: RemoteBreakdownItem[] = Array.isArray(costs.monthly_contributions_breakdown) ? costs.monthly_contributions_breakdown : []
      for (const it of contribArr) {
        const categorizedKey = identifyBenefitKey(it?.name || '')
        const key = categorizedKey || 'socialSecurity'
        const amount = normalizeBenefitAmount(toNumber(it?.amount || 0), {
          benefitKey: categorizedKey,
          rawName: it?.name,
          referenceMonthly
        })
        addBenefit(included, key as string, amount, 'monthly', it?.name)
      }
      return
    }
    // Optimized RemoteQuote: keep contributions as socialSecurity if present
    if (typeof original?.contributions === 'number') {
      addBenefit(included, 'socialSecurity', toNumber(original.contributions), 'monthly', 'Employer statutory contributions')
    }
  }

  private static extractRivermate(original: RivermateAPIResponse, included: BenefitsMap, referenceMonthly: number) {
    // Optimized RivermateQuote: taxItems[] and accruals/fees
    const taxItems = Array.isArray(original?.taxItems) ? original.taxItems : []
    for (const it of taxItems) {
      const categorizedKey = identifyBenefitKey(it?.name || '')
      const key = categorizedKey || 'socialSecurity'
      const amount = normalizeBenefitAmount(toNumber(it?.amount || 0), {
        benefitKey: categorizedKey,
        rawName: it?.name,
        referenceMonthly
      })
      addBenefit(included, key as string, amount, 'monthly', it?.name)
    }
  }

  private static extractOyster(original: OysterAPIResponse, included: BenefitsMap, referenceMonthly: number) {
    const contribs = Array.isArray(original?.contributions) ? original.contributions : []
    for (const it of contribs) {
      const categorizedKey = identifyBenefitKey(it?.name || '')
      const key = categorizedKey || 'socialSecurity'
      const amount = normalizeBenefitAmount(toNumber(it?.amount || 0), {
        benefitKey: categorizedKey,
        rawName: it?.name,
        referenceMonthly
      })
      addBenefit(included, key as string, amount, 'monthly', it?.name)
    }
  }

  private static extractGenericQuote(original: GenericProviderResponse, included: BenefitsMap, referenceMonthly: number) {
    // Generic Quote has costs[] with frequency and amount strings
    const costs = Array.isArray(original?.costs) ? original.costs : []
    for (const c of costs) {
      const categorizedKey = identifyBenefitKey(c?.name || '')
      const key = categorizedKey || 'socialSecurity'
      const amt = normalizeBenefitAmount(toNumber(c?.amount), {
        benefitKey: categorizedKey,
        rawName: c?.name,
        frequency: c?.frequency,
        referenceMonthly
      })
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
