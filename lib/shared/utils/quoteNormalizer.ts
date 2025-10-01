// Quote Normalizer - Universal transformer for provider quotes to enhancement API format

import { ProviderType } from '@/lib/types/enhancement'
import { Quote, RemoteAPIResponse, RemoteQuote, RivermateQuote, OysterQuote } from '@/lib/shared/types'

// The format expected by the enhancement API
export interface NormalizedQuote {
  provider: string
  baseCost: number
  currency: string
  country: string
  monthlyTotal: number
  breakdown?: {
    platformFee?: number
    managementFee?: number
    processingFee?: number
    statutoryContributions?: number
    [key: string]: number | undefined
  }
  originalResponse: unknown
}

// Type guards to detect quote format
const isDisplayQuote = (quote: unknown): quote is Quote => {
  return quote && 
    typeof quote === 'object' &&
    typeof (quote as any).total_costs === 'string' &&
    typeof (quote as any).salary === 'string' &&
    typeof (quote as any).provider === 'string'
}

export const isRemoteAPIResponse = (quote: unknown): quote is RemoteAPIResponse => {
  return quote && 
    typeof quote === 'object' &&
    (quote as any).employment &&
    (quote as any).employment.employer_currency_costs &&
    typeof (quote as any).employment.employer_currency_costs.monthly_total === 'number'
}

const isRivermateQuote = (quote: unknown): quote is RivermateQuote => {
  return quote && 
    typeof quote === 'object' &&
    Array.isArray((quote as any).taxItems) &&
    typeof (quote as any).total === 'number' &&
    typeof (quote as any).salary === 'number'
}

const isOysterQuote = (quote: unknown): quote is OysterQuote => {
  return quote && 
    typeof quote === 'object' &&
    Array.isArray((quote as any).contributions) &&
    typeof (quote as any).total === 'number' &&
    typeof (quote as any).salary === 'number'
}

const isRemoteQuote = (quote: unknown): quote is RemoteQuote => {
  return quote && 
    typeof quote === 'object' &&
    typeof (quote as any).total === 'number' &&
    typeof (quote as any).salary === 'number' &&
    typeof (quote as any).contributions === 'number' &&
    (quote as any).provider === 'remote'
}

// Utility to parse monetary string values (removes $, commas, etc.)
const parseMonetaryValue = (value: string | number | undefined): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    // Remove currency symbols, commas, and spaces
    const cleaned = value.replace(/[$,\s]/g, '')
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

// Extract country and currency with fallbacks
const getCountryInfo = (quote: unknown, _provider: ProviderType) => {
  void _provider
  let country = ''
  let currency = ''

  if (isRemoteAPIResponse(quote)) {
    country = quote.employment?.country?.name || ''
    currency = quote.employment?.employer_currency_costs?.currency?.code || 'USD'
  } else if (quote?.country && quote?.currency) {
    country = quote.country
    currency = quote.currency
  }

  return { country, currency }
}

// Provider-specific normalizers
const normalizeDeelQuote = (quote: Quote): NormalizedQuote => {
  const baseCost = parseMonetaryValue(quote.salary)
  const totalCosts = parseMonetaryValue(quote.total_costs)
  const deelFee = parseMonetaryValue(quote.deel_fee)
  const severanceAccrual = parseMonetaryValue((quote as any).severance_accural)
  const monthlyTotal = Math.max(0, totalCosts - deelFee - severanceAccrual)
  const { country, currency } = getCountryInfo(quote, 'deel')

  return {
    provider: 'deel',
    baseCost,
    monthlyTotal,
    currency: currency || quote.currency,
    country: country || quote.country,
    breakdown: {
      platformFee: parseMonetaryValue(quote.deel_fee)
    },
    originalResponse: quote
  }
}

const normalizeRemoteAPIResponse = (quote: RemoteAPIResponse): NormalizedQuote => {
  const costs = quote.employment?.employer_currency_costs
  const baseCost = costs?.monthly_gross_salary || 0
  const monthlyTotal = costs?.monthly_total || 0
  const { country, currency } = getCountryInfo(quote, 'remote')

  return {
    provider: 'remote',
    baseCost,
    monthlyTotal,
    currency,
    country,
    breakdown: {
      statutoryContributions: costs?.monthly_contributions_total || 0,
      platformFee: (costs?.monthly_benefits_total || 0)
    },
    originalResponse: quote
  }
}

const normalizeRemoteDisplayQuote = (quote: Quote): NormalizedQuote => {
  const baseCost = parseMonetaryValue(quote.salary)
  const monthlyTotal = parseMonetaryValue(quote.total_costs)
  const { country, currency } = getCountryInfo(quote, 'remote')

  return {
    provider: 'remote',
    baseCost,
    monthlyTotal,
    currency: currency || quote.currency,
    country: country || quote.country,
    originalResponse: quote
  }
}

