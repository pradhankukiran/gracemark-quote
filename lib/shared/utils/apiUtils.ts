// lib/shared/utils/apiUtils.ts - Shared API utilities

import { DeelAPIResponse, RemoteAPIResponse, ValidationAPIResponse, BenefitsAPIResponse, EORFormData, Quote, QuoteCost } from "@/lib/shared/types"

// Default values for optional fields (optionally by country, reserved for future use)
export const getDefaultValues = (_countryCode?: string) => ({
  hoursPerDay: "8",
  daysPerWeek: "5", 
  holidayDays: "25", // Common default, could be enhanced with country-specific data
  probationPeriod: "90" // Common default, could be enhanced with country-specific data
})

/**
 * Ensures form data has default values for optional fields
 */
export const ensureFormDefaults = (formData: EORFormData): EORFormData => {
  const defaults = getDefaultValues()
  
  return {
    ...formData,
    hoursPerDay: formData.hoursPerDay || defaults.hoursPerDay,
    daysPerWeek: formData.daysPerWeek || defaults.daysPerWeek,
    holidayDays: formData.holidayDays || defaults.holidayDays,
    probationPeriod: formData.probationPeriod || defaults.probationPeriod,
  }
}

// Quote Request Data Interface
export interface QuoteRequestData {
  salary: string
  country: string
  currency: string
  clientCountry: string
  age: number
  state?: string
  salaryFrequency?: string
}

// Benefits Request Parameters
export interface BenefitsRequestParams {
  countryCode: string
  workVisa: boolean
  workHoursPerWeek: number
  employmentType: string
}

/**
 * Creates quote request data from form data
 */
export const createQuoteRequestData = (
  formData: EORFormData,
  useComparisonData = false
): QuoteRequestData => {
  const baseData: QuoteRequestData = {
    salary: useComparisonData ? formData.compareSalary : formData.baseSalary,
    country: useComparisonData ? formData.compareCountry : formData.country,
    currency: useComparisonData ? formData.compareCurrency : formData.currency,
    clientCountry: formData.clientCountry,
    age: 30,
    salaryFrequency: "annual", // Default to annual for consistency
  }

  const state = useComparisonData ? formData.compareState : formData.state
  if (state) {
    baseData.state = state
  }

  return baseData
}

/**
 * Fetches EOR cost from Deel API
 */
export const fetchEORCost = async (requestData: QuoteRequestData): Promise<DeelAPIResponse> => {
  const response = await fetch("/api/eor-cost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestData),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Deel API error: ${errorData.error || "Failed to calculate quote"}`)
  }

  return response.json()
}

/**
 * Fetches Remote.com cost estimates
 */
export const fetchRemoteCost = async (requestData: QuoteRequestData): Promise<RemoteAPIResponse> => {
  const response = await fetch("/api/remote-cost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestData),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Remote API error: ${errorData.error || "Failed to calculate quote"}`)
  }

  return response.json()
}

/**
 * Transforms a Remote.com API response into a standardized Quote object
 */
export const transformRemoteResponseToQuote = (remoteResponse: RemoteAPIResponse): Quote => {
  const employment = remoteResponse?.employment;
  const costs = employment?.employer_currency_costs;

  const quoteCosts: QuoteCost[] = [
    ...(costs?.monthly_contributions_breakdown || []).map(item => ({
      name: item.name,
      amount: item.amount.toString(),
      frequency: 'monthly',
      country: employment?.country?.name || '',
      country_code: employment?.country?.code || ''
    })),
    ...(costs?.extra_statutory_payments_breakdown || []).map(item => ({
      name: item.name,
      amount: item.amount.toString(),
      frequency: 'monthly',
      country: employment?.country?.name || '',
      country_code: employment?.country?.code || ''
    }))
  ];

  return {
    provider: 'remote',
    salary: costs?.monthly_gross_salary?.toString() || '0',
    currency: costs?.currency?.code || '',
    country: employment?.country?.name || '',
    country_code: employment?.country?.code || '',
    deel_fee: '0', // Remote doesn't have a separate fee like Deel
    severance_accural: '0', // This would need to be extracted if Remote provides it
    total_costs: costs?.monthly_total?.toString() || '0',
    employer_costs: costs?.monthly_total?.toString() || '0',
    costs: quoteCosts,
    benefits_data: [],
    additional_data: {
      additional_notes: []
    }
  };
};


/**
 * Fetches validation data for a specific country
 */
export const fetchValidationData = async (countryCode: string): Promise<ValidationAPIResponse> => {
  const response = await fetch(`/api/eor-validations/${countryCode}`)
  
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Validation API error: ${errorData.error || "Failed to fetch validation data"}`)
  }

  return response.json()
}

/**
 * Fetches benefits data for a specific country and employment configuration
 */
export const fetchBenefitsData = async (params: BenefitsRequestParams): Promise<BenefitsAPIResponse> => {
  // Transform employment type to match API expectations
  const transformEmploymentType = (type: string): string => {
    switch (type.toLowerCase()) {
      case "full-time":
        return "Full-time"
      case "part-time":
        return "Part-time"
      case "contract":
        return "Contract"
      default:
        return type
    }
  }

  const queryParams = new URLSearchParams({
    country_code: params.countryCode,
    work_visa: params.workVisa.toString(),
    work_hours_per_week: params.workHoursPerWeek.toString(),
    employment_type: transformEmploymentType(params.employmentType),
  })

  const response = await fetch(`/api/eor-benefits?${queryParams}`)
  
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Benefits API error: ${errorData.error || "Failed to fetch benefits data"}`)
  }

  return response.json()
}
