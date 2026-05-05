'use server'

import { getCountryByName } from "@/lib/country-data"

export interface PlayrollCostInput {
  salary: string
  country: string
  currency: string
  state?: string | null
  salaryFrequency?: string
}

const PLAYROLL_ENDPOINT = "https://api-eor-public.dev.playroll.com/calculator/estimate"

const parseAnnualSalary = (rawSalary: string, frequency: string = "annual"): number => {
  const cleaned = rawSalary?.toString().replace(/[\,\s]/g, "") || "0"
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid salary amount")
  }
  return frequency === "monthly" ? value * 12 : value
}

const toMonthly = (annual: number): number => {
  return Number.isFinite(annual) ? annual / 12 : 0
}

export async function fetchPlayrollCostAction(input: PlayrollCostInput): Promise<unknown> {
  const { salary, country, currency, state, salaryFrequency } = input || ({} as PlayrollCostInput)

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

  const monthlySalary = toMonthly(annualSalary)

  const countryInfo = getCountryByName(country)
  const iso2Provided = typeof country === "string" && country.length === 2 ? country.toUpperCase() : null
  const countryCode = countryInfo?.code || iso2Provided

  if (!countryCode) {
    throw new Error(`Unsupported country: ${country}`)
  }

  const payload = {
    countryCode,
    region: state ? String(state) : "",
    inputs: [
      {
        id: "grossSalary",
        frequency: "monthly",
        amount: Number(monthlySalary.toFixed(6)),
        currencyCode: String(currency).toUpperCase(),
      },
    ],
    outputs: [],
    options: {},
  }

  try {
    const response = await fetch(PLAYROLL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      console.error("Playroll API error:", response.status, text)
      throw new Error(`Playroll API error (${response.status}): ${text || response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Playroll API action error:", error)
    if (error instanceof Error) throw error
    throw new Error("Internal server error")
  }
}
