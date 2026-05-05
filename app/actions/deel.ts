'use server'

const DEEL_ENDPOINT = "https://api.letsdeel.com/rest/v2/eor/employment_cost"

function mapCountryNameForDeel(countryName: string): string {
  const countryMapping: Record<string, string> = {
    "United States of America": "United States",
    "United Kingdom of Great Britain and Northern Ireland": "United Kingdom",
    "Russian Federation": "Russia",
    "Iran (Islamic Republic of)": "Iran",
    "Korea (Republic of)": "South Korea",
    "Korea (Democratic People's Republic of)": "North Korea",
    "Venezuela (Bolivarian Republic of)": "Venezuela",
    "Bolivia (Plurinational State of)": "Bolivia",
    "Tanzania (United Republic of)": "Tanzania",
    "Moldova (Republic of)": "Moldova",
    "Macedonia (the former Yugoslav Republic of)": "North Macedonia",
    "Congo (Democratic Republic of the)": "Democratic Republic of the Congo",
    Congo: "Republic of the Congo",
    "Côte d'Ivoire": "Ivory Coast",
    Czechia: "Czech Republic",
    Eswatini: "Swaziland",
    "Holy See": "Vatican City",
    "Lao People's Democratic Republic": "Laos",
    Myanmar: "Burma",
    "Palestine, State of": "Palestine",
    "Syrian Arab Republic": "Syria",
    "Timor-Leste": "East Timor",
    Türkiye: "Turkey",
    "Viet Nam": "Vietnam",
  }

  return countryMapping[countryName] || countryName
}

export interface DeelCostInput {
  salary: string | number
  country: string
  currency: string
  state?: string
}

interface DeelRequestBody {
  data: {
    salary: number
    country: string
    currency: string
    state?: string
  }
}

export async function fetchDeelCostAction(input: DeelCostInput): Promise<unknown> {
  const { salary, country, currency, state } = input || ({} as DeelCostInput)

  if (!salary || !country || !currency) {
    throw new Error("Missing required fields: salary, country, currency")
  }

  const token = process.env.DEEL_ORGANIZATION_TOKEN
  if (!token) {
    throw new Error("Server misconfiguration: missing DEEL_ORGANIZATION_TOKEN")
  }

  const parsedSalary = Number.parseFloat(String(salary))
  if (!Number.isFinite(parsedSalary) || parsedSalary <= 0) {
    throw new Error("Invalid salary amount")
  }

  const mappedCountry = mapCountryNameForDeel(country)

  const requestBody: DeelRequestBody = {
    data: {
      salary: parsedSalary,
      country: mappedCountry,
      currency,
    },
  }

  if (state) {
    requestBody.data.state = state
  }

  try {
    const response = await fetch(DEEL_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.text().catch(() => "")
      console.error("Deel API Error:", response.status, errorData)
      throw new Error(`Deel API error (${response.status}): ${errorData || "Failed to get cost estimate from Deel API"}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Deel cost action error:", error)
    if (error instanceof Error) throw error
    throw new Error("Internal server error")
  }
}
