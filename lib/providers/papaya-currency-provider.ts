import { CurrencyProvider, CurrencyConversionResult } from './currency-provider-interface'

const PAPAYA_TIMEOUT_MS = 5000
const PAPAYA_CACHE_TTL_MS = 5 * 60 * 1000

interface CachedRate {
  rate: number
  expiresAt: number
}

const rateCache = new Map<string, CachedRate>()
const pendingRequests = new Map<string, Promise<number>>()

const buildCacheKey = (source: string, target: string) => {
  return `${source.trim().toUpperCase()}_${target.trim().toUpperCase()}`
}

const extractRate = (raw: string): number => {
  const sanitized = raw.replace(',', '.').trim()
  const matches = sanitized.match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g)
  if (!matches || matches.length === 0) {
    throw new Error(`No numeric rate found in Papaya response: ${raw}`)
  }

  // Use the last numeric token; Papaya sometimes prefixes the response with descriptive text.
  const candidate = parseFloat(matches[matches.length - 1])
  if (!Number.isFinite(candidate) || candidate <= 0) {
    throw new Error(`Invalid rate received from Papaya Global: ${raw}`)
  }
  return candidate
}

const fetchPapayaRate = async (sourceCurrency: string, targetCurrency: string): Promise<number> => {
  const cacheKey = buildCacheKey(sourceCurrency, targetCurrency)
  const cached = rateCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rate
  }

  const existingRequest = pendingRequests.get(cacheKey)
  if (existingRequest) {
    return existingRequest
  }

  const url = `https://www.papayaglobal.com/wp-content/plugins/wp-create-react-app/json.php?query=${cacheKey}&from=${sourceCurrency}&to=${targetCurrency}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PAPAYA_TIMEOUT_MS)

  const requestPromise = (async () => {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
          'Referer': 'https://www.papayaglobal.com/',
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Papaya Global API error: ${response.status} ${response.statusText}`)
      }

      const body = await response.text()
      const rate = extractRate(body)
      rateCache.set(cacheKey, { rate, expiresAt: Date.now() + PAPAYA_CACHE_TTL_MS })
      return rate
    } finally {
      clearTimeout(timeout)
      pendingRequests.delete(cacheKey)
    }
  })()

  pendingRequests.set(cacheKey, requestPromise)
  return requestPromise
}

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
      if (sourceCurrency === targetCurrency) {
        return {
          success: true,
          data: {
            conversion_data: {
              exchange_rate: '1',
              target_currency: {
                code: targetCurrency,
                name: targetCurrency,
                symbol: targetCurrency,
              },
              source_currency: {
                code: sourceCurrency,
                name: sourceCurrency,
                symbol: sourceCurrency,
              },
              source_amount: amount,
              target_amount: amount,
            },
          },
        }
      }

      if (amount < 0) {
        return {
          success: true,
          data: {
            conversion_data: {
              exchange_rate: '0',
              target_currency: {
                code: targetCurrency,
                name: targetCurrency,
                symbol: targetCurrency,
              },
              source_currency: {
                code: sourceCurrency,
                name: sourceCurrency,
                symbol: sourceCurrency,
              },
              source_amount: amount,
              target_amount: -1,
            },
          },
        }
      }

      const rate = await fetchPapayaRate(sourceCurrency, targetCurrency)
      const targetAmount = amount * rate

      return {
        success: true,
        data: {
          conversion_data: {
            exchange_rate: rate.toString(),
            target_currency: {
              code: targetCurrency,
              name: targetCurrency,
              symbol: targetCurrency,
            },
            source_currency: {
              code: sourceCurrency,
              name: sourceCurrency,
              symbol: sourceCurrency,
            },
            source_amount: amount,
            target_amount: targetAmount,
          },
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred with Papaya Global'
      return {
        success: false,
        error: message,
      }
    }
  }
}
