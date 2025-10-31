import { type NextRequest, NextResponse } from "next/server"
import { getCountryByName } from "@/lib/country-data"
import { iso2ToIso3 } from "@/lib/iso-country-codes"

// Skuad cost calculator
// Example endpoint:
// https://cost-calculator.skuad.io/cost-calculator/cost?client=website&countryCode=ARG&currencyCode=ARS&salary=5000000

export async function POST(request: NextRequest) {
  try {
    const { salary, country, currency } = await request.json()

    if (!salary || !country || !currency) {
      return NextResponse.json({ error: "Missing required fields: salary, country, currency" }, { status: 400 })
    }

    const annualSalary = Math.round(parseFloat(String(salary).replace(/[\,\s]/g, '')))
    if (!annualSalary || annualSalary <= 0 || isNaN(annualSalary)) {
      return NextResponse.json({ error: "Invalid salary amount" }, { status: 400 })
    }

    // Map country to ISO3 for Skuad
    const byName = getCountryByName(String(country))
    const iso2 = byName?.code || (typeof country === 'string' && country.length === 2 ? country.toUpperCase() : '')
    const iso3 = iso2 ? iso2ToIso3(iso2) : (typeof country === 'string' && country.length === 3 ? country.toUpperCase() : '')
    if (!iso3) {
      return NextResponse.json({ error: `Unsupported country: ${country}` }, { status: 400 })
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
      return NextResponse.json({ error: `Skuad API error (${res.status}): ${text}` }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Skuad API route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

