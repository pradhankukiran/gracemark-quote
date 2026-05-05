'use server'

import { PapayaCurrencyProvider } from "@/lib/providers/papaya-currency-provider"
import { ExchangerateApiCurrencyProvider } from "@/lib/providers/exchangerate-api-currency-provider"
import { RemoteCurrencyProvider } from "@/lib/providers/remote-currency-provider"
import { ExchangerateCurrencyProvider } from "@/lib/providers/exchangerate-currency-provider"

interface ConversionData {
  exchange_rate: string
  target_currency: {
    code: string
    name: string
    symbol: string
  }
  source_currency: {
    code: string
    name: string
    symbol: string
  }
  source_amount: number
  target_amount: number
}

export interface CurrencyConversionResult {
  success: boolean
  data?: ConversionData
  error?: string
}

export async function convertCurrencyAction(
  amount: number,
  sourceCurrency: string,
  targetCurrency: string
): Promise<CurrencyConversionResult> {
  try {
    const numericAmount = Number(amount)
    if (!sourceCurrency || !targetCurrency || Number.isNaN(numericAmount)) {
      return {
        success: false,
        error: "Missing or invalid fields: amount, source_currency, target_currency",
      }
    }

    // Fast-path zero amounts to avoid provider calls and 400s
    if (numericAmount === 0) {
      return {
        success: true,
        data: {
          exchange_rate: "1",
          target_currency: { code: targetCurrency, name: targetCurrency, symbol: targetCurrency },
          source_currency: { code: sourceCurrency, name: sourceCurrency, symbol: sourceCurrency },
          source_amount: 0,
          target_amount: 0,
        },
      }
    }

    // Initialize providers
    const papayaProvider = new PapayaCurrencyProvider()
    const exchangerateApiProvider = new ExchangerateApiCurrencyProvider()
    const remoteProvider = new RemoteCurrencyProvider()
    const exchangerateProvider = new ExchangerateCurrencyProvider()

    // Kick off Papaya and Exchangerate-API in parallel so we don't block unnecessarily
    const primaryPromises = [
      papayaProvider.convertCurrency(amount, sourceCurrency, targetCurrency),
      exchangerateApiProvider.convertCurrency(amount, sourceCurrency, targetCurrency),
    ]

    const primaryResults = await Promise.allSettled(primaryPromises)

    let result: Awaited<typeof primaryPromises[number]> | null = null
    const primaryErrors: string[] = []

    for (const settled of primaryResults) {
      if (settled.status === "fulfilled") {
        if (settled.value.success && settled.value.data) {
          result = settled.value
          break
        }
        if (settled.value.error) {
          primaryErrors.push(settled.value.error)
        }
      } else if (settled.reason) {
        primaryErrors.push(settled.reason instanceof Error ? settled.reason.message : String(settled.reason))
      }
    }

    // If neither Papaya nor Exchangerate-API produced a usable rate, fall back
    if (!result) {
      const fallbackErrors = primaryErrors.slice()

      const remoteResult = await remoteProvider.convertCurrency(amount, sourceCurrency, targetCurrency)
      if (remoteResult.success && remoteResult.data) {
        result = remoteResult
      } else {
        if (remoteResult.error) {
          fallbackErrors.push(remoteResult.error)
        }
        const exchangerateResult = await exchangerateProvider.convertCurrency(amount, sourceCurrency, targetCurrency)
        result = exchangerateResult
        if (!exchangerateResult.success && exchangerateResult.error) {
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

    // Return result or error (unwrap provider's data.conversion_data into flat data)
    if (result.success && result.data) {
      return {
        success: true,
        data: result.data.conversion_data,
      }
    } else {
      console.error("=== ALL CURRENCY PROVIDERS FAILED ===")
      console.error("Final error:", result.error)
      return {
        success: false,
        error: result.error || "All currency conversion providers failed",
      }
    }
  } catch (error) {
    console.error("=== CURRENCY CONVERTER ACTION CRASHED ===")
    console.error("Currency Converter Action Error:", error)
    return {
      success: false,
      error: "Internal server error",
    }
  }
}
