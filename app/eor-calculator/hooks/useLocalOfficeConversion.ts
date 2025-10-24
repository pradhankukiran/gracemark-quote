import { useState, useEffect, useRef, useMemo } from "react"
import { convertCurrency } from "@/lib/currency-converter"
import { LocalOfficeInfo } from "@/lib/shared/types"
import { getFieldCurrency } from "@/lib/shared/utils/localOfficeData"
import { getCurrencyForCountry } from "@/lib/country-data"

interface ConvertedLocalOfficeData {
  [key: string]: string
}

interface UseLocalOfficeConversionResult {
  convertedLocalOffice: ConvertedLocalOfficeData
  isConvertingLocalOffice: boolean
  isLocalOfficeReady: boolean
  conversionKey: string
  convertedForKey: string
}

interface UseLocalOfficeConversionProps {
  originalData: LocalOfficeInfo | null
  countryCode: string | null
  formCurrency: string
  isCurrencyManuallySet: boolean
  originalCurrency?: string | null
  scopeId?: string
}

export const useLocalOfficeConversion = ({
  originalData,
  countryCode,
  formCurrency,
  isCurrencyManuallySet,
  originalCurrency,
  scopeId = 'primary',
}: UseLocalOfficeConversionProps): UseLocalOfficeConversionResult => {
  const [convertedLocalOffice, setConvertedLocalOffice] = useState<ConvertedLocalOfficeData>({})
  const [isConvertingLocalOffice, setIsConvertingLocalOffice] = useState(false)
  const [convertedForKey, setConvertedForKey] = useState<string>('')
  const conversionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastConversionKeyRef = useRef<string>('')
  const conversionRateCacheRef = useRef<Map<string, number>>(new Map())

  // Create stable conversion key from primitive values only
  const conversionKey = useMemo(() => {
    if (!countryCode || !formCurrency) return ''
    return `${scopeId}:${countryCode}-${formCurrency}-${isCurrencyManuallySet}`
  }, [countryCode, formCurrency, isCurrencyManuallySet, scopeId])

  // Convert local office data when currency is overridden or when country changes
  useEffect(() => {
    // Skip if conversion key hasn't changed
    if (conversionKey === lastConversionKeyRef.current) {
      return
    }
    lastConversionKeyRef.current = conversionKey

    // Create AbortController for this conversion cycle
    const abortController = new AbortController()

    const convertLocalOfficeData = async () => {
      if (!originalData || !countryCode) {
        setConvertedLocalOffice({})
        setConvertedForKey('')
        setIsConvertingLocalOffice(false)
        return
      }

      // Reset converted values so stale data isn't applied during a new conversion cycle
      setConvertedLocalOffice({})
      setConvertedForKey('')

      // If currency is manually set, convert from USD/local to the form currency
      // If not manually set, convert from original (USD or local) to the country's default currency (which should be formCurrency)
      const targetCurrency = formCurrency

      setIsConvertingLocalOffice(true)

      // Clear any existing timeout
      if (conversionTimeoutRef.current) {
        clearTimeout(conversionTimeoutRef.current)
      }

      // Set a timeout to prevent indefinite waiting
      conversionTimeoutRef.current = setTimeout(() => {
        if (!abortController.signal.aborted) {
          console.warn('Local office conversion timeout - falling back to original data')
          setIsConvertingLocalOffice(false)
          setConvertedLocalOffice({})
        }
      }, 10000) // 10 second timeout

      try {
        const conversions: ConvertedLocalOfficeData = {}
        const convertibleFields: Array<keyof LocalOfficeInfo> = [
          'mealVoucher',
          'transportation',
          'wfh',
          'healthInsurance',
          'monthlyPaymentsToLocalOffice',
          'preEmploymentMedicalTest',
          'drugTest',
          'backgroundCheckViaDeel',
        ]

        const baseLocalCurrency = (() => {
          if (!countryCode) return null
          try {
            const derived = getCurrencyForCountry(countryCode)
            if (derived?.trim()) {
              return derived.trim().toUpperCase()
            }
          } catch (error) {
            console.warn('Failed to determine primary local currency:', error)
          }
          if (originalCurrency && originalCurrency.trim()) {
            return originalCurrency.trim().toUpperCase()
          }
          return null
        })()
        const normalizedTargetCurrency = targetCurrency.trim().toUpperCase()

        const conversionRateCache = conversionRateCacheRef.current
        const ratePromiseCache = new Map<string, Promise<number | null>>()

        const getConversionRate = async (sourceCurrency: string, targetCurrency: string): Promise<number | null> => {
          const normalizedSource = sourceCurrency.trim().toUpperCase()
          const normalizedTarget = targetCurrency.trim().toUpperCase()

          if (!normalizedSource || !normalizedTarget) {
            return null
          }

          if (normalizedSource === normalizedTarget) {
            return 1
          }

          const cacheKey = `${normalizedSource}->${normalizedTarget}`
          if (conversionRateCache.has(cacheKey)) {
            return conversionRateCache.get(cacheKey) as number
          }

          if (ratePromiseCache.has(cacheKey)) {
            return ratePromiseCache.get(cacheKey) as Promise<number | null>
          }

          const promise = (async () => {
            try {
              const result = await convertCurrency(1, normalizedSource, normalizedTarget, abortController.signal)
              if (abortController.signal.aborted) {
                return null
              }

              if (result.success && result.data && typeof result.data.target_amount === 'number') {
                const rate = result.data.target_amount
                if (Number.isFinite(rate) && rate > 0) {
                  conversionRateCache.set(cacheKey, rate)
                  return rate
                }
                console.warn(`Invalid conversion rate received for ${cacheKey}:`, rate)
                return null
              }

              console.warn(`Failed to convert rate ${cacheKey}:`, result.error)
              return null
            } catch (error) {
              if (!abortController.signal.aborted) {
                console.warn(`Error fetching conversion rate for ${cacheKey}:`, error)
              }
              return null
            } finally {
              ratePromiseCache.delete(cacheKey)
            }
          })()

          ratePromiseCache.set(cacheKey, promise)
          return promise
        }

        let usdToTargetRate: number | null = null
        let localToTargetRate: number | null = null

        const hasUsdFields = convertibleFields.some((field) => getFieldCurrency(field, countryCode) === 'usd')
        const hasLocalFields = convertibleFields.some((field) => getFieldCurrency(field, countryCode) === 'local')

        if (hasUsdFields && normalizedTargetCurrency !== 'USD') {
          usdToTargetRate = await getConversionRate('USD', normalizedTargetCurrency)
        } else if (normalizedTargetCurrency === 'USD') {
          usdToTargetRate = 1
        }

        if (hasLocalFields && baseLocalCurrency) {
          if (baseLocalCurrency === normalizedTargetCurrency) {
            localToTargetRate = 1
          } else {
            localToTargetRate = await getConversionRate(baseLocalCurrency, normalizedTargetCurrency)
          }
        }

        const assignValue = (field: keyof LocalOfficeInfo, value: number) => {
          conversions[field] = value.toFixed(2)
        }

        convertibleFields.forEach((field) => {
          const rawValue = originalData[field]
          if (!rawValue || rawValue === 'N/A' || rawValue === 'No') {
            return
          }

          const numericValue = Number(rawValue)
          if (!Number.isFinite(numericValue) || numericValue <= 0) {
            return
          }

          const fieldCurrency = getFieldCurrency(field, countryCode)

          if (fieldCurrency === 'usd') {
            if (normalizedTargetCurrency === 'USD') {
              assignValue(field, numericValue)
            } else if (usdToTargetRate && usdToTargetRate > 0) {
              assignValue(field, numericValue * usdToTargetRate)
            }
            return
          }

          if (fieldCurrency === 'local') {
            if (!baseLocalCurrency) {
              return
            }

            if (baseLocalCurrency === normalizedTargetCurrency) {
              assignValue(field, numericValue)
            } else if (localToTargetRate && localToTargetRate > 0) {
              assignValue(field, numericValue * localToTargetRate)
            }
          }
        })

        // Only update state if not aborted
        if (!abortController.signal.aborted) {
          setConvertedLocalOffice(conversions)
          setConvertedForKey(conversionKey)
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.warn('Failed to convert local office data:', error)
          setConvertedLocalOffice({})
          setConvertedForKey('')
        }
      } finally {
        if (conversionTimeoutRef.current) {
          clearTimeout(conversionTimeoutRef.current)
        }
        // Always reset converting state, even if aborted, to prevent stalling
        setIsConvertingLocalOffice(false)
      }
    }

    convertLocalOfficeData()

    return () => {
      // Abort any in-flight conversions
      abortController.abort()
      if (conversionTimeoutRef.current) {
        clearTimeout(conversionTimeoutRef.current)
      }
    }
  }, [conversionKey, originalData, countryCode, originalCurrency, formCurrency, scopeId])

  const isLocalOfficeReady = !isConvertingLocalOffice

  return {
    convertedLocalOffice,
    isConvertingLocalOffice,
    isLocalOfficeReady,
    conversionKey,
    convertedForKey,
  }
}
