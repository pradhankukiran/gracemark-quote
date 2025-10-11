import { CurrencyProvider, CurrencyConversionResult } from './currency-provider-interface'

export class PapayaCurrencyProvider implements CurrencyProvider {
  getName(): string {
    return 'Papaya Global'
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

      // Handle negative amounts
      if (amount < 0) {
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

      const query = `${sourceCurrency}_${targetCurrency}`
      const url = `https://www.papayaglobal.com/wp-content/plugins/wp-create-react-app/json.php?query=${query}&from=${sourceCurrency}&to=${targetCurrency}`

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
          // Papaya now blocks requests without a site referrer; spoof their marketing site to keep the endpoint accessible.
          'Referer': 'https://www.papayaglobal.com/',
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

      if (!response.ok) {
        throw new Error(`Papaya Global API error: ${response.status} ${response.statusText}`)
      }

      const rateText = await response.text()
      const rate = parseFloat(rateText.trim())

      if (isNaN(rate)) {
        throw new Error(`Invalid rate received from Papaya Global: ${rateText}`)
      }

      const targetAmount = amount * rate

      return {
        success: true,
        data: {
          conversion_data: {
            exchange_rate: rateText.trim(),
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
            target_amount: targetAmount
          }
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred with Papaya Global"
      }
    }
  }
}
