'use server'

import { getCountryByName } from "@/lib/country-data"
import { iso2ToIso3 } from "@/lib/iso-country-codes"

// Skuad cost calculator
// Example endpoint:
// https://cost-calculator.skuad.io/cost-calculator/cost?client=website&countryCode=ARG&currencyCode=ARS&salary=5000000

export interface SkuadCostInput {
  salary: string | number
  country: string
  currency: string
}

export async function fetchSkuadCostAction(input: SkuadCostInput): Promise<unknown> {
  const { salary, country, currency } = input

  if (!salary || !country || !currency) {
    throw new Error("Missing required fields: salary, country, currency")
  }

  const annualSalary = Math.round(parseFloat(String(salary).replace(/[\,\s]/g, '')))
  if (!annualSalary || annualSalary <= 0 || isNaN(annualSalary)) {
    throw new Error("Invalid salary amount")
  }

  // Map country to ISO3 for Skuad
  const byName = getCountryByName(String(country))
  const iso2 = byName?.code || (typeof country === 'string' && country.length === 2 ? country.toUpperCase() : '')
  const iso3 = iso2 ? iso2ToIso3(iso2) : (typeof country === 'string' && country.length === 3 ? country.toUpperCase() : '')
  if (!iso3) {
    throw new Error(`Unsupported country: ${country}`)
  }

  const qs = new URLSearchParams({
    client: 'website',
    countryCode: iso3,
    currencyCode: String(currency).toUpperCase(),
    salary: String(annualSalary),
  })

  const url = `https://cost-calculator.skuad.io/cost-calculator/cost?${qs.toString()}`

  const res = await fetch(url, { method: 'GET', headers: { accept: 'application/json' } })
  if (!res.ok) {
    const text = await res.text()
    console.error('Skuad API error', res.status, text)
    throw new Error(`Skuad API error (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data
}
