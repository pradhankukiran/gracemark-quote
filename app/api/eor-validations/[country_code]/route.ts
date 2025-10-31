import { type NextRequest, NextResponse } from "next/server"

// Next.js 15 passes params as an async value; type accordingly
export async function GET(request: NextRequest, { params }: { params: Promise<{ country_code: string }> }) {
  try {
    const { country_code } = await params

    if (!country_code) {
      return NextResponse.json({ error: "Missing required parameter: country_code" }, { status: 400 })
    }

    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${process.env.DEEL_ORGANIZATION_TOKEN}`,
      },
    }

    const response = await fetch(`https://api.letsdeel.com/rest/v2/eor/validations/${country_code}`, options)

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Deel Validations API Error:", errorData)
      return NextResponse.json({ error: "Failed to get validations from Deel API" }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("EOR Validations API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
