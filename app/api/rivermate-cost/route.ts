import { type NextRequest, NextResponse } from "next/server"
import { getCountryByName } from "@/lib/country-data"
import { iso2ToIso3 } from "@/lib/iso-country-codes"

export async function POST(request: NextRequest) {
  try {
    const { salary, country, currency } = await request.json()

    if (!salary || !country || !currency) {
      return NextResponse.json({ error: "Missing required fields: salary, country, currency" }, { status: 400 })
    }

    // Use ISO3 country code required by Rivermate
    const countryData = getCountryByName(country)
    const provided = String(country || '')
    const candidateIso2 = countryData?.code || (provided.length === 2 ? provided.toUpperCase() : '')
    const iso3From2 = candidateIso2 ? iso2ToIso3(candidateIso2) : null
    const iso3 = iso3From2 || (provided.length === 3 ? provided.toUpperCase() : '')

    // Add debugging logs for country code resolution
    // console.log('Rivermate Country Resolution:', {
    //   input: country,
    //   countryData: countryData?.name,
    //   countryCode: countryData?.code,
    //   candidateIso2,
    //   iso3From2,
    //   finalIso3: iso3
    // })

    // Use annual salary as is (the API expects annual)
    const annualSalary = Math.round(parseFloat(String(salary).replace(/[\,\s]/g, '')))
    if (!annualSalary || annualSalary <= 0 || isNaN(annualSalary)) {
      return NextResponse.json({ error: "Invalid salary amount" }, { status: 400 })
    }

    if (!iso3) {
      return NextResponse.json({ error: `Failed to map country to ISO3: ${country}` }, { status: 400 })
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
      return NextResponse.json({ error: `Rivermate API error (${response.status}): ${text}` }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Rivermate API route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
