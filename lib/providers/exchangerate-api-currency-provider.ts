import { CurrencyProvider, CurrencyConversionResult } from "./currency-provider-interface"

const EXCHANGERATE_TIMEOUT_MS = 5000
const EXCHANGERATE_CACHE_TTL_MS = 10 * 60 * 1000

interface CachedRate {
  rate: number
  expiresAt: number
}

const rateCache = new Map<string, CachedRate>()
const inflightRequests = new Map<string, Promise<number>>()

const buildCacheKey = (source: string, target: string) => {
  return `${source.trim().toUpperCase()}_${target.trim().toUpperCase()}`
}

const fetchRateFromApi = async (sourceCurrency: string, targetCurrency: string): Promise<number> => {
  const cacheKey = buildCacheKey(sourceCurrency, targetCurrency)

  const cached = rateCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rate
  }

  const inflight = inflightRequests.get(cacheKey)
  if (inflight) {
    return inflight
  }

  const apiKey = process.env.EXCHANGERATE_API_KEY?.trim()
  const normalizedSource = sourceCurrency.trim().toUpperCase()
  const normalizedTarget = targetCurrency.trim().toUpperCase()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), EXCHANGERATE_TIMEOUT_MS)

  const requestPromise = (async () => {
    try {
      let rate: number | undefined

      if (apiKey) {
        // Preferred: Exchangerate API v6 pair endpoint when an API key is available
        const pairUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${normalizedSource}/${normalizedTarget}`
        const pairResp = await fetch(pairUrl, {
          headers: { accept: "application/json" },
          signal: controller.signal,
        })

        if (!pairResp.ok) {
          const errorText = await pairResp.text()
          throw new Error(`Exchangerate API v6 error: ${pairResp.status} - ${errorText}`)
        }

        const pairData: { conversion_rate?: number } = await pairResp.json()
        if (typeof pairData.conversion_rate === "number" && pairData.conversion_rate > 0) {
          rate = pairData.conversion_rate
        }
      }

      if (rate === undefined) {
        // Fallback: legacy v4 endpoint (no key required)
        const latestUrl = `https://api.exchangerate-api.com/v4/latest/${normalizedSource}`
        const latestResp = await fetch(latestUrl, {
          headers: { accept: "application/json" },
          signal: controller.signal,
        })

        if (!latestResp.ok) {
          const errorText = await latestResp.text()
          throw new Error(`Exchangerate API v4 error: ${latestResp.status} - ${errorText}`)
        }

        const latestData: { rates?: Record<string, number> } = await latestResp.json()
        rate = latestData.rates?.[normalizedTarget]
      }

      if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
        throw new Error(`Failed to resolve exchangerate for ${normalizedSource} -> ${normalizedTarget}`)
      }

      rateCache.set(cacheKey, { rate, expiresAt: Date.now() + EXCHANGERATE_CACHE_TTL_MS })
      return rate
    } finally {
      clearTimeout(timeoutId)
      inflightRequests.delete(cacheKey)
    }
  })()

  inflightRequests.set(cacheKey, requestPromise)
  return requestPromise
}

export class ExchangerateApiCurrencyProvider implements CurrencyProvider {
  getName(): string {
    return "Exchangerate-API"
  }

  async convertCurrency(
    amount: number,
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<CurrencyConversionResult> {
    try {
      const normalizedSource = sourceCurrency.trim().toUpperCase()
      const normalizedTarget = targetCurrency.trim().toUpperCase()

      if (normalizedSource === normalizedTarget) {
        return {
          success: true,
          data: {
            conversion_data: {
              exchange_rate: "1",
              target_currency: {
                code: normalizedTarget,
                name: normalizedTarget,
                symbol: normalizedTarget,
              },
              source_currency: {
                code: normalizedSource,
                name: normalizedSource,
                symbol: normalizedSource,
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
              exchange_rate: "0",
              target_currency: {
                code: normalizedTarget,
                name: normalizedTarget,
                symbol: normalizedTarget,
              },
              source_currency: {
                code: normalizedSource,
                name: normalizedSource,
                symbol: normalizedSource,
              },
              source_amount: amount,
              target_amount: -1,
            },
          },
        }
      }

      const rate = await fetchRateFromApi(normalizedSource, normalizedTarget)
      const targetAmount = amount * rate

      return {
        success: true,
        data: {
          conversion_data: {
            exchange_rate: rate.toString(),
            target_currency: {
              code: normalizedTarget,
              name: normalizedTarget,
              symbol: normalizedTarget,
            },
            source_currency: {
              code: normalizedSource,
              name: normalizedSource,
              symbol: normalizedSource,
            },
            source_amount: amount,
            target_amount: targetAmount,
          },
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred with Exchangerate-API"
      return {
        success: false,
        error: message,
      }
    }
  }
}
