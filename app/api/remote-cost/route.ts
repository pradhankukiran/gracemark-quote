import { type NextRequest, NextResponse } from "next/server"
import { getRemoteRegionSlug, getRemoteCurrencySlug } from "@/lib/remote-mapping"
import { getCountryByName, getCurrencyForCountry } from "@/lib/country-data"
import { RemoteRawAPIResponse, RemoteAPIResponse } from "@/lib/shared/types"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { salary, salaryFrequency = "annual", country, currency, clientCountry, state } = body

    // Parse salary from string to number with validation
    const salaryNumber = parseFloat(salary?.toString().replace(/[,\s]/g, '') || '0')
    
    if (!salaryNumber || salaryNumber <= 0 || isNaN(salaryNumber)) {
      return NextResponse.json({ error: "Invalid salary amount. Please enter a valid positive number." }, { status: 400 })
    }

    // Convert salary to annual if monthly, otherwise assume annual - ensure result is integer
    const annualSalary = Math.round(salaryFrequency === "monthly" ? salaryNumber * 12 : salaryNumber)

    // Get Remote region slug for employee location
    let regionSlug = getRemoteRegionSlug(country)

    // Use employee's currency for consistent salary and currency pairing
    // Remote will handle conversions and provide both regional and employer currency costs
    const employerCurrencySlug = getRemoteCurrencySlug(currency)

    if (state && country) {
      const { getRemoteCountryStates } = await import("@/lib/remote-mapping")
      const states = getRemoteCountryStates(country)
      if (states) {
        const selectedState = states.find((s) => s.name === state)
        if (selectedState) {
          regionSlug = selectedState.slug
        }
      }
    }

    if (!regionSlug) {
      return NextResponse.json({ error: `Country "${country}" not supported by Remote` }, { status: 400 })
    }

    if (!employerCurrencySlug) {
      return NextResponse.json({ error: `Employee currency "${currency}" not supported by Remote` }, { status: 400 })
    }

    const remoteOptions = {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${process.env.REMOTE_API_TOKEN}`,
      },
      body: JSON.stringify({
        employer_currency_slug: employerCurrencySlug, // Uses employee currency to match salary value
        employments: [
          {
            region_slug: regionSlug,
            annual_gross_salary: annualSalary,
            employment_term: "fixed", // Default to fixed term as shown in UK sample
          },
        ],
        include_premium_benefits: false,
        include_cost_breakdowns: true,
        include_benefits: false,
        include_management_fee: false,
      }),
    }

    const response = await fetch("https://gateway.remote.com/v1/cost-calculator/estimation", remoteOptions)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Remote API Error:", errorText)
      return NextResponse.json({ error: "Failed to get quote from Remote API" }, { status: response.status })
    }

    const rawData: RemoteRawAPIResponse = await response.json()

    // Validate response structure
    if (!rawData.data?.employments?.[0]) {
      console.error("Invalid Remote API response structure:", rawData)
      return NextResponse.json({ error: "Invalid response from Remote API" }, { status: 500 })
    }

    const employment = rawData.data.employments[0]

    // Transform Remote response while preserving detailed breakdown data
    const transformedResponse: RemoteAPIResponse = {
      provider: "Remote",
      employment: employment,
      raw_response: rawData,
    }

    return NextResponse.json(transformedResponse)
  } catch (error) {
    console.error("Remote API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
