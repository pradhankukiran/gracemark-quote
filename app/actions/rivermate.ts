'use server'

import { getCountryByName } from "@/lib/country-data"
import { iso2ToIso3 } from "@/lib/iso-country-codes"

export interface RivermateCostInput {
  salary: string
  country: string
  currency: string
  state?: string
}

export async function fetchRivermateCostAction(input: RivermateCostInput): Promise<unknown> {
  const { salary, country, currency } = input

  if (!salary || !country || !currency) {
    throw new Error("Missing required fields: salary, country, currency")
  }

  // Use ISO3 country code required by Rivermate
  const countryData = getCountryByName(country)
  const provided = String(country || '')
  const candidateIso2 = countryData?.code || (provided.length === 2 ? provided.toUpperCase() : '')
  const iso3From2 = candidateIso2 ? iso2ToIso3(candidateIso2) : null
  const iso3 = iso3From2 || (provided.length === 3 ? provided.toUpperCase() : '')

  // Use annual salary as is (the API expects annual)
  const annualSalary = Math.round(parseFloat(String(salary).replace(/[\,\s]/g, '')))
  if (!annualSalary || annualSalary <= 0 || isNaN(annualSalary)) {
    throw new Error("Invalid salary amount")
  }

  if (!iso3) {
    throw new Error(`Failed to map country to ISO3: ${country}`)
  }

  const qs = new URLSearchParams({
    country: iso3,
    annual_salary: annualSalary.toString(),
    currency: currency,
  })

  const url = `https://api.rivermate.com/api/calculator/employment-costs/?${qs.toString()}`

  const response = await fetch(url, { method: 'GET', headers: { accept: 'application/json' } })
  if (!response.ok) {
    const text = await response.text()
    console.error('Rivermate API error', response.status, text)
    throw new Error(`Rivermate API error (${response.status}): ${text}`)
  }

  const data = await response.json()
  return data
}