const normalizeRivermateQuote = (quote: RivermateQuote): NormalizedQuote => {
  return {
    provider: 'rivermate',
    baseCost: quote.salary,
    monthlyTotal: quote.total,
    currency: quote.currency,
    country: quote.country,
    breakdown: {
      managementFee: quote.managementFee || 0,
      statutoryContributions: quote.taxItems?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0
    },
    originalResponse: quote
  }
}

const normalizeRivermateDisplayQuote = (quote: Quote): NormalizedQuote => {
  const baseCost = parseMonetaryValue(quote.salary)
  const monthlyTotal = parseMonetaryValue(quote.total_costs)
  const { country, currency } = getCountryInfo(quote, 'rivermate')

  return {
    provider: 'rivermate',
    baseCost,
    monthlyTotal,
    currency: currency || quote.currency,
    country: country || quote.country,
    originalResponse: quote
  }
}

const normalizeOysterQuote = (quote: OysterQuote): NormalizedQuote => {
  return {
    provider: 'oyster',
    baseCost: quote.salary,
    monthlyTotal: quote.total,
    currency: quote.currency,
    country: quote.country,
    breakdown: {
      statutoryContributions: quote.contributions?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0
    },
    originalResponse: quote
  }
}

const normalizeOysterDisplayQuote = (quote: Quote): NormalizedQuote => {
  const baseCost = parseMonetaryValue(quote.salary)
  const monthlyTotal = parseMonetaryValue(quote.total_costs)
  const { country, currency } = getCountryInfo(quote, 'oyster')

  return {
    provider: 'oyster',
    baseCost,
    monthlyTotal,
    currency: currency || quote.currency,
    country: country || quote.country,
    originalResponse: quote
  }
}

const normalizeGenericDisplayQuote = (quote: Quote, provider: ProviderType): NormalizedQuote => {
  const baseCost = parseMonetaryValue(quote.salary)
  const monthlyTotal = parseMonetaryValue(quote.total_costs)
  const { country, currency } = getCountryInfo(quote, provider)

  return {
    provider,
    baseCost,
    monthlyTotal,
    currency: currency || quote.currency,
    country: country || quote.country,
    originalResponse: quote
  }
}

/**
 * Universal quote normalizer - converts any provider quote format to enhancement API format
 */
export const normalizeQuoteForEnhancement = (
  provider: ProviderType,
  baseQuote: unknown
): NormalizedQuote | null => {
  // Handle null/undefined quotes
  if (!baseQuote) {
    return null
  }

  // Handle empty objects
  if (typeof baseQuote === 'object' && Object.keys(baseQuote).length === 0) {
    console.warn(`Empty quote object for provider: ${provider}`)
    return null
  }

  try {
    // Provider-specific detection and normalization
    switch (provider) {
      case 'deel':
        if (isDisplayQuote(baseQuote)) {
          return normalizeDeelQuote(baseQuote)
        }
        break

      case 'remote':
        if (isRemoteAPIResponse(baseQuote)) {
          return normalizeRemoteAPIResponse(baseQuote)
        } else if (isDisplayQuote(baseQuote)) {
          return normalizeRemoteDisplayQuote(baseQuote)
        } else if (isRemoteQuote(baseQuote)) {
          // Handle RemoteQuote optimized format
          return {
            provider: 'remote',
            baseCost: baseQuote.salary,
            monthlyTotal: baseQuote.total,
            currency: baseQuote.currency,
            country: baseQuote.country,
            breakdown: {
              statutoryContributions: baseQuote.contributions
            },
            originalResponse: baseQuote
          }
        }
        break

      case 'rivermate':
        if (isRivermateQuote(baseQuote)) {
          return normalizeRivermateQuote(baseQuote)
        } else if (isDisplayQuote(baseQuote)) {
          return normalizeRivermateDisplayQuote(baseQuote)
        }
        break

      case 'oyster':
        if (isOysterQuote(baseQuote)) {
          return normalizeOysterQuote(baseQuote)
        } else if (isDisplayQuote(baseQuote)) {
          return normalizeOysterDisplayQuote(baseQuote)
        }
        break

      case 'rippling':
      case 'skuad':
      case 'velocity':
      case 'playroll':
      case 'omnipresent':
        if (isDisplayQuote(baseQuote)) {
          return normalizeGenericDisplayQuote(baseQuote, provider)
        }
        break

      default:
        console.warn(`Unknown provider: ${provider}`)
        break
    }

    // Fallback: try to normalize as generic display quote
    if (isDisplayQuote(baseQuote)) {
      return normalizeGenericDisplayQuote(baseQuote, provider)
    }

    // If all else fails, provide a concise error message
    console.warn(`Unable to normalize quote for provider: ${provider}. Quote format not recognized.`, {
      provider,
      hasKeys: Object.keys(baseQuote).length,
      isObject: typeof baseQuote === 'object'
    })
    
    return null

  } catch (error) {
    console.error(`Error normalizing quote for provider ${provider}:`, error)
    return null
  }
}

