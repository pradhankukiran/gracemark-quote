// QuoteNormalizer - Standardize quotes from all 7 EOR providers

import { 
  NormalizedQuote, 
  ProviderType 
} from "@/lib/types/enhancement"
import { 
  Quote, 
  RemoteQuote, 
  RivermateQuote, 
  OysterQuote,
  RemoteAPIResponse
} from "@/lib/shared/types"

export class QuoteNormalizer {

  /**
   * Main normalization method - dispatches to provider-specific normalizers
   */
  static normalize(provider: ProviderType, providerQuote: any): NormalizedQuote {
    try {
      switch (provider) {
        case 'deel':
          return this.normalizeDeelQuote(providerQuote)
        case 'remote':
          return this.normalizeRemoteQuote(providerQuote)
        case 'rivermate':
          return this.normalizeRivermateQuote(providerQuote)
        case 'oyster':
          return this.normalizeOysterQuote(providerQuote)
        case 'rippling':
          return this.normalizeRipplingQuote(providerQuote)
        case 'skuad':
          return this.normalizeSkuadQuote(providerQuote)
        case 'velocity':
          return this.normalizeVelocityQuote(providerQuote)
        default:
          throw new Error(`Unsupported provider: ${provider}`)
      }
    } catch (error) {
      console.error(`Error normalizing quote for ${provider}:`, error)
      throw error
    }
  }

  /**
   * Normalize Deel quote (follows standard Quote interface)
   */
  static normalizeDeelQuote(quote: Quote): NormalizedQuote {
    const totalCosts = parseFloat(quote.total_costs?.replace(/[,$]/g, '') || '0')
    const deelFee = parseFloat(quote.deel_fee?.replace(/[,$]/g, '') || '0')
    const salary = parseFloat(quote.salary?.replace(/[,$]/g, '') || '0')
    const severanceAccrual = parseFloat((quote as any).severance_accural?.replace(/[,$]/g, '') || '0')

    return {
      provider: 'deel',
      baseCost: salary,
      currency: quote.currency,
      country: quote.country,
      // Align with UI display: exclude provider platform fee and severance accrual
      monthlyTotal: Math.max(0, totalCosts - deelFee - severanceAccrual),
      breakdown: {
        platformFee: deelFee,
        statutoryContributions: this.calculateDeelStatutoryContributions(quote),
        ...this.extractDeelCostBreakdown(quote.costs)
      },
      originalResponse: quote
    }
  }

  /**
   * Normalize Remote quote (handles both RemoteAPIResponse and RemoteQuote formats)
   */
  static normalizeRemoteQuote(quote: RemoteAPIResponse | RemoteQuote): NormalizedQuote {
    // Handle RemoteAPIResponse format (full API response)
    if ('employment' in quote) {
      const employment = quote.employment
      const costs = employment.employer_currency_costs
      const baseCost = costs?.monthly_gross_salary || 0
      const total = costs?.monthly_total || 0

      return {
        provider: 'remote',
        baseCost,
        currency: costs?.currency?.code || 'USD',
        country: employment.country?.name || '',
        monthlyTotal: total,
        breakdown: {
          statutoryContributions: costs?.monthly_contributions_total || 0,
          ...this.extractRemoteContributions(costs?.monthly_contributions_breakdown)
        },
        originalResponse: quote
      }
    }

    // Handle simplified RemoteQuote format
    const remoteQuote = quote as RemoteQuote
    return {
      provider: 'remote',
      baseCost: remoteQuote.salary,
      currency: remoteQuote.currency,
      country: remoteQuote.country,
      monthlyTotal: remoteQuote.total,
      breakdown: {
        contributions: remoteQuote.contributions,
        totalCostEmployment: remoteQuote.tce
      },
      originalResponse: quote
    }
  }

