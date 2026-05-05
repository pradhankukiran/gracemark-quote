'use server'

import { getCountryByName } from "@/lib/country-data"

// Rippling EOR cost breakdown
// Endpoint: https://app.rippling.com/api/global_expansion/api/get_employer_cost_breakdown/
// Payload shape:
// {
//   locale_country: "en-US",
//   role_data: { country_code: "AT", currency: "EUR", state: null, yearly_salary: 250000 }
// }

export interface RipplingCostInput {
  salary: string | number
  country: string
  currency: string
  state?: string | null
}

export async function fetchRipplingCostAction(input: RipplingCostInput): Promise<unknown> {
  const { salary, country, currency, state } = input || ({} as RipplingCostInput)

  if (!salary || !country || !currency) {
    throw new Error("Missing required fields: salary, country, currency")
  }

  const annualSalary = Math.round(parseFloat(String(salary).replace(/[\,\s]/g, '')))
  if (!annualSalary || annualSalary <= 0 || isNaN(annualSalary)) {
    throw new Error("Invalid salary amount")
  }

  // Rippling expects ISO2 country code
  const byName = getCountryByName(String(country))
  const iso2Provided = typeof country === 'string' && country.length === 2 ? country.toUpperCase() : null
  const countryCode = byName?.code || iso2Provided || ''
  if (!countryCode) {
    throw new Error(`Unsupported country: ${country}`)
  }

  const payload = {
    locale_country: "en-US",
    role_data: {
      country_code: countryCode,
      currency: String(currency).toUpperCase(),
      state: state || null,
      yearly_salary: annualSalary,
    }
  }

  const ripplingUrl = "https://app.rippling.com/api/global_expansion/api/get_employer_cost_breakdown/"

  try {
    // Note: Rippling may require authentication; if so, set headers via env or proxy.
    const res = await fetch(ripplingUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error("Rippling API error:", res.status, text)
      throw new Error(`Rippling API error (${res.status}): ${text}`)
    }

    return await res.json()
  } catch (error) {
    console.error("Rippling API action error:", error)
    if (error instanceof Error) throw error
    throw new Error("Internal server error")
  }
}
