import { useState, useEffect, useCallback } from "react"
import { fetchEORCost, createQuoteRequestData, ensureFormDefaults } from "@/lib/shared/utils/apiUtils"
import { convertCurrency } from "@/lib/currency-converter"
import { getCountryByName, getCurrencyForCountry } from "@/lib/country-data"
import { DeelAPIResponse, EORFormData, DualCurrencyQuotes, QuoteData } from "@/lib/shared/types"
import { getJsonFromSessionStorage, setJsonInSessionStorage } from "@/lib/shared/utils/storageUtils"
import { safeValidateQuoteData, validateQuoteId } from "@/lib/shared/utils/dataValidation"

interface UseQuoteResultsReturn {
  quoteData: QuoteData | null
  loading: boolean
  refreshQuote: () => void
}

interface QuoteRequestData {
  salary: string
  country: string
  currency: string
  clientCountry: string
  age: number
  state?: string
}

// Helper functions are moved outside the hook as they don't depend on hook state.
const calculateSingleCurrencyQuote = async (formData: EORFormData, data: QuoteData): Promise<QuoteData> => {
  // Ensure form data has defaults for optional fields
  const formDataWithDefaults = ensureFormDefaults(formData)
  const requestData = createQuoteRequestData(formDataWithDefaults)
  const deelQuote = await fetchEORCost(requestData)
  let comparisonQuote: DeelAPIResponse | undefined
  if (formData.enableComparison && formData.compareCountry) {
    try {
      const compareRequestData = createQuoteRequestData(formDataWithDefaults, true)
      comparisonQuote = await fetchEORCost(compareRequestData)
    } catch (compareError) {
      console.error('Failed to fetch comparison quote:', compareError)
    }
  }
  return {
    ...data,
    formData: formDataWithDefaults, // Store the form data with defaults
    quotes: { deel: deelQuote, comparison: comparisonQuote },
    metadata: { ...data.metadata, currency: deelQuote.currency },
    status: 'completed'
  }
}

const calculateDualCurrencyQuote = async (formData: EORFormData, data: QuoteData): Promise<QuoteData> => {
    // Ensure form data has defaults for optional fields
    const formDataWithDefaults = ensureFormDefaults(formData)
    const hasComparison = formDataWithDefaults.enableComparison && formDataWithDefaults.compareCountry
    const salaryAmount = parseFloat(formDataWithDefaults.baseSalary.replace(/[,\s]/g, ''))
    const conversionResult = await convertCurrency(salaryAmount, formDataWithDefaults.currency, formDataWithDefaults.originalCurrency!)
    if (!conversionResult.success || !conversionResult.data) {
      throw new Error("Failed to convert salary to local currency")
    }
    const convertedSalaryAmount = conversionResult.data.target_amount.toString()
    const selectedCurrencyRequestData = createQuoteRequestData(formDataWithDefaults)
    const localCurrencyRequestData = {
      ...selectedCurrencyRequestData,
      salary: convertedSalaryAmount,
      currency: formDataWithDefaults.originalCurrency!
    }
    const apiCalls = [
      fetchEORCost(selectedCurrencyRequestData),
      fetchEORCost(localCurrencyRequestData)
    ]
    if (hasComparison) {
      const compareCountryData = getCountryByName(formDataWithDefaults.compareCountry!)
      const compareLocalCurrency = getCurrencyForCountry(compareCountryData!.code)
      const selectedCurrency = formDataWithDefaults.currency
      const compareSalaryInLocal = parseFloat(formDataWithDefaults.compareSalary?.replace(/[,\s]/g, '') || '0')
      const compareLocalCurrencyRequestData: QuoteRequestData = {
        salary: compareSalaryInLocal.toString(),
        country: formDataWithDefaults.compareCountry!,
        currency: compareLocalCurrency,
        clientCountry: formDataWithDefaults.clientCountry,
        age: 30,
        state: formDataWithDefaults.compareState,
      }
      const comparisonConversionResult = await convertCurrency(compareSalaryInLocal, compareLocalCurrency, selectedCurrency)
      if (!comparisonConversionResult.success || !comparisonConversionResult.data) {
        throw new Error(`Failed to convert comparison salary from ${compareLocalCurrency} to ${selectedCurrency}`)
      }
      const compareSalaryInSelected = comparisonConversionResult.data.target_amount
      const compareSelectedCurrencyRequestData: QuoteRequestData = {
        salary: compareSalaryInSelected.toString(),
        country: formDataWithDefaults.compareCountry!,
        currency: selectedCurrency,
        clientCountry: formDataWithDefaults.clientCountry,
        age: 30,
        state: formDataWithDefaults.compareState,
      }
      apiCalls.push(
        fetchEORCost(compareSelectedCurrencyRequestData),
        fetchEORCost(compareLocalCurrencyRequestData)
      )
    }
    const results = await Promise.all(apiCalls)
    const [selectedCurrencyData, localCurrencyData, compareSelectedData, compareLocalData] = results
    const dualCurrencyQuotes: DualCurrencyQuotes = {
      selectedCurrencyQuote: selectedCurrencyData,
      localCurrencyQuote: localCurrencyData,
      compareSelectedCurrencyQuote: compareSelectedData || null,
      compareLocalCurrencyQuote: compareLocalData || null,
      isCalculatingSelected: false,
      isCalculatingLocal: false,
      isCalculatingCompareSelected: false,
      isCalculatingCompareLocal: false,
      isDualCurrencyMode: true,
      hasComparison: !!hasComparison
    }
    return {
      ...data,
      formData: formDataWithDefaults, // Store the form data with defaults
      quotes: { deel: selectedCurrencyData, comparison: compareSelectedData },
      dualCurrencyQuotes,
      metadata: { ...data.metadata, currency: selectedCurrencyData.currency },
      status: 'completed'
    }
}