  /**
   * Normalize Rivermate quote
   */
  static normalizeRivermateQuote(quote: RivermateQuote): NormalizedQuote {
    const taxItemsTotal = quote.taxItems?.reduce((sum, item) => sum + item.amount, 0) || 0
    
    return {
      provider: 'rivermate',
      baseCost: quote.salary,
      currency: quote.currency,
      country: quote.country,
      monthlyTotal: quote.total,
      breakdown: {
        managementFee: quote.managementFee,
        statutoryContributions: taxItemsTotal,
        ...this.extractRivermateTaxItems(quote.taxItems)
      },
      originalResponse: quote
    }
  }

  /**
   * Normalize Oyster quote
   */
  static normalizeOysterQuote(quote: OysterQuote): NormalizedQuote {
    const contributionsTotal = quote.contributions?.reduce((sum, contrib) => sum + contrib.amount, 0) || 0

    return {
      provider: 'oyster',
      baseCost: quote.salary,
      currency: quote.currency,
      country: quote.country,
      monthlyTotal: quote.total,
      breakdown: {
        statutoryContributions: contributionsTotal,
        ...this.extractOysterContributions(quote.contributions)
      },
      originalResponse: quote
    }
  }

  /**
   * Normalize Rippling quote (using standard Quote structure)
   */
  static normalizeRipplingQuote(quote: Quote): NormalizedQuote {
    const totalCosts = parseFloat(quote.total_costs?.replace(/[,$]/g, '') || '0')
    const salary = parseFloat(quote.salary?.replace(/[,$]/g, '') || '0')

    return {
      provider: 'rippling',
      baseCost: salary,
      currency: quote.currency,
      country: quote.country,
      monthlyTotal: totalCosts,
      breakdown: {
        ...this.extractGenericCostBreakdown(quote.costs, 'rippling')
      },
      originalResponse: quote
    }
  }

  /**
   * Normalize Skuad quote (using standard Quote structure)
   */
  static normalizeSkuadQuote(quote: Quote): NormalizedQuote {
    const totalCosts = parseFloat(quote.total_costs?.replace(/[,$]/g, '') || '0')
    const salary = parseFloat(quote.salary?.replace(/[,$]/g, '') || '0')

    return {
      provider: 'skuad',
      baseCost: salary,
      currency: quote.currency,
      country: quote.country,
      monthlyTotal: totalCosts,
      breakdown: {
        ...this.extractGenericCostBreakdown(quote.costs, 'skuad')
      },
      originalResponse: quote
    }
  }

  /**
   * Normalize Velocity quote (using standard Quote structure)
   */
  static normalizeVelocityQuote(quote: Quote): NormalizedQuote {
    const totalCosts = parseFloat(quote.total_costs?.replace(/[,$]/g, '') || '0')
    const salary = parseFloat(quote.salary?.replace(/[,$]/g, '') || '0')

    return {
      provider: 'velocity',
      baseCost: salary,
      currency: quote.currency,
      country: quote.country,
      monthlyTotal: totalCosts,
      breakdown: {
        ...this.extractGenericCostBreakdown(quote.costs, 'velocity')
      },
      originalResponse: quote
    }
  }

  // Helper Methods

  /**
   * Calculate statutory contributions for Deel quotes
   */
  private static calculateDeelStatutoryContributions(quote: Quote): number {
    const totalCosts = parseFloat(quote.total_costs?.replace(/[,$]/g, '') || '0')
    const deelFee = parseFloat(quote.deel_fee?.replace(/[,$]/g, '') || '0')
    const salary = parseFloat(quote.salary?.replace(/[,$]/g, '') || '0')
    
    return totalCosts - deelFee - salary
  }

  /**
   * Extract cost breakdown from Deel costs array
   */
  private static extractDeelCostBreakdown(costs: any[] = []) {
    const breakdown: Record<string, number> = {}
    
    costs.forEach(cost => {
      const key = this.normalizeBreakdownKey(cost.name)
      const amount = parseFloat(cost.amount?.replace(/[,$]/g, '') || '0')
      breakdown[key] = amount
    })
    
    return breakdown
  }

