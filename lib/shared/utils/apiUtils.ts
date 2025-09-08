// lib/shared/utils/apiUtils.ts - Shared API utilities

import { DeelAPIResponse, RemoteAPIResponse, ValidationAPIResponse, BenefitsAPIResponse, EORFormData, Quote, QuoteCost, DeelQuote, RemoteQuote, RivermateQuote, OysterQuote } from "@/lib/shared/types"
import { getCountryByName, getCountryByCode } from "@/lib/country-data"

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
  console.log('🔍 createQuoteRequestData - DEBUG START')
  console.log('📋 Full formData object:', JSON.stringify(formData, null, 2))
  console.log('🔄 useComparisonData flag:', useComparisonData)
  
  const extractedFields = {
    baseSalary: formData.baseSalary,
    country: formData.country,
    currency: formData.currency,
    clientCountry: formData.clientCountry,
    compareSalary: formData.compareSalary,
    compareCountry: formData.compareCountry,
    compareCurrency: formData.compareCurrency,
    state: formData.state,
    compareState: formData.compareState
  }
  console.log('🏷️ Extracted key fields:', JSON.stringify(extractedFields, null, 2))

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

  console.log('📤 Final baseData being returned:', JSON.stringify(baseData, null, 2))
  
  // DEFENSIVE VALIDATION: Check for undefined/null values in critical fields
  const criticalFields = ['salary', 'country', 'currency', 'clientCountry'] as const
  const missingFields = criticalFields.filter(field => {
    const value = baseData[field]
    return !value || (typeof value === 'string' && value.trim() === '')
  })
  
  if (missingFields.length > 0) {
    const fieldValues = missingFields.reduce((acc, field) => ({ 
      ...acc, 
      [field]: baseData[field] 
    }), {})
    
    console.error('❌ CRITICAL: Missing required fields:', missingFields)
    console.error('❌ BaseData values for missing fields:', fieldValues)
    console.error('❌ Original formData for debugging:', {
      baseSalary: formData.baseSalary,
      country: formData.country,
      currency: formData.currency,
      clientCountry: formData.clientCountry,
      compareSalary: formData.compareSalary,
      compareCountry: formData.compareCountry,
      compareCurrency: formData.compareCurrency
    })
    
    // Throw descriptive error to help identify the issue
    const errorDetails = missingFields.map(field => `${field}: ${JSON.stringify(baseData[field])}`).join(', ')
    const comparisonContext = useComparisonData ? ' (comparison mode)' : ' (primary mode)'
    throw new Error(`Missing required quote data${comparisonContext}: ${errorDetails}. Please ensure all required form fields are filled.`)
  }
  
  // Additional validation for numeric salary
  const salaryNum = parseFloat(baseData.salary?.toString().replace(/[,\s]/g, '') || '0')
  if (isNaN(salaryNum) || salaryNum <= 0) {
    console.error('❌ Invalid salary value:', baseData.salary)
    throw new Error(`Invalid salary value: "${baseData.salary}". Salary must be a positive number.`)
  }
  
  console.log('✅ All validation checks passed')
  console.log('🔍 createQuoteRequestData - DEBUG END')
  return baseData
}

// Lightweight fetch with retry/backoff for transient errors (429/408/503/timeouts)
const fetchJsonWithRetry = async <T = any>(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: { retries?: number; backoffMs?: number }
): Promise<T> => {
  const maxRetries = Math.max(0, opts?.retries ?? 1)
  let attempt = 0
  let backoff = Math.max(50, opts?.backoffMs ?? 300)

  while (true) {
    try {
      const res = await fetch(input, init)
      if (!res.ok) {
        const status = res.status
        const bodyText = await res.text().catch(() => '')
        const retriable = status === 429 || status === 408 || status === 503
        if (!retriable || attempt >= maxRetries) {
          throw new Error(bodyText || `HTTP ${status}`)
        }
        // backoff and retry
        await new Promise(r => setTimeout(r, backoff + Math.floor(Math.random() * 150)))
        attempt++
        backoff = Math.min(backoff * 2, 1000)
        continue
      }
      // success
      return (await res.json()) as T
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase()
      const retriable = msg.includes('timeout') || msg.includes('network')
      if (!retriable || attempt >= maxRetries) throw err
      await new Promise(r => setTimeout(r, backoff + Math.floor(Math.random() * 150)))
      attempt++
      backoff = Math.min(backoff * 2, 1000)
    }
  }
}

/**
 * Fetches EOR cost from Deel API
 */
export const fetchEORCost = async (requestData: QuoteRequestData): Promise<DeelAPIResponse> => {
  return fetchJsonWithRetry<DeelAPIResponse>("/api/eor-cost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestData),
  }, { retries: 1, backoffMs: 300 })
}

