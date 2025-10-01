import { NextRequest, NextResponse } from "next/server"
import { getCountryByName } from "@/lib/country-data"

interface OmnipresentRequestBody {
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OmnipresentRequestBody
    const { salary, country, currency, salaryFrequency } = body

    if (!salary || !country || !currency) {
      return NextResponse.json({ error: "Missing required fields: salary, country, currency" }, { status: 400 })
    }

    let annualSalary: number
    try {
      annualSalary = parseAnnualSalary(salary, salaryFrequency)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid salary amount"
      return NextResponse.json({ error: message }, { status: 400 })
    }

    if (!Number.isFinite(annualSalary) || annualSalary <= 0) {
      return NextResponse.json({ error: "Invalid salary amount" }, { status: 400 })
    }

    const roundedAnnual = Math.round(annualSalary)

    const countryInfo = getCountryByName(country)
    const iso2Provided = typeof country === "string" && country.length === 2 ? country.toUpperCase() : null
    const countryCode = countryInfo?.code || iso2Provided

    if (!countryCode) {
      return NextResponse.json({ error: `Unsupported country: ${country}` }, { status: 400 })
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
      return NextResponse.json({ error: `Omnipresent API error (${response.status}): ${text || response.statusText}` }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Omnipresent API route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