// Helper function to validate normalized quote
export const isValidNormalizedQuote = (quote: NormalizedQuote | null): quote is NormalizedQuote => {
  if (!quote) return false
  
  return (
    typeof quote.provider === 'string' &&
    typeof quote.baseCost === 'number' &&
    typeof quote.monthlyTotal === 'number' &&
    typeof quote.currency === 'string' &&
    typeof quote.country === 'string' &&
    quote.baseCost >= 0 &&
    quote.monthlyTotal >= 0 &&
    quote.currency.length > 0 &&
    quote.country.length > 0
  )
}

// Helper function to validate that a quote object has required properties
export const isValidQuote = (quote: unknown): quote is Quote => {
  if (!quote || typeof quote !== 'object') {
    return false
  }
  
  // Check for required Quote properties
  const requiredStringProps = ['provider', 'salary', 'currency', 'country', 'total_costs']
  const hasRequiredProps = requiredStringProps.every(prop => 
    typeof quote[prop] === 'string' && quote[prop].length > 0
  )
  
  if (!hasRequiredProps) {
    return false
  }
  
  // Additional validation for specific properties
  return (
    // Ensure numeric string values are actually parseable
    !isNaN(parseFloat(quote.salary.replace(/[$,\s]/g, ''))) &&
    !isNaN(parseFloat(quote.total_costs.replace(/[$,\s]/g, ''))) &&
    // Ensure arrays exist (even if empty) - be more lenient
    (Array.isArray(quote.costs) || quote.costs === undefined) &&
    (Array.isArray(quote.benefits_data) || quote.benefits_data === undefined) &&
    // Ensure additional_data has the right structure - be more lenient
    (quote.additional_data === undefined || 
     (quote.additional_data && Array.isArray(quote.additional_data.additional_notes)))
  )
}

// Flexible validation that can handle quotes with or without provider context
export const isValidQuoteWithContext = (quote: unknown, expectedProvider?: string): quote is Quote => {
  if (!quote || typeof quote !== 'object') {
    return false
  }
  
  // If quote doesn't have provider but we know the expected provider, that's ok
  const quoteWithProvider = (quote as any).provider ? quote : { ...quote, provider: expectedProvider }
  
  return isValidQuote(quoteWithProvider)
}

// Helper function to check if a quote is empty/invalid with debugging
export const validateQuoteWithDebugging = (provider: string, quote: unknown): { 
  isValid: boolean
  reason?: string 
  quoteInfo?: unknown 
} => {
  if (!quote) {
    return {
      isValid: false,
      reason: 'Quote is null or undefined',
      quoteInfo: { quote }
    }
  }
  
  if (typeof quote !== 'object') {
    return {
      isValid: false,
      reason: 'Quote is not an object',
      quoteInfo: { quote, type: typeof quote }
    }
  }
  
  const keys = Object.keys(quote)
  if (keys.length === 0) {
    return {
      isValid: false,
      reason: 'Quote is an empty object',
      quoteInfo: { quote, keys }
    }
  }
  
  // Try flexible validation first (context-aware)
  if (isValidQuoteWithContext(quote, provider)) {
    return { isValid: true }
  }
  
  // If flexible validation fails, provide detailed feedback
  if (!isValidQuote(quote)) {
    const requiredProps = ['provider', 'salary', 'currency', 'country', 'total_costs']
    const missingProps = requiredProps.filter(prop => !quote[prop])
    const invalidProps = requiredProps.filter(prop => 
      quote[prop] && typeof quote[prop] !== 'string'
    )
    
    // If only missing provider field, provide context-aware message
    if (missingProps.length === 1 && missingProps[0] === 'provider' && invalidProps.length === 0) {
      return {
        isValid: false,
        reason: `Quote data is valid but missing provider field (should be "${provider}")`,
        quoteInfo: {
          provider,
          keys,
          missingProps,
          canBeFixed: true,
          sampleData: {
            provider: quote.provider || `[MISSING - should be "${provider}"]`,
            salary: quote.salary,
            currency: quote.currency,
            country: quote.country,
            total_costs: quote.total_costs
          }
        }
      }
    }
    
    return {
      isValid: false,
      reason: 'Quote is missing required properties or has invalid data',
      quoteInfo: {
        provider,
        keys,
        missingProps,
        invalidProps,
        sampleData: {
          provider: quote.provider,
          salary: quote.salary,
          currency: quote.currency,
          country: quote.country,
          total_costs: quote.total_costs
        }
      }
    }
  }
  
  return { isValid: true }
}
