import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("=== CURRENCY CONVERTER API CALLED ===")
    const body = await request.json()
    console.log("Request body:", body)
    
    const { amount, source_currency, target_currency } = body
    console.log("Parsed values:", { amount, source_currency, target_currency })

    if (!amount || !source_currency || !target_currency) {
      console.log("Missing required fields!")
      return NextResponse.json(
        { error: "Missing required fields: amount, source_currency, target_currency" }, 
        { status: 400 }
      )
    }

    // If currencies are the same, return without API call
    if (source_currency === target_currency) {
      console.log("Same currency, returning 1:1 conversion")
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

    console.log("Making Remote API call...")
    console.log("API Token exists:", !!process.env.REMOTE_API_TOKEN)


    const roundedAmount = Math.round(Number.parseFloat(amount))
    
    // Skip conversion for negative amounts - Remote API doesn't accept them
    if (roundedAmount < 0) {
      console.log("Negative amount detected, returning --- placeholder")
      return NextResponse.json({
        data: {
          conversion_data: {
            exchange_rate: "0",
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
            target_amount: -1 // Special value to indicate negative/skip
          }
        }
      })
    }

    const requestPayload = {
      amount: roundedAmount,
      source_currency,
      target_currency,
    }
    
    console.log("Remote API request payload:", requestPayload)

    const options = {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${process.env.REMOTE_API_TOKEN}`,
      },
      body: JSON.stringify(requestPayload),
    }

    console.log("Making request to: https://gateway.remote.com/v1/currency-converter")
    const response = await fetch("https://gateway.remote.com/v1/currency-converter", options)
    console.log("Remote API response status:", response.status)
    console.log("Remote API response ok:", response.ok)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Remote Currency Converter API Error status:", response.status)
      console.error("Remote Currency Converter API Error response:", errorText)
      console.error("Request that failed:", requestPayload)
      return NextResponse.json(
        { error: "Failed to convert currency" }, 
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log("Remote API success response:", data)
    console.log("=== CURRENCY CONVERTER API SUCCESS ===")
    return NextResponse.json(data)
  } catch (error) {
    console.error("=== CURRENCY CONVERTER API CRASHED ===")
    console.error("Currency Converter API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
