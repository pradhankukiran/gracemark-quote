import { type NextRequest, NextResponse } from "next/server"
import { PapayaCurrencyProvider } from "@/lib/providers/papaya-currency-provider"
import { RemoteCurrencyProvider } from "@/lib/providers/remote-currency-provider"

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

    // Initialize providers
    const papayaProvider = new PapayaCurrencyProvider()
    const remoteProvider = new RemoteCurrencyProvider()

    // Always try Papaya Global first (primary provider)
    console.log("Trying Papaya Global provider...")
    let result = await papayaProvider.convertCurrency(amount, source_currency, target_currency)

    // If Papaya Global fails, fallback to Remote.com
    if (!result.success) {
      console.log("Papaya Global failed, falling back to Remote.com provider...")
      console.log("Papaya error:", result.error)
      result = await remoteProvider.convertCurrency(amount, source_currency, target_currency)
      
      if (result.success) {
        console.log("Remote.com fallback successful")
      } else {
        console.log("Remote.com fallback also failed:", result.error)
      }
    } else {
      console.log("Papaya Global conversion successful")
    }

    // Return result or error
    if (result.success && result.data) {
      console.log("=== CURRENCY CONVERTER API SUCCESS ===")
      return NextResponse.json({ data: result.data })
    } else {
      console.error("=== ALL CURRENCY PROVIDERS FAILED ===")
      console.error("Final error:", result.error)
      return NextResponse.json(
        { error: result.error || "All currency conversion providers failed" }, 
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("=== CURRENCY CONVERTER API CRASHED ===")
    console.error("Currency Converter API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
