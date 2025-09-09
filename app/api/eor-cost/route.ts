import { type NextRequest, NextResponse } from "next/server"

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

interface DeelRequestBody {
  data: {
    salary: number;
    country: string;
    currency: string;
    state?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    let parsed: { salary?: number; country?: string; currency?: string; state?: string }
    try {
      parsed = await request.json()
    } catch {
      console.error('EOR Cost API Error: invalid JSON body')
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { salary, country, currency, state } = parsed
    console.log('Deel API - Incoming request:', { salary, country, currency, state })

    if (!salary || !country || !currency) {
      return NextResponse.json({ error: "Missing required fields: salary, country, currency" }, { status: 400 })
    }

    const mappedCountry = mapCountryNameForDeel(country)

    const requestBody: DeelRequestBody = {
      data: {
        salary: Number.parseFloat(salary),
        country: mappedCountry,
        currency,
      },
    }

    // Add state if provided
    if (state) {
      requestBody.data.state = state
    }

    const options = {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${process.env.DEEL_ORGANIZATION_TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    }

    const response = await fetch("https://api.letsdeel.com/rest/v2/eor/employment_cost", options)

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Deel API Error:", errorData)
      return NextResponse.json({ error: "Failed to get cost estimate from Deel API" }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("EOR Cost API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
