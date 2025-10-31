import { type NextRequest, NextResponse } from "next/server"
import { getCountryByName } from "@/lib/country-data"

// Rippling EOR cost breakdown
// Endpoint: https://app.rippling.com/api/global_expansion/api/get_employer_cost_breakdown/
// Payload shape:
// {
//   locale_country: "en-US",
//   role_data: { country_code: "AT", currency: "EUR", state: null, yearly_salary: 250000 }
// }

export async function POST(request: NextRequest) {
  try {
    const { salary, country, currency, state } = await request.json()

    if (!salary || !country || !currency) {
      return NextResponse.json({ error: "Missing required fields: salary, country, currency" }, { status: 400 })
    }

    const annualSalary = Math.round(parseFloat(String(salary).replace(/[\,\s]/g, '')))
    if (!annualSalary || annualSalary <= 0 || isNaN(annualSalary)) {
      return NextResponse.json({ error: "Invalid salary amount" }, { status: 400 })
    }

    // Rippling expects ISO2 country code
    const byName = getCountryByName(String(country))
    const iso2Provided = typeof country === 'string' && country.length === 2 ? country.toUpperCase() : null
    const countryCode = byName?.code || iso2Provided || ''
    if (!countryCode) {
      return NextResponse.json({ error: `Unsupported country: ${country}` }, { status: 400 })
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
      return NextResponse.json({ error: `Rippling API error (${res.status}): ${text}` }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Rippling API route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

