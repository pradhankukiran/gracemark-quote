import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, source_currency, target_currency } = body

    if (!amount || !source_currency || !target_currency) {
      return NextResponse.json(
        { error: "Missing required fields: amount, source_currency, target_currency" }, 
        { status: 400 }
      )
    }

    // If currencies are the same, return without API call
    if (source_currency === target_currency) {
      return NextResponse.json({
        data: {
          conversion_data: {
            exchange_rate: "1",
            target_currency: {
              code: target_currency,
              name: target_currency,
              symbol: target_currency
            },
            source_currency: {
              code: source_currency,
              name: source_currency,
              symbol: source_currency
            },
            source_amount: amount,
            target_amount: amount
          }
        }
      })
    }

    const options = {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${process.env.REMOTE_API_TOKEN}`,
      },
      body: JSON.stringify({
        amount: Number.parseFloat(amount),
        source_currency,
        target_currency,
      }),
    }

    const response = await fetch("https://gateway.remote.com/v1/currency-converter", options)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Remote Currency Converter API Error:", errorText)
      return NextResponse.json(
        { error: "Failed to convert currency" }, 
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Currency Converter API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
