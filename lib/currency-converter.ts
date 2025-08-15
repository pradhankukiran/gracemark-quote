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

interface ConversionResponse {
  data: {
    conversion_data: ConversionData
  }
}

interface ConversionError {
  error: string
}

export interface CurrencyConversionResult {
  success: boolean
  data?: ConversionData
  error?: string
}

export async function convertCurrency(
  amount: number,
  sourceCurrency: string,
  targetCurrency: string
): Promise<CurrencyConversionResult> {
  try {
    const response = await fetch("/api/currency-converter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        source_currency: sourceCurrency,
        target_currency: targetCurrency,
      }),
    })

    if (!response.ok) {
      const errorData: ConversionError = await response.json()
      return {
        success: false,
        error: errorData.error || "Failed to convert currency",
      }
    }

    const result: ConversionResponse = await response.json()
    return {
      success: true,
      data: result.data.conversion_data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

export function formatCurrency(amount: number, currencyCode: string, symbol?: string): string {
  const formattedAmount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
  
  return symbol ? `${symbol}${formattedAmount}` : `${formattedAmount} ${currencyCode}`
}

export function formatConversionDisplay(conversionData: ConversionData): string {
  const { source_amount, source_currency, target_amount, target_currency, exchange_rate } = conversionData
  
  return `Converted from ${formatCurrency(source_amount, source_currency.code, source_currency.symbol)} at rate ${exchange_rate}`
}