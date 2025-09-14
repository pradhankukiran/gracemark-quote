import { type NextRequest, NextResponse } from "next/server"
import { PapayaCurrencyProvider } from "@/lib/providers/papaya-currency-provider"
import { RemoteCurrencyProvider } from "@/lib/providers/remote-currency-provider"
import { ExchangerateCurrencyProvider } from "@/lib/providers/exchangerate-currency-provider"

export async function POST(request: NextRequest) {
  try {
    // console.log("=== CURRENCY CONVERTER API CALLED ===")
    const body = await request.json()
    // console.log("Request body:", body)
    
    const { amount, source_currency, target_currency } = body
    // console.log("Parsed values:", { amount, source_currency, target_currency })

    const numericAmount = Number(amount)
    if (!source_currency || !target_currency || Number.isNaN(numericAmount)) {
      // console.log("Missing or invalid fields!")
      return NextResponse.json(
        { error: "Missing or invalid fields: amount, source_currency, target_currency" }, 
        { status: 400 }
      )
    }

    // Fast-path zero amounts to avoid provider calls and 400s
    if (numericAmount === 0) {
      return NextResponse.json({
        data: {
          conversion_data: {
            exchange_rate: "1",
            target_currency: { code: target_currency, name: target_currency, symbol: target_currency },
            source_currency: { code: source_currency, name: source_currency, symbol: source_currency },
            source_amount: 0,
            target_amount: 0,
          }
        }
      })
    }

    // Initialize providers
    const papayaProvider = new PapayaCurrencyProvider()
    const remoteProvider = new RemoteCurrencyProvider()
    const exchangerateProvider = new ExchangerateCurrencyProvider()

    // Always try Papaya Global first (primary provider)
    // console.log("Trying Papaya Global provider...")
    let result = await papayaProvider.convertCurrency(amount, source_currency, target_currency)

    // If Papaya Global fails, fallback to Remote.com
    if (!result.success) {
      // console.log("Papaya Global failed, falling back to Remote.com provider...")
      // console.log("Papaya error:", result.error)
      result = await remoteProvider.convertCurrency(amount, source_currency, target_currency)
      
      if (result.success) {
        // console.log("Remote.com fallback successful")
      } else {
        // console.log("Remote.com fallback also failed:", result.error)
        // console.log("Trying Exchangerate.host as last-resort provider...")
        result = await exchangerateProvider.convertCurrency(amount, source_currency, target_currency)
        if (result.success) {
          // console.log("Exchangerate.host fallback successful")
        } else {
          // console.log("Exchangerate.host also failed:", result.error)
        }
      }
    } else {
      // console.log("Papaya Global conversion successful")
    }

    // Return result or error
    if (result.success && result.data) {
      // console.log("=== CURRENCY CONVERTER API SUCCESS ===")
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
