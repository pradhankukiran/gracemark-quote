import { type NextRequest, NextResponse } from "next/server"
import { getCountryByName } from "@/lib/country-data"

interface PlayrollRequestBody {
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PlayrollRequestBody
    const { salary, country, currency, state, salaryFrequency } = body

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

    const monthlySalary = toMonthly(annualSalary)

    const countryInfo = getCountryByName(country)
    const iso2Provided = typeof country === "string" && country.length === 2 ? country.toUpperCase() : null
    const countryCode = countryInfo?.code || iso2Provided

    if (!countryCode) {
      return NextResponse.json({ error: `Unsupported country: ${country}` }, { status: 400 })
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
      return NextResponse.json({ error: `Playroll API error (${response.status}): ${text || response.statusText}` }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Playroll API route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
