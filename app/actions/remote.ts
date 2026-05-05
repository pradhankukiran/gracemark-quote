'use server'

import {
  getRemoteRegionSlug,
  getRemoteCurrencySlug,
  getRemoteCountryCurrency,
  getRemoteCountryStates,
} from "@/lib/remote-mapping"
import { RemoteRawAPIResponse, RemoteAPIResponse } from "@/lib/shared/types"
import { PapayaCurrencyProvider } from "@/lib/providers/papaya-currency-provider"
import { RemoteCurrencyProvider } from "@/lib/providers/remote-currency-provider"

export interface RemoteCostInput {
  salary: number | string
  salaryFrequency?: string
  country: string
  currency: string
  clientCountry?: string
  state?: string
}

export async function fetchRemoteCostAction(input: RemoteCostInput): Promise<RemoteAPIResponse> {
  const { salary, salaryFrequency = "annual", country, currency, state } = input || ({} as RemoteCostInput)

  // Parse salary from string to number with validation
  const salaryNumber = parseFloat(salary?.toString().replace(/[,\s]/g, '') || '0')

  if (!salaryNumber || salaryNumber <= 0 || isNaN(salaryNumber)) {
    throw new Error("Invalid salary amount. Please enter a valid positive number.")
  }

  // Convert salary to annual if monthly, otherwise assume annual - ensure result is integer
  let annualSalary = Math.round(salaryFrequency === "monthly" ? salaryNumber * 12 : salaryNumber)

  // Get Remote region slug for employee location
  let regionSlug = getRemoteRegionSlug(country)

  // Get employee's regional currency
  const regionalCurrency = getRemoteCountryCurrency(country)

  // Convert salary to regional currency if needed (Remote API expects salary in employee's regional currency)
  if (currency !== regionalCurrency && regionalCurrency) {
    // Use currency providers directly (server-side)
    const papayaProvider = new PapayaCurrencyProvider()
    const remoteProvider = new RemoteCurrencyProvider()

    // Try Papaya Global first, then Remote as fallback
    let conversionResult = await papayaProvider.convertCurrency(annualSalary, currency, regionalCurrency)

    if (!conversionResult.success) {
      conversionResult = await remoteProvider.convertCurrency(annualSalary, currency, regionalCurrency)
    }

    if (!conversionResult.success || !conversionResult.data) {
      console.error('Remote API - Currency conversion failed:', conversionResult.error)
      throw new Error(`Failed to convert salary from ${currency} to ${regionalCurrency}: ${conversionResult.error}`)
    }

    const convertedAmount = conversionResult.data?.conversion_data?.target_amount

    if (!convertedAmount || isNaN(convertedAmount)) {
      console.error('Remote API - Invalid conversion result:', convertedAmount)
      throw new Error(`Currency conversion returned invalid amount: ${convertedAmount}`)
    }

    annualSalary = Math.round(convertedAmount)
  }

  // Final validation before sending to Remote
  if (isNaN(annualSalary) || annualSalary <= 0) {
    console.error('Remote API - Final salary is invalid:', annualSalary)
    throw new Error(`Invalid final salary amount: ${annualSalary}`)
  }

  // Use employee's currency for consistent salary and currency pairing
  // Remote will handle conversions and provide both regional and employer currency costs
  const employerCurrencySlug = getRemoteCurrencySlug(currency)

  if (state && country) {
    const states = getRemoteCountryStates(country)
    if (states) {
      const selectedState = states.find((s) => s.name === state)
      if (selectedState) {
        regionSlug = selectedState.slug
      }
    }
  }

  if (!regionSlug) {
    console.error('Remote API - Country not supported:', country)
    throw new Error(`Country "${country}" not supported by Remote`)
  }

  if (!employerCurrencySlug) {
    console.error('Remote API - Currency not supported:', currency)
    throw new Error(`Employee currency "${currency}" not supported by Remote`)
  }

  const requestBody = {
    employer_currency_slug: employerCurrencySlug, // Uses employee currency to match salary value
    employments: [
      {
        region_slug: regionSlug,
        annual_gross_salary: annualSalary,
        employment_term: "fixed", // Default to fixed term as shown in UK sample
      },
    ],
    include_premium_benefits: false,
    include_cost_breakdowns: true,
    include_benefits: false,
    include_management_fee: false,
  }

  const remoteOptions = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${process.env.REMOTE_API_TOKEN}`,
    },
    body: JSON.stringify(requestBody),
  }

  const response = await fetch("https://gateway.remote.com/v1/cost-calculator/estimation", remoteOptions)

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Remote API Error:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      requestBody: JSON.stringify(requestBody, null, 2),
    })

    // Try to parse error as JSON to get more details
    let detailedError = errorText
    try {
      const errorJson = JSON.parse(errorText)
      detailedError = errorJson.message || errorJson.error || errorText
    } catch {
      // If not JSON, use raw text
    }

    throw new Error(`Remote API Error (${response.status}): ${detailedError}`)
  }

  const rawData: RemoteRawAPIResponse = await response.json()

  // Validate response structure
  if (!rawData.data?.employments?.[0]) {
    console.error("Remote API - Invalid response structure:", rawData)
    throw new Error("Invalid response from Remote API")
  }

  const employment = rawData.data.employments[0]

  // Transform Remote response while preserving detailed breakdown data
  const transformedResponse: RemoteAPIResponse = {
    provider: "Remote",
    employment: employment,
    raw_response: rawData,
  }

  return transformedResponse
}
