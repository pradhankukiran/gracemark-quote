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
    const convertLocalOfficeData = async () => {
      if (!originalData || !countryCode) {
        setConvertedLocalOffice({})
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
        console.warn('Local office conversion timeout - falling back to original data')
        setIsConvertingLocalOffice(false)
        setConvertedLocalOffice({})
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
        
        const fieldsToConvert = convertibleFields.filter(field => {
          const value = originalData[field]
          if (!value || value === 'N/A' || value === 'No' || isNaN(Number(value))) {
            return false
          }

          const fieldCurrency = getFieldCurrency(field, countryCode)
          if (fieldCurrency === 'usd') {
            return normalizedTargetCurrency !== 'USD'
          }

          if (fieldCurrency === 'local') {
            if (!baseLocalCurrency) return false
            return baseLocalCurrency !== normalizedTargetCurrency
          }

          return false
        })

        const conversionPromises = fieldsToConvert.map(async (field) => {
          const numericValue = Number(originalData[field])
          const fieldCurrency = getFieldCurrency(field, countryCode)
          const sourceCurrency = fieldCurrency === 'usd' ? 'USD' : baseLocalCurrency

          if (!sourceCurrency || sourceCurrency === normalizedTargetCurrency) {
            return
          }

          try {
            const result = await convertCurrency(
              numericValue,
              sourceCurrency,
              normalizedTargetCurrency
            )

            if (result.success && result.data) {
              conversions[field] = result.data.target_amount.toFixed(2)
            } else {
              console.warn(`Failed to convert ${field}:`, result.error)
              // Don't include in conversions - will fall back to original
            }
          } catch (error) {
            console.warn(`Error converting ${field}:`, error)
            // Don't include in conversions - will fall back to original
          }
        })

        await Promise.all(conversionPromises)

        setConvertedLocalOffice(conversions)
      } catch (error) {
        console.warn('Failed to convert local office data:', error)
        setConvertedLocalOffice({})
      } finally {
        if (conversionTimeoutRef.current) {
          clearTimeout(conversionTimeoutRef.current)
        }
        setIsConvertingLocalOffice(false)
      }
    }

    convertLocalOfficeData()
    
    return () => {
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
  }
}

// Helper function to get converted value or fall back to original
export const getConvertedLocalOfficeValue = (
  field: keyof LocalOfficeInfo,
  convertedData: ConvertedLocalOfficeData,
  originalData: LocalOfficeInfo | null
): string => {
  return convertedData[field] || originalData?.[field] || ""
}
