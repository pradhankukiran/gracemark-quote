import { type NextRequest, NextResponse } from "next/server"
import { getRemoteRegionSlug, getRemoteCurrencySlug } from "@/lib/remote-mapping"
import { getCountryByName, getCurrencyForCountry } from "@/lib/country-data"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { salary, salaryFrequency, country, currency, clientCountry, age = 30, state } = body

    // Convert salary to annual if monthly
    const annualSalary = salaryFrequency === "monthly" ? salary * 12 : salary

    // Get Remote region slug for employee location
    let regionSlug = getRemoteRegionSlug(country)

    let employerCurrencySlug
    if (clientCountry) {
      const clientCountryData = getCountryByName(clientCountry)
      if (clientCountryData) {
        const clientCurrency = getCurrencyForCountry(clientCountryData.code)
        employerCurrencySlug = getRemoteCurrencySlug(clientCurrency)
      }
    }

    // Fallback to employee currency if no client country specified
    if (!employerCurrencySlug) {
      employerCurrencySlug = getRemoteCurrencySlug(currency)
    }

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
      return NextResponse.json({ error: `Client country currency not supported by Remote` }, { status: 400 })
    }

    const remoteOptions = {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${process.env.REMOTE_API_TOKEN}`,
      },
      body: JSON.stringify({
        employer_currency_slug: employerCurrencySlug, // Now uses client country's currency slug
        employments: [
          {
            region_slug: regionSlug,
            annual_gross_salary: annualSalary,
            employment_term: "fixed", // Default to fixed term as shown in UK sample
          },
        ],
      }),
    }

    const response = await fetch("https://gateway.remote.com/v1/cost-calculator/estimation", remoteOptions)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Remote API Error:", errorText)
      return NextResponse.json({ error: "Failed to get quote from Remote API" }, { status: response.status })
    }

    const data = await response.json()

    // Transform Remote response to our standard format
    const employment = data.data.employments[0]
    const costs = employment.employer_currency_costs

    const transformedResponse = {
      provider: "Remote",
      country: employment.country.name,
      currency: costs.currency.code,
      salary: {
        annual: costs.annual_gross_salary,
        monthly: costs.monthly_gross_salary,
      },
      costs: {
        annual_contributions: costs.annual_contributions_total,
        monthly_contributions: costs.monthly_contributions_total,
        annual_total: costs.annual_total,
        monthly_total: costs.monthly_total,
        monthly_tce: costs.monthly_tce,
        extra_statutory_payments_total: costs.extra_statutory_payments_total,
        extra_statutory_payments_monthly: costs.extra_statutory_payments_total / 12,
      },
      regional_costs: {
        currency: employment.regional_currency_costs.currency.code,
        annual_gross_salary: employment.regional_currency_costs.annual_gross_salary,
        monthly_gross_salary: employment.regional_currency_costs.monthly_gross_salary,
        annual_contributions: employment.regional_currency_costs.annual_contributions_total,
        monthly_contributions: employment.regional_currency_costs.monthly_contributions_total,
        annual_total: employment.regional_currency_costs.annual_total,
        monthly_total: employment.regional_currency_costs.monthly_total,
        monthly_tce: employment.regional_currency_costs.monthly_tce,
        extra_statutory_payments_total: employment.regional_currency_costs.extra_statutory_payments_total,
        extra_statutory_payments_monthly: employment.regional_currency_costs.extra_statutory_payments_total / 12,
      },
      details: {
        minimum_onboarding_time: employment.minimum_onboarding_time,
        has_extra_statutory_payment: employment.has_extra_statutory_payment,
        country_benefits_url: employment.country_benefits_details_url,
        country_guide_url: employment.country_guide_url,
      },
      raw_response: data,
    }

    return NextResponse.json(transformedResponse)
  } catch (error) {
    console.error("Remote API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