/**
 * Fetches Remote.com cost estimates
 */
export const fetchRemoteCost = async (requestData: QuoteRequestData): Promise<RemoteAPIResponse> => {
  return fetchJsonWithRetry<RemoteAPIResponse>("/api/remote-cost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestData),
  }, { retries: 1, backoffMs: 300 })
}

/**
 * Fetches Oyster.com cost estimates via GraphQL proxy route
 */
export const fetchOysterCost = async (requestData: QuoteRequestData): Promise<any> => {
  return fetchJsonWithRetry<any>("/api/oyster-cost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      salary: (() => {
        const raw = (requestData.salary || '').toString()
        const cleaned = raw.replace(/[\,\s]/g, '')
        const n = Number.parseFloat(cleaned)
        return Number.isFinite(n) ? n : 0
      })(),
      country: ((): string => {
        // Oyster expects ISO country code (e.g., NL). Map from name if needed.
        const c = requestData.country
        if (!c) return ''
        if (c.length === 2) return c
        const byName = getCountryByName(c)
        return byName?.code || c
      })(),
      currency: requestData.currency,
    }),
  }, { retries: 1, backoffMs: 300 })
}

/**
 * Fetches Rippling cost breakdown
 */
export const fetchRipplingCost = async (requestData: QuoteRequestData): Promise<any> => {
  return fetchJsonWithRetry<any>("/api/rippling-cost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      salary: (() => {
        const raw = (requestData.salary || '').toString()
        const cleaned = raw.replace(/[\,\s]/g, '')
        const n = Number.parseFloat(cleaned)
        return Number.isFinite(n) ? n : 0
      })(),
      country: requestData.country,
      currency: requestData.currency,
      state: requestData.state || null,
    }),
  }, { retries: 1, backoffMs: 300 })
}

/**
 * Fetches Skuad cost estimates
 */
export const fetchSkuadCost = async (requestData: QuoteRequestData): Promise<any> => {
  return fetchJsonWithRetry<any>("/api/skuad-cost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      salary: (() => {
        const raw = (requestData.salary || '').toString()
        const cleaned = raw.replace(/[\,\s]/g, '')
        const n = Number.parseFloat(cleaned)
        return Number.isFinite(n) ? n : 0
      })(),
      country: requestData.country,
      currency: requestData.currency,
    }),
  }, { retries: 1, backoffMs: 300 })
}

/**
 * Fetches Velocity Global burden summary
 */
export const fetchVelocityGlobalCost = async (requestData: QuoteRequestData): Promise<any> => {
  return fetchJsonWithRetry<any>("/api/velocity-cost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      country: requestData.country,
      salary: (() => {
        const raw = (requestData.salary || '').toString();
        const n = Number.parseFloat(raw.replace(/[\,\s]/g, ''));
        return Number.isFinite(n) ? n : 0;
      })(),
      currency: requestData.currency,
      markupPercentage: 4,
      timePeriod: 'annual',
    }),
  }, { retries: 1, backoffMs: 300 })
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
  currency_info?: {
    requested_currency?: string
    local_currency?: string
    conversion_applied?: boolean
  }
}

// Prefer requested currency (selected by user) when present; otherwise fall back sensibly
const getRivermateCurrency = (response: RivermateAPIResponse): string => {
  const requested = response?.currency_info?.requested_currency
  if (requested) {
    return requested
  }
  return (
    response?.gross_salary?.currency ||
    response?.total_employment_cost?.currency ||
    response?.country_info?.currency ||
    response?.country?.currency ||
    ''
  ).toString()
}

