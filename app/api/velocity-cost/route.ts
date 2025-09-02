import { type NextRequest, NextResponse } from "next/server"
import { getCountryByName } from "@/lib/country-data"

// Velocity Global burden summary
// Endpoint: https://api.velocityglobal.com/burden/summary/{ISO2}
// Note: This endpoint does not accept salary; it returns standardized annual amounts.

export async function POST(request: NextRequest) {
  try {
    const { country, salary, currency, markupPercentage = 4, timePeriod = "annual" } = await request.json()

    if (!country) {
      return NextResponse.json({ error: "Missing required field: country" }, { status: 400 })
    }

    // Ensure ISO2 code
    const iso2 = ((): string => {
      if (typeof country === 'string' && country.length === 2) return country.toUpperCase()
      const byName = getCountryByName(String(country))
      return byName?.code || ''
    })()

    if (!iso2) {
      return NextResponse.json({ error: `Unsupported country: ${country}` }, { status: 400 })
    }

    const annualSalary = Math.round(parseFloat(String(salary ?? '0').replace(/[\,\s]/g, '')))
    if (!annualSalary || annualSalary <= 0 || isNaN(annualSalary)) {
      return NextResponse.json({ error: "Invalid or missing salary amount" }, { status: 400 })
    }

    const url = `https://api.velocityglobal.com/burden/summary/${iso2}`
    const body = {
      data: { salary: annualSalary },
      meta: { timePeriod, currencyCode: String(currency || '').toUpperCase(), markupPercentage }
    }
    const res = await fetch(url, { 
      method: 'POST', 
      headers: { 
        accept: 'application/json',
        'content-type': 'application/json',
        // VG endpoint accepts requests without auth token; emulate browser UA per working curl
        'user-agent': request.headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('Velocity Global API error', res.status, text)
      return NextResponse.json({ error: `Velocity Global API error (${res.status}): ${text}` }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Velocity Global API route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
