import { CurrencyProvider, CurrencyConversionResult } from './currency-provider-interface'

interface ExchangerateResponse {
  success: boolean
  query?: { from: string; to: string; amount: number }
  info?: { rate: number }
  result?: number
  error?: unknown
}

export class ExchangerateCurrencyProvider implements CurrencyProvider {
  getName(): string {
    return 'Exchangerate.host'
  }

  async convertCurrency(
    amount: number,
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<CurrencyConversionResult> {
    try {
      // Same-currency fast path
      if (sourceCurrency === targetCurrency) {
        return {
          success: true,
          data: {
            conversion_data: {
              exchange_rate: '1',
              target_currency: { code: targetCurrency, name: targetCurrency, symbol: targetCurrency },
              source_currency: { code: sourceCurrency, name: sourceCurrency, symbol: sourceCurrency },
              source_amount: amount,
              target_amount: amount,
            },
          },
        }
      }

      const url = `https://api.exchangerate.host/convert?from=${encodeURIComponent(sourceCurrency)}&to=${encodeURIComponent(targetCurrency)}&amount=${encodeURIComponent(Math.abs(amount))}`
      const resp = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`Exchangerate.host error: ${resp.status} ${text}`)
      }
      const data: ExchangerateResponse = await resp.json()
      if (!data.success || typeof data.result !== 'number') {
        throw new Error('Invalid response from Exchangerate.host')
      }

      const rate = data.info?.rate ?? (data.result / (data.query?.amount || 1))
      const targetAmount = amount < 0 ? -1 : data.result

      return {
        success: true,
        data: {
          conversion_data: {
            exchange_rate: String(rate ?? ''),
            target_currency: { code: targetCurrency, name: targetCurrency, symbol: targetCurrency },
            source_currency: { code: sourceCurrency, name: sourceCurrency, symbol: sourceCurrency },
            source_amount: amount,
            target_amount: targetAmount,
          },
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred with Exchangerate.host',
      }
    }
  }
}

