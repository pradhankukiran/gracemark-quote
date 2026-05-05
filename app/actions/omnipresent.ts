'use server'

import { getCountryByName } from "@/lib/country-data"

export interface OmnipresentCostInput {
  salary: string
  country: string
  currency: string
  salaryFrequency?: string
}

const OMNIPRESENT_ENDPOINT = "https://calculator-api.omnipresent.com/employer-costs/estimate"

const parseAnnualSalary = (rawSalary: string, frequency: string = "annual"): number => {
  const cleaned = rawSalary?.toString().replace(/[\,\s]/g, "") || "0"
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid salary amount")
  }
  return frequency === "monthly" ? value * 12 : value
}

export async function fetchOmnipresentCostAction(input: OmnipresentCostInput): Promise<unknown> {
  const { salary, country, currency, salaryFrequency } = input

  if (!salary || !country || !currency) {
    throw new Error("Missing required fields: salary, country, currency")
  }

  let annualSalary: number
  try {
    annualSalary = parseAnnualSalary(salary, salaryFrequency)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid salary amount"
    throw new Error(message)
  }

  if (!Number.isFinite(annualSalary) || annualSalary <= 0) {
    throw new Error("Invalid salary amount")
  }

  const roundedAnnual = Math.round(annualSalary)

  const countryInfo = getCountryByName(country)
  const iso2Provided = typeof country === "string" && country.length === 2 ? country.toUpperCase() : null
  const countryCode = countryInfo?.code || iso2Provided

  if (!countryCode) {
    throw new Error(`Unsupported country: ${country}`)
  }

  const url = new URL(OMNIPRESENT_ENDPOINT)
  url.searchParams.set("countryCode", countryCode)
  url.searchParams.set("currencyCode", String(currency).toUpperCase())
  url.searchParams.set("annualSalary", roundedAnnual.toString())
  url.searchParams.set("managementPricing", "none")
  url.searchParams.set("fxPricing", "none")

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    console.error("Omnipresent API error:", response.status, text)
    throw new Error(`Omnipresent API error (${response.status}): ${text || response.statusText}`)
  }

  const data = await response.json()
  return data
}
