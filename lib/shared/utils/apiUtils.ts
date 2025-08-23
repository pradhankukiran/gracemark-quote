// lib/shared/utils/apiUtils.ts - Shared API utilities

import { DeelAPIResponse, RemoteAPIResponse, ValidationAPIResponse, BenefitsAPIResponse, EORFormData } from "@/lib/shared/types"

// Quote Request Data Interface
export interface QuoteRequestData {
  salary: string
  country: string
  currency: string
  clientCountry: string
  age: number
  state?: string
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