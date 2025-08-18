import { NextRequest, NextResponse } from "next/server"

const DEEL_API_BASE = "https://api.letsdeel.com/rest/v2"
const HARDCODED_TEAM_ID = "e122d04f-a35f-4418-8066-4b597f05d440"
const HARDCODED_LEGAL_ENTITY_ID = "6646f7e1-7bb1-4e95-b4bf-f94a532f8753"

export async function GET(request: NextRequest) {
  try {
    const token = process.env.DEEL_ORGANIZATION_TOKEN
    if (!token) {
      return NextResponse.json(
        { error: "DEEL_ORGANIZATION_TOKEN not configured" },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const countryCode = searchParams.get("country_code")
    const workVisa = searchParams.get("work_visa")
    const workHoursPerWeek = searchParams.get("work_hours_per_week")
    const employmentType = searchParams.get("employment_type")

    if (!countryCode || !workVisa || !workHoursPerWeek || !employmentType) {
      return NextResponse.json(
        { error: "Missing required parameters: country_code, work_visa, work_hours_per_week, employment_type" },
        { status: 400 }
      )
    }

    const queryParams = new URLSearchParams({
      country_code: countryCode,
      work_visa: workVisa,
      work_hours_per_week: workHoursPerWeek,
      employment_type: employmentType,
      team_id: HARDCODED_TEAM_ID,
      legal_entity_id: HARDCODED_LEGAL_ENTITY_ID,
    })

    const response = await fetch(`${DEEL_API_BASE}/eor/benefits?${queryParams}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Deel Benefits API error:", response.status, errorText)
      return NextResponse.json(
        { error: `Benefits API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error("Benefits API route error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}