import { CurrencyProvider, CurrencyConversionResult } from './currency-provider-interface'

interface RemoteConversionResponse {
  data: {
    conversion_data: {
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
  }
}



export class RemoteCurrencyProvider implements CurrencyProvider {
  getName(): string {
    return 'Remote.com'
  }

  async convertCurrency(
    amount: number,
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<CurrencyConversionResult> {
    try {
      // Handle same currency case
      if (sourceCurrency === targetCurrency) {
        return {
          success: true,
          data: {
            conversion_data: {
              exchange_rate: "1",
              target_currency: {
                code: targetCurrency,
                name: targetCurrency,
                symbol: targetCurrency
              },
              source_currency: {
                code: sourceCurrency,
                name: sourceCurrency,
                symbol: sourceCurrency
              },
              source_amount: amount,
              target_amount: amount
            }
          }
        }
      }

      const roundedAmount = Math.round(Number.parseFloat(amount.toString()))
      
      // Skip conversion for negative amounts - Remote API doesn't accept them
      if (roundedAmount < 0) {
        return {
          success: true,
          data: {
            conversion_data: {
              exchange_rate: "0",
              target_currency: {
                code: targetCurrency,
                name: targetCurrency,
                symbol: targetCurrency
              },
              source_currency: {
                code: sourceCurrency,
                name: sourceCurrency,
                symbol: sourceCurrency
              },
              source_amount: amount,
              target_amount: -1 // Special value to indicate negative/skip
            }
          }
        }
      }

      const requestPayload = {
        amount: roundedAmount,
        source_currency: sourceCurrency,
        target_currency: targetCurrency,
      }

      const options = {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${process.env.REMOTE_API_TOKEN}`,
        },
        body: JSON.stringify(requestPayload),
      }

      const response = await fetch("https://gateway.remote.com/v1/currency-converter", options)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Remote.com API error: ${response.status} - ${errorText}`)
      }

      const data: RemoteConversionResponse = await response.json()
      return {
        success: true,
        data: data.data
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred with Remote.com"
      }
    }
  }
}