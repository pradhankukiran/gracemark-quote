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
}

interface UseLocalOfficeConversionProps {
  originalData: LocalOfficeInfo | null
  countryCode: string | null
  formCurrency: string
  isCurrencyManuallySet: boolean
  originalCurrency?: string | null
}

export const useLocalOfficeConversion = ({
  originalData,
  countryCode,
  formCurrency,
  isCurrencyManuallySet,
  originalCurrency,
}: UseLocalOfficeConversionProps): UseLocalOfficeConversionResult => {
  const [convertedLocalOffice, setConvertedLocalOffice] = useState<ConvertedLocalOfficeData>({})
  const [isConvertingLocalOffice, setIsConvertingLocalOffice] = useState(false)
  const conversionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastConversionKeyRef = useRef<string>('')

  // Create stable conversion key from primitive values only
  const conversionKey = useMemo(() => {
    if (!countryCode || !formCurrency) return ''
    return `${countryCode}-${formCurrency}-${isCurrencyManuallySet}`
  }, [countryCode, formCurrency, isCurrencyManuallySet])

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
        setIsConvertingLocalOffice(false)
        return
      }

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

        const conversionPromises: Promise<void>[] = []

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

          const assignValue = (value: number) => {
            conversions[field] = value.toFixed(2)
          }

          if (fieldCurrency === 'usd') {
            if (normalizedTargetCurrency === 'USD') {
              assignValue(numericValue)
              return
            }

            conversionPromises.push((async () => {
              try {
                const result = await convertCurrency(numericValue, 'USD', normalizedTargetCurrency, abortController.signal)
                if (!abortController.signal.aborted && result.success && result.data) {
                  assignValue(result.data.target_amount)
                } else if (!abortController.signal.aborted) {
                  console.warn(`Failed to convert ${field}:`, result.error)
                }
              } catch (error) {
                if (!abortController.signal.aborted) {
                  console.warn(`Error converting ${field}:`, error)
                }
              }
            })())

            return
          }

          if (fieldCurrency === 'local') {
            if (!baseLocalCurrency) {
              return
            }

            if (baseLocalCurrency === normalizedTargetCurrency) {
              assignValue(numericValue)
              return
            }

            conversionPromises.push((async () => {
              try {
                const result = await convertCurrency(numericValue, baseLocalCurrency, normalizedTargetCurrency, abortController.signal)
                if (!abortController.signal.aborted && result.success && result.data) {
                  assignValue(result.data.target_amount)
                } else if (!abortController.signal.aborted) {
                  console.warn(`Failed to convert ${field}:`, result.error)
                }
              } catch (error) {
                if (!abortController.signal.aborted) {
                  console.warn(`Error converting ${field}:`, error)
                }
              }
            })())
          }
        })

        await Promise.all(conversionPromises)

        // Only update state if not aborted
        if (!abortController.signal.aborted) {
          setConvertedLocalOffice(conversions)
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.warn('Failed to convert local office data:', error)
          setConvertedLocalOffice({})
        }
      } finally {
        if (conversionTimeoutRef.current) {
          clearTimeout(conversionTimeoutRef.current)
        }
        if (!abortController.signal.aborted) {
          setIsConvertingLocalOffice(false)
        }
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
  }, [conversionKey, originalData, countryCode, originalCurrency, formCurrency])

  const isLocalOfficeReady = !isConvertingLocalOffice

  return {
    convertedLocalOffice,
    isConvertingLocalOffice,
    isLocalOfficeReady,
    conversionKey,
  }
}

// Helper to read converted values without overriding existing form input
export const getConvertedLocalOfficeValue = (
  field: keyof LocalOfficeInfo,
  convertedData: ConvertedLocalOfficeData,
  originalData: LocalOfficeInfo | null
): string => {
  return convertedData[field] || ""
}
