import { type NextRequest, NextResponse } from "next/server"
import { getRemoteRegionSlug, getRemoteCurrencySlug, getRemoteCountryCurrency } from "@/lib/remote-mapping"
// import { getCountryByName, getCurrencyForCountry } from "@/lib/country-data" // Unused
import { RemoteRawAPIResponse, RemoteAPIResponse } from "@/lib/shared/types"
import { PapayaCurrencyProvider } from "@/lib/providers/papaya-currency-provider"
import { RemoteCurrencyProvider } from "@/lib/providers/remote-currency-provider"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { salary, salaryFrequency = "annual", country, currency, clientCountry, state } = body

    // console.log('🔍 Remote API - Incoming request:', {
    //   salary,
    //   salaryFrequency,
    //   country,
    //   currency,
    //   clientCountry,
    //   state
    // })

    // Parse salary from string to number with validation
    const salaryNumber = parseFloat(salary?.toString().replace(/[,\s]/g, '') || '0')
    
    if (!salaryNumber || salaryNumber <= 0 || isNaN(salaryNumber)) {
      return NextResponse.json({ error: "Invalid salary amount. Please enter a valid positive number." }, { status: 400 })
    }

    // Convert salary to annual if monthly, otherwise assume annual - ensure result is integer
    let annualSalary = Math.round(salaryFrequency === "monthly" ? salaryNumber * 12 : salaryNumber)

    // Get Remote region slug for employee location
    let regionSlug = getRemoteRegionSlug(country)
    
    // Get employee's regional currency
    const regionalCurrency = getRemoteCountryCurrency(country)
    
    // console.log('🔍 Remote API - Currency analysis:', {
    //   inputCurrency: currency,
    //   regionalCurrency,
    //   inputSalary: annualSalary,
    //   needsConversion: currency !== regionalCurrency
    // })

    // Convert salary to regional currency if needed (Remote API expects salary in employee's regional currency)
    if (currency !== regionalCurrency && regionalCurrency) {
      // console.log('🔄 Remote API - Converting salary from employer currency to regional currency')
      
      // Use currency providers directly (server-side)
      const papayaProvider = new PapayaCurrencyProvider()
      const remoteProvider = new RemoteCurrencyProvider()
      
      // Try Papaya Global first, then Remote as fallback
      let conversionResult = await papayaProvider.convertCurrency(annualSalary, currency, regionalCurrency)
      
      if (!conversionResult.success) {
        // console.log('🔄 Remote API - Papaya failed, trying Remote provider')
        conversionResult = await remoteProvider.convertCurrency(annualSalary, currency, regionalCurrency)
      }
      
      if (!conversionResult.success || !conversionResult.data) {
        console.error('❌ Remote API - Currency conversion failed:', conversionResult.error)
        return NextResponse.json({ 
          error: `Failed to convert salary from ${currency} to ${regionalCurrency}: ${conversionResult.error}` 
        }, { status: 400 })
      }
      
      const convertedAmount = conversionResult.data?.conversion_data?.target_amount
      
      if (!convertedAmount || isNaN(convertedAmount)) {
        console.error('❌ Remote API - Invalid conversion result:', convertedAmount)
        return NextResponse.json({ 
          error: `Currency conversion returned invalid amount: ${convertedAmount}` 
        }, { status: 400 })
      }
      
      annualSalary = Math.round(convertedAmount)
      // console.log('✅ Remote API - Salary converted:', {
      //   originalAmount: salaryNumber,
      //   originalCurrency: currency,
      //   convertedAmount: annualSalary,
      //   targetCurrency: regionalCurrency,
      //   exchangeRate: conversionResult.data.conversion_data.exchange_rate
      // })
    }
    
    // Final validation before sending to Remote
    if (isNaN(annualSalary) || annualSalary <= 0) {
      console.error('❌ Remote API - Final salary is invalid:', annualSalary)
      return NextResponse.json({ 
        error: `Invalid final salary amount: ${annualSalary}` 
      }, { status: 400 })
    }

    // Use employee's currency for consistent salary and currency pairing
    // Remote will handle conversions and provide both regional and employer currency costs
    const employerCurrencySlug = getRemoteCurrencySlug(currency)

    // console.log('🔍 Remote API - Slug mapping:', {
    //   regionSlug,
    //   employerCurrencySlug,
    //   currency
    // })

    if (state && country) {
      const { getRemoteCountryStates } = await import("@/lib/remote-mapping")
      const states = getRemoteCountryStates(country)
      if (states) {
        const selectedState = states.find((s) => s.name === state)
        if (selectedState) {
          regionSlug = selectedState.slug
          // console.log('🔍 Remote API - State override:', { state, newRegionSlug: regionSlug })
        }
      }
    }

    if (!regionSlug) {
      console.error('❌ Remote API - Country not supported:', country)
      return NextResponse.json({ error: `Country "${country}" not supported by Remote` }, { status: 400 })
    }

    if (!employerCurrencySlug) {
      console.error('❌ Remote API - Currency not supported:', currency)
      return NextResponse.json({ error: `Employee currency "${currency}" not supported by Remote` }, { status: 400 })
    }

    const requestBody = {
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
    }

    // console.log('🔍 Remote API - Request body:', JSON.stringify(requestBody, null, 2))
    // console.log('🔍 Remote API - Final salary amount being sent:', annualSalary, regionalCurrency || currency)

    const remoteOptions = {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${process.env.REMOTE_API_TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    }

    // console.log('🔍 Remote API - Making request to Remote...')
    const response = await fetch("https://gateway.remote.com/v1/cost-calculator/estimation", remoteOptions)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ Remote API Error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        requestBody: JSON.stringify(requestBody, null, 2)
      })
      
      // Try to parse error as JSON to get more details
      let detailedError = errorText
      try {
        const errorJson = JSON.parse(errorText)
        detailedError = errorJson.message || errorJson.error || errorText
      } catch {
        // If not JSON, use raw text
      }
      
      return NextResponse.json({ 
        error: `Remote API Error (${response.status}): ${detailedError}` 
      }, { status: response.status })
    }

    // console.log('✅ Remote API - Response received successfully')
    const rawData: RemoteRawAPIResponse = await response.json()

    // console.log('🔍 Remote API - Raw response:', JSON.stringify(rawData, null, 2))

    // Validate response structure
    if (!rawData.data?.employments?.[0]) {
      console.error("❌ Remote API - Invalid response structure:", rawData)
      return NextResponse.json({ error: "Invalid response from Remote API" }, { status: 500 })
    }

    const employment = rawData.data.employments[0]
    // console.log('✅ Remote API - Employment data extracted:', employment.country.name, employment.employer_currency_costs.currency.code)

    // Transform Remote response while preserving detailed breakdown data
    const transformedResponse: RemoteAPIResponse = {
      provider: "Remote",
      employment: employment,
      raw_response: rawData,
    }

    // console.log('✅ Remote API - Returning transformed response')
    return NextResponse.json(transformedResponse)
  } catch (error) {
    console.error("Remote API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