export const useQuoteResults = (quoteId: string | null): UseQuoteResultsReturn => {
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshQuote = useCallback(() => {
    // This function can be built out to re-trigger the effect if needed.
    // For now, a page refresh or a new quoteId would trigger a reload.
    console.log("Refreshing quote...")
  }, [])

  useEffect(() => {
    const processQuote = async () => {
      setLoading(true)
      
      const idValidation = validateQuoteId(quoteId)
      if (!idValidation.isValid) {
        setQuoteData({ calculatorType: 'eor', formData: {}, quotes: {}, metadata: { timestamp: Date.now(), currency: 'USD' }, status: 'error', error: idValidation.error || 'Invalid quote ID' })
        setLoading(false)
        return
      }

      const storageResult = getJsonFromSessionStorage<QuoteData>(quoteId!)
      if (!storageResult.success || !storageResult.data) {
        setQuoteData({ calculatorType: 'eor', formData: {}, quotes: {}, metadata: { timestamp: Date.now(), currency: 'USD' }, status: 'error', error: storageResult.error || 'Failed to load quote data.' })
        setLoading(false)
        return
      }
      
      const validationResult = safeValidateQuoteData(storageResult.data)
      if (!validationResult.isValid || !validationResult.data) {
        setQuoteData({ calculatorType: 'eor', formData: {}, quotes: {}, metadata: { timestamp: Date.now(), currency: 'USD' }, status: 'error', error: 'Quote data is corrupted or invalid.' })
        setLoading(false)
        return
      }

      const data = validationResult.data
      console.log("EOR form data retrieved on quote page:", data.formData)
      setQuoteData(data)

      if (data.status === 'calculating') {
        try {
          const formData = data.formData as EORFormData
          const isDualCurrency = formData.isCurrencyManuallySet && formData.originalCurrency && formData.originalCurrency !== formData.currency
          const calculationFn = isDualCurrency ? calculateDualCurrencyQuote : calculateSingleCurrencyQuote
          const finalQuoteData = await calculationFn(formData, data)
          setQuoteData(finalQuoteData)
          if (quoteId) {
            setJsonInSessionStorage(quoteId, finalQuoteData)
          }
        } catch (error) {
          console.error('Error calculating quote:', error)
          const errorQuoteData: QuoteData = { ...data, status: 'error', error: error instanceof Error ? error.message : 'Failed to calculate quote' }
          setQuoteData(errorQuoteData)
          if (quoteId) {
            setJsonInSessionStorage(quoteId, errorQuoteData)
          }
        }
      }
      setLoading(false)
    }

    processQuote()
  }, [quoteId])

  return {
    quoteData,
    loading,
    refreshQuote,
  }
}
