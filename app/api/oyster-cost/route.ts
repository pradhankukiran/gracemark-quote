import { NextResponse } from "next/server"

const OYSTER_GRAPHQL_URL = "https://app.oysterhr.com/api/graphql/cost-calculator"

const QUERY = `
fragment TaxData on SalaryTax { total contributions { name group amount metadata { benefitEssential benefitBestInClass benefitCompetitive __typename } __typename } __typename }
fragment FeeData on SalaryFee { value rate currencyCode __typename }
fragment CommonSalaryData on SalaryCalculation {
  country { code name notes { name notes __typename } liability { tier link __typename } __typename }
  vatOptions { requiresSalesPercentageToCountry requiresSalesToCountry requiresWorksInCountryOfResidence __typename }
  vatParameters { salesPercentageToCountry salesToCountry worksInCountryOfResidence __typename }
  taxes { employer { ...TaxData __typename } employee { ...TaxData __typename } __typename }
  annualGrossSalary stateOrProvince selectedSalary salaryFrequency
  currency { code name __typename }
  fees { oyster { feeInEngagementSalaryCurrency { ...FeeData __typename } feeInCompanyPaymentCurrency { ...FeeData __typename } companysPlanPrice { ...FeeData __typename } __typename } vat { ...FeeData __typename } __typename }
  totals { netSalary employerCosts __typename }
  __typename
}
query BulkSalaryCalculations($calculationQueries: [SalaryQueryInput!]!) {
  bulkSalaryCalculations(calculationQueries: $calculationQueries) { ...CommonSalaryData __typename }
}`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { salary, country, currency } = body || {}
    if (!salary || !country || !currency) {
      return NextResponse.json({ error: "Missing required fields: salary, country, currency" }, { status: 400 })
    }

    const variables = {
      calculationQueries: [
        {
          annualGrossSalary: Number(salary),
          countryCode: country,
          currencyCode: currency,
          vatParameters: {
            salesPercentageToCountry: null,
            salesToCountry: false,
            worksInCountryOfResidence: false,
          },
        },
      ],
    }

    const payload = {
      operationName: "BulkSalaryCalculations",
      variables,
      query: QUERY,
    }

    const res = await fetch(OYSTER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://web.oysterhr.com",
        "Referer": "https://web.oysterhr.com/",
        "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text || "Failed to fetch Oyster cost" }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Oyster cost route error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

