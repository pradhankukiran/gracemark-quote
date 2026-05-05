'use server'

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

export interface OysterCostInput {
  salary: number | string
  country: string
  currency: string
}

export async function fetchOysterCostAction(input: OysterCostInput): Promise<unknown> {
  const { salary, country, currency } = input || ({} as OysterCostInput)
  if (!salary || !country || !currency) {
    throw new Error("Missing required fields: salary, country, currency")
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

  try {
    const res = await fetch(OYSTER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://web.oysterhr.com",
        "Referer": "https://web.oysterhr.com/",
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || "Failed to fetch Oyster cost")
    }

    return await res.json()
  } catch (error) {
    console.error("Oyster cost action error:", error)
    if (error instanceof Error) throw error
    throw new Error("Unknown error")
  }
}
