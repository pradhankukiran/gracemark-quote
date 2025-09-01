// lib/shared/utils/apiUtils.ts - Shared API utilities

import { DeelAPIResponse, RemoteAPIResponse, ValidationAPIResponse, BenefitsAPIResponse, EORFormData, Quote, QuoteCost, DeelQuote, RemoteQuote, RivermateQuote } from "@/lib/shared/types"
import { getCountryByName } from "@/lib/country-data"

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
    // Benefits breakdown
    ...(costs?.monthly_benefits_breakdown || []).map(item => ({
      name: item.name,
      amount: item.amount.toString(),
      frequency: 'monthly',
      country: employment?.country?.name || '',
      country_code: employment?.country?.code || ''
    })),
    // Employer contributions
    ...(costs?.monthly_contributions_breakdown || []).map(item => ({
      name: item.name,
      amount: item.amount.toString(),
      frequency: 'monthly',
      country: employment?.country?.name || '',
      country_code: employment?.country?.code || ''
    })),
    // Extra statutory payments
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
 * Transforms a Rivermate API response into a standardized Quote object
 * Expected response shape documented in user prompt
 */
type RivermateAPIResponse = {
  country?: { name?: string; iso_code?: string; currency?: string }
  country_info?: { name?: string; iso_code?: string; currency?: string }
  employer_costs?: {
    tax_items?: Record<string, { name?: string; amount?: number }>
    management_fee?: number
  }
  accruals?: { monthly_provision?: number; items?: Record<string, unknown> }
  gross_salary?: { annual?: number; monthly?: number; currency?: string }
  total_monthly_cost?: number
  total_employment_cost?: { annual?: number; monthly?: number; currency?: string }
}

export const transformRivermateResponseToQuote = (response: RivermateAPIResponse): Quote => {
  const countryInfo = response?.country_info || response?.country;
  const employerCosts = response?.employer_costs;
  const accruals = response?.accruals;
  const grossSalaryMonthly = response?.gross_salary?.monthly ?? 0;
  const totalMonthlyCost = response?.total_monthly_cost ?? response?.total_employment_cost?.monthly ?? 0;
  const currency = (countryInfo?.currency || response?.gross_salary?.currency || response?.total_employment_cost?.currency || '').toString();

  const costs: QuoteCost[] = [];

  // Employer tax items
  const taxItems = employerCosts?.tax_items || {};
  for (const key of Object.keys(taxItems)) {
    const item = taxItems[key];
    costs.push({
      name: item?.name || key,
      amount: (item?.amount ?? 0).toString(),
      frequency: 'monthly',
      country: countryInfo?.name || '',
      country_code: countryInfo?.iso_code || '',
    });
  }

  // Management fee as a cost item if present
  if (typeof employerCosts?.management_fee === 'number') {
    costs.push({
      name: 'Management Fee',
      amount: employerCosts.management_fee.toString(),
      frequency: 'monthly',
      country: countryInfo?.name || '',
      country_code: countryInfo?.iso_code || '',
    });
  }

  // Accruals monthly provision
  if (typeof accruals?.monthly_provision === 'number') {
    costs.push({
      name: 'Accruals Provision',
      amount: accruals.monthly_provision.toString(),
      frequency: 'monthly',
      country: countryInfo?.name || '',
      country_code: countryInfo?.iso_code || '',
    });
  }

  return {
    provider: 'rivermate',
    salary: Number(grossSalaryMonthly).toString(),
    currency,
    country: countryInfo?.name || '',
    country_code: countryInfo?.iso_code || (getCountryByName(countryInfo?.name || '')?.code || ''),
    deel_fee: '0',
    severance_accural: '0',
    total_costs: Number(totalMonthlyCost).toString(),
    employer_costs: Number(totalMonthlyCost).toString(),
    costs,
    benefits_data: [],
    additional_data: { additional_notes: [] },
  };
}

/**
 * Transforms an optimized RivermateQuote (used for USD conversion)
 * into a display-ready Quote (Deel-like structure) for UI rendering.
 */
export const transformRivermateQuoteToDisplayQuote = (rq: RivermateQuote): Quote => {
  const costs: QuoteCost[] = [];

  // Tax items
  for (const item of rq.taxItems || []) {
    costs.push({
      name: item.name,
      amount: (item.amount ?? 0).toString(),
      frequency: 'monthly',
      country: rq.country,
      country_code: rq.country_code,
    })
  }

  // Management fee
  if (typeof rq.managementFee === 'number') {
    costs.push({
      name: 'Management Fee',
      amount: rq.managementFee.toString(),
      frequency: 'monthly',
      country: rq.country,
      country_code: rq.country_code,
    })
  }

  // Accruals provision
  if (typeof rq.accrualsProvision === 'number' && rq.accrualsProvision !== 0) {
    costs.push({
      name: 'Accruals Provision',
      amount: rq.accrualsProvision.toString(),
      frequency: 'monthly',
      country: rq.country,
      country_code: rq.country_code,
    })
  }

  return {
    provider: 'rivermate',
    salary: rq.salary.toString(),
    currency: rq.currency,
    country: rq.country,
    country_code: rq.country_code,
    deel_fee: '0',
    severance_accural: '0',
    total_costs: rq.total.toString(),
    employer_costs: rq.total.toString(),
    costs,
    benefits_data: [],
    additional_data: { additional_notes: [] },
  }
}


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

// Provider-Specific Quote Transformation Functions

/**
 * Transforms a Deel API response to DeelQuote (identity function)
 */
export const transformToDeelQuote = (response: DeelAPIResponse): DeelQuote => {
  return response; // DeelQuote is identical to Quote/DeelAPIResponse
}

/**
 * Transforms a Remote API response to RemoteQuote (optimized structure)
 */
export const transformToRemoteQuote = (response: RemoteAPIResponse): RemoteQuote => {
  const employment = response.employment;
  const costs = employment.employer_currency_costs;
  const country = employment.country;
  
  return {
    provider: 'remote',
    salary: costs.monthly_gross_salary,
    currency: costs.currency.code,
    country: country.name,
    country_code: country.alpha_2_code,
    contributions: costs.monthly_contributions_total,
    total: costs.monthly_total,
    tce: costs.monthly_tce,
  };
}

/**
 * Transforms a Rivermate API response to RivermateQuote (optimized structure)  
 */
export const transformToRivermateQuote = (response: RivermateAPIResponse): RivermateQuote => {
  const countryInfo = response?.country_info || response?.country;
  const employerCosts = response?.employer_costs;
  const accruals = response?.accruals;
  const grossSalaryMonthly = response?.gross_salary?.monthly ?? 0;
  const totalMonthlyCost = response?.total_monthly_cost ?? response?.total_employment_cost?.monthly ?? 0;
  const currency = (countryInfo?.currency || response?.gross_salary?.currency || response?.total_employment_cost?.currency || '').toString();

  // Extract tax items
  const taxItems = [];
  const employerTaxItems = employerCosts?.tax_items || {};
  for (const key of Object.keys(employerTaxItems)) {
    const item = employerTaxItems[key];
    taxItems.push({
      name: item?.name || key,
      amount: item?.amount ?? 0,
    });
  }

  return {
    provider: 'rivermate',
    salary: grossSalaryMonthly,
    currency,
    country: countryInfo?.name || '',
    country_code: countryInfo?.iso_code || (getCountryByName(countryInfo?.name || '')?.code || ''),
    taxItems,
    managementFee: employerCosts?.management_fee ?? 0,
    accrualsProvision: accruals?.monthly_provision ?? 0,
    total: totalMonthlyCost,
  };
}