  /**
   * Extract contributions from Remote API employment data
   */
  private static extractRemoteContributions(costBreakdown: any[] = []) {
    const breakdown: Record<string, number> = {}
    
    costBreakdown.forEach(item => {
      const key = this.normalizeBreakdownKey(item.name || item.description || 'unknown')
      breakdown[key] = item.amount || item.cost || 0
    })
    
    return breakdown
  }

  /**
   * Extract tax items from Rivermate quote
   */
  private static extractRivermateTaxItems(taxItems: any[] = []) {
    const breakdown: Record<string, number> = {}
    
    taxItems.forEach(item => {
      const key = this.normalizeBreakdownKey(item.name)
      breakdown[key] = item.amount
    })
    
    return breakdown
  }

  /**
   * Extract contributions from Oyster quote
   */
  private static extractOysterContributions(contributions: any[] = []) {
    const breakdown: Record<string, number> = {}
    
    contributions.forEach(contrib => {
      const key = this.normalizeBreakdownKey(contrib.name)
      breakdown[key] = contrib.amount
    })
    
    return breakdown
  }

  /**
   * Generic cost breakdown extraction for providers using standard Quote structure
   */
  private static extractGenericCostBreakdown(costs: any[] = [], provider: string) {
    const breakdown: Record<string, number> = {}
    
    costs.forEach(cost => {
      const key = this.normalizeBreakdownKey(cost.name)
      const amount = parseFloat(cost.amount?.replace(/[,$]/g, '') || '0')
      breakdown[key] = amount
    })
    
    // Add provider-specific platform fee if available
    if (provider === 'rippling' || provider === 'skuad' || provider === 'velocity') {
      const platformFee = costs.find(cost => 
        cost.name?.toLowerCase().includes('fee') ||
        cost.name?.toLowerCase().includes('platform') ||
        cost.name?.toLowerCase().includes('management')
      )
      if (platformFee) {
        breakdown.platformFee = parseFloat(platformFee.amount?.replace(/[,$]/g, '') || '0')
      }
    }
    
    return breakdown
  }

  /**
   * Normalize breakdown keys for consistency
   */
  private static normalizeBreakdownKey(name: string): string {
    if (!name) return 'unknown'
    
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 30)
  }

  /**
   * Utility: Clean monetary string to number
   */
  static parseMonetaryValue(value: string | number): number {
    if (typeof value === 'number') return value
    if (!value || typeof value !== 'string') return 0
    
    return parseFloat(value.replace(/[,$\s]/g, '')) || 0
  }

  /**
   * Validation: Check if normalized quote is valid
   */
  static validateNormalizedQuote(quote: NormalizedQuote): boolean {
    return !!(
      quote.provider &&
      quote.currency &&
      quote.country &&
      typeof quote.baseCost === 'number' &&
      typeof quote.monthlyTotal === 'number' &&
      quote.monthlyTotal > 0
    )
  }

  /**
   * Get summary statistics for a normalized quote
   */
  static getQuoteSummary(quote: NormalizedQuote) {
    const breakdown = quote.breakdown
    const totalBreakdown = Object.values(breakdown).reduce((acc: number, val) => acc + (val || 0), 0)
    
    return {
      provider: quote.provider,
      monthlyCost: quote.monthlyTotal,
      baseSalary: quote.baseCost,
      additionalCosts: quote.monthlyTotal - quote.baseCost,
      breakdownTotal: totalBreakdown,
      currency: quote.currency,
      country: quote.country,
      hasDetailedBreakdown: Object.keys(breakdown).length > 0
    }
  }

  /**
   * Compare two normalized quotes
   */
  static compareQuotes(quote1: NormalizedQuote, quote2: NormalizedQuote) {
    if (quote1.currency !== quote2.currency) {
      console.warn('Comparing quotes with different currencies')
    }
    
    return {
      cheaperProvider: quote1.monthlyTotal < quote2.monthlyTotal ? quote1.provider : quote2.provider,
      costDifference: Math.abs(quote1.monthlyTotal - quote2.monthlyTotal),
      percentageDifference: Math.abs(
        ((quote1.monthlyTotal - quote2.monthlyTotal) / quote1.monthlyTotal) * 100
      )
    }
  }
}