export const transformRivermateResponseToQuote = (response: RivermateAPIResponse): Quote => {
  const countryInfo = response?.country_info || response?.country;
  const employerCosts = response?.employer_costs;
  const accruals = response?.accruals;
  const grossSalaryMonthly = response?.gross_salary?.monthly ?? 0;
  const totalMonthlyCost = response?.total_monthly_cost ?? response?.total_employment_cost?.monthly ?? 0;
  const currency = getRivermateCurrency(response);

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

  // Exclude management fee and accruals from displayed costs
  // Compute total as salary + sum(tax items) only
  const taxSum = costs.reduce((sum, c) => sum + Number.parseFloat(c.amount || '0'), 0);
  const displayTotal = Number(grossSalaryMonthly) + taxSum;

  return {
    provider: 'rivermate',
    salary: Number(grossSalaryMonthly).toString(),
    currency,
    country: countryInfo?.name || '',
    country_code: countryInfo?.iso_code || (getCountryByName(countryInfo?.name || '')?.code || ''),
    deel_fee: '0',
    severance_accural: '0',
    total_costs: displayTotal.toString(),
    employer_costs: displayTotal.toString(),
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

  // Exclude management fee and accruals from displayed totals: compute salary + sum(tax items)
  const taxSum = (rq.taxItems || []).reduce((sum, it) => sum + (it.amount ?? 0), 0)
  const displayTotal = Number(rq.salary) + taxSum

  return {
    provider: 'rivermate',
    salary: rq.salary.toString(),
    currency: rq.currency,
    country: rq.country,
    country_code: rq.country_code,
    deel_fee: '0',
    severance_accural: '0',
    total_costs: displayTotal.toString(),
    employer_costs: displayTotal.toString(),
    costs,
    benefits_data: [],
    additional_data: { additional_notes: [] },
  }
}


/**
 * Fetches validation data for a specific country
 */
export const fetchValidationData = async (countryCode: string): Promise<ValidationAPIResponse> => {
  return fetchJsonWithRetry<ValidationAPIResponse>(`/api/eor-validations/${countryCode}` , undefined, { retries: 1, backoffMs: 300 })
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

  return fetchJsonWithRetry<BenefitsAPIResponse>(`/api/eor-benefits?${queryParams}`, undefined, { retries: 1, backoffMs: 300 })
}

// Provider-Specific Quote Transformation Functions

/**
 * Transforms a Deel API response to DeelQuote (adds required provider field)
 */
export const transformToDeelQuote = (response: DeelAPIResponse): DeelQuote => {
  return {
    ...response,
    provider: 'deel' // Add required provider field for validation
  };
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
  const currency = getRivermateCurrency(response);

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
/**
 * Transforms an Oyster GraphQL response into a standardized Quote object
 * We exclude Oyster fees and VAT; totals are monthly salary + employer contributions only.
 */
export const transformOysterResponseToQuote = (oysterResponse: any): Quote => {
  const calc = oysterResponse?.data?.bulkSalaryCalculations?.[0]
  const country = calc?.country
  const currency = calc?.currency?.code || ''
  const annualSalary = Number(calc?.annualGrossSalary || 0)
  const monthlySalary = annualSalary / 12
  const employerContribs = (calc?.taxes?.employer?.contributions || []) as Array<{ name: string; amount: number }>

  const costs: QuoteCost[] = employerContribs.map((c) => ({
    name: c.name,
    amount: ((Number(c.amount || 0)) / 12).toString(),
    frequency: 'monthly',
    country: country?.name || '',
    country_code: country?.code || '',
  }))

  const totalMonthlyCosts = monthlySalary + costs.reduce((sum, c) => sum + Number.parseFloat(c.amount || '0'), 0)

  return {
    provider: 'oyster',
    salary: monthlySalary.toString(),
    currency,
    country: country?.name || '',
    country_code: country?.code || '',
    deel_fee: '0',
    severance_accural: '0',
    total_costs: totalMonthlyCosts.toString(),
    employer_costs: totalMonthlyCosts.toString(),
    costs,
    benefits_data: [],
    additional_data: { additional_notes: [] },
  }
}

/**
 * Transforms a Rippling API response into a standardized Quote object
 * Assumes monthly values are in response.costs[].monthly_value and gross/employer/total monthly fields
 */
export const transformRipplingResponseToQuote = (ripplingResponse: any): Quote => {
  const costs = Array.isArray(ripplingResponse?.costs) ? ripplingResponse.costs : []
  const gross = ripplingResponse?.gross_salary
  const total = ripplingResponse?.total_cost
  const employer = ripplingResponse?.employer_cost

  const toStringNum = (v: any) => (v == null ? '0' : String(v))

  const quoteCosts: QuoteCost[] = costs.map((item: any) => ({
    name: String(item?.title || ''),
    amount: toStringNum(item?.monthly_value || '0'),
    frequency: 'monthly',
    country: '',
    country_code: '',
  }))

  return {
    provider: 'rippling',
    salary: toStringNum(gross?.monthly_value || '0'),
    currency: '', // Filled by caller context; left empty as Rippling response lacks it
    country: '',
    country_code: '',
    deel_fee: '0',
    severance_accural: '0',
    total_costs: toStringNum(total?.monthly_value || employer?.monthly_value || '0'),
    employer_costs: toStringNum(total?.monthly_value || employer?.monthly_value || '0'),
    costs: quoteCosts,
    benefits_data: [],
    additional_data: { additional_notes: [] },
  }
}

/**
 * Transforms a Skuad API response into a standardized Quote object (monthly)
 * Excludes Skuad fee and fee discount from totals; uses billingAmounts totals.
 */
export const transformSkuadResponseToQuote = (resp: any): Quote => {
  const data = resp?.data || {}
  const monthly = data?.monthly || {}
  const currency = data?.currencyCode || ''
  const country = data?.country || ''
  const country_code = getCountryByName(country)?.code || ''

  const costs: QuoteCost[] = []
  const employerBreakup = Array.isArray(monthly?.employerEstTaxBreakup) ? monthly.employerEstTaxBreakup : []
  for (const item of employerBreakup) {
    const [title, monthlyValue] = item
    costs.push({ name: String(title || ''), amount: String(monthlyValue ?? '0'), frequency: 'monthly', country, country_code })
  }
  const accruals = Array.isArray(monthly?.employerMandatoryAccrualsEstCostBreakup) ? monthly.employerMandatoryAccrualsEstCostBreakup : []
  for (const item of accruals) {
    const [title, monthlyValue] = item
    costs.push({ name: String(title || ''), amount: String(monthlyValue ?? '0'), frequency: 'monthly', country, country_code })
  }

  const totalBillingMonthly = data?.totalEmploymentCost?.billingAmounts?.monthlyValue
  const totalLocalMonthly = data?.totalEmploymentCost?.localAmounts?.monthlyValue
  const salaryMonthly = monthly?.grossSalary
  const computedMonthly = (() => {
    const base = Number(salaryMonthly) || 0
    const sum = costs.reduce((s, c) => s + (Number.parseFloat(c.amount) || 0), 0)
    return base + sum
  })()

  return {
    provider: 'skuad',
    salary: String(salaryMonthly ?? '0'),
    currency,
    country,
    country_code,
    deel_fee: '0',
    severance_accural: '0',
    total_costs: String(totalBillingMonthly ?? totalLocalMonthly ?? computedMonthly),
    employer_costs: String(totalBillingMonthly ?? totalLocalMonthly ?? computedMonthly),
    costs,
    benefits_data: [],
    additional_data: { additional_notes: [] },
  }
}

/**
 * Transforms a Velocity Global burden summary into a standardized Quote object (monthly)
 */
export const transformVelocityResponseToQuote = (resp: any): Quote => {
  const meta = resp?.meta || {}
  const attr = resp?.data?.attributes || {}
  const iso2 = meta?.locationCode || ''
  const countryInfo = iso2 ? getCountryByCode(iso2) : undefined
  const country = countryInfo?.name || ''
  const country_code = iso2
  const currency = meta?.currencyCode || ''

  const lineItems = Array.isArray(attr?.lineItems) ? attr.lineItems : []
  const costs: QuoteCost[] = lineItems.map((li: any) => ({
    name: String(li?.title || li?.name || ''),
    amount: String(((Number(li?.amount) || 0) / 12).toFixed(2)),
    frequency: 'monthly',
    country,
    country_code,
  }))

  const annualSalary = Number(attr?.remuneration?.baseSalary) || 0
  const annualTotal = Number(attr?.total) || 0

  return {
    provider: 'velocity',
    salary: String((annualSalary / 12).toFixed(2)),
    currency,
    country,
    country_code,
    deel_fee: '0',
    severance_accural: '0',
    total_costs: String((annualTotal / 12).toFixed(2)),
    employer_costs: String((annualTotal / 12).toFixed(2)),
    costs,
    benefits_data: [],
    additional_data: { additional_notes: [] },
  }
}

/**
 * Transforms an Oyster GraphQL response into an optimized OysterQuote for USD conversion
 */
export const transformToOysterQuote = (oysterResponse: any): OysterQuote => {
  const calc = oysterResponse?.data?.bulkSalaryCalculations?.[0]
  const country = calc?.country
  const currency = calc?.currency?.code || ''
  const annualSalary = Number(calc?.annualGrossSalary || 0)
  const monthlySalary = annualSalary / 12
  const employerContribs = (calc?.taxes?.employer?.contributions || []) as Array<{ name: string; amount: number }>
  const contributions = employerContribs.map((c) => ({ name: c.name, amount: (Number(c.amount || 0)) / 12 }))
  const total = monthlySalary + contributions.reduce((s, v) => s + v.amount, 0)

  return {
    provider: 'oyster',
    salary: monthlySalary,
    currency,
    country: country?.name || '',
    country_code: country?.code || '',
    contributions,
    total,
  }
}

/**
 * Transforms an optimized OysterQuote into a display-ready Quote for UI rendering.
 */
export const transformOysterQuoteToDisplayQuote = (oq: OysterQuote): Quote => {
  const costs: QuoteCost[] = (oq.contributions || []).map((c) => ({
    name: c.name,
    amount: (c.amount ?? 0).toString(),
    frequency: 'monthly',
    country: oq.country,
    country_code: oq.country_code,
  }))

  return {
    provider: 'oyster',
    salary: oq.salary.toString(),
    currency: oq.currency,
    country: oq.country,
    country_code: oq.country_code,
    deel_fee: '0',
    severance_accural: '0',
    total_costs: oq.total.toString(),
    employer_costs: oq.total.toString(),
    costs,
    benefits_data: [],
    additional_data: { additional_notes: [] },
  }
}
