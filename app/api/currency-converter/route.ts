import { type NextRequest, NextResponse } from "next/server"
import { PapayaCurrencyProvider } from "@/lib/providers/papaya-currency-provider"
import { ExchangerateApiCurrencyProvider } from "@/lib/providers/exchangerate-api-currency-provider"
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
    const exchangerateApiProvider = new ExchangerateApiCurrencyProvider()
    const remoteProvider = new RemoteCurrencyProvider()
    const exchangerateProvider = new ExchangerateCurrencyProvider()

    // Kick off Papaya and Exchangerate-API in parallel so we don't block unnecessarily
    const primaryPromises = [
      papayaProvider.convertCurrency(amount, source_currency, target_currency),
      exchangerateApiProvider.convertCurrency(amount, source_currency, target_currency),
    ]

    const primaryResults = await Promise.allSettled(primaryPromises)

    let result: Awaited<typeof primaryPromises[number]> | null = null
    const primaryErrors: string[] = []
    let usedProvider: string | null = null

    for (let i = 0; i < primaryResults.length; i++) {
      const settled = primaryResults[i]
      const providerName = i === 0 ? 'Papaya' : 'Exchangerate-API'

      if (settled.status === "fulfilled") {
        if (settled.value.success && settled.value.data) {
          result = settled.value
          usedProvider = providerName
          console.log(`✓ Using ${providerName} for ${source_currency} → ${target_currency}`)
          break
        }
        if (settled.value.error) {
          console.warn(`✗ ${providerName} failed: ${settled.value.error}`)
          primaryErrors.push(settled.value.error)
        }
      } else if (settled.reason) {
        console.warn(`✗ ${providerName} rejected: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`)
        primaryErrors.push(settled.reason instanceof Error ? settled.reason.message : String(settled.reason))
      }
    }

    // If neither Papaya nor Exchangerate-API produced a usable rate, fall back
    if (!result) {
      console.warn('Primary providers failed, trying fallbacks...')
      let fallbackErrors = primaryErrors.slice()

      const remoteResult = await remoteProvider.convertCurrency(amount, source_currency, target_currency)
      if (remoteResult.success && remoteResult.data) {
        result = remoteResult
        usedProvider = 'Remote'
        console.log(`✓ Using Remote (fallback) for ${source_currency} → ${target_currency}`)
      } else {
        if (remoteResult.error) {
          console.warn(`✗ Remote failed: ${remoteResult.error}`)
          fallbackErrors.push(remoteResult.error)
        }
        const exchangerateResult = await exchangerateProvider.convertCurrency(amount, source_currency, target_currency)
        result = exchangerateResult
        if (exchangerateResult.success) {
          usedProvider = 'Exchangerate'
          console.log(`✓ Using Exchangerate (fallback) for ${source_currency} → ${target_currency}`)
        } else if (exchangerateResult.error) {
          console.warn(`✗ Exchangerate failed: ${exchangerateResult.error}`)
          fallbackErrors.push(exchangerateResult.error)
        }

        if (!exchangerateResult.success) {
          // include all accumulated errors for context
          result = {
            success: false,
            error: fallbackErrors.join(" | ") || "All currency conversion providers failed",
          }
        }
      }
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
