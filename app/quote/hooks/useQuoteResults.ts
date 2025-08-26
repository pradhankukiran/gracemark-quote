import { useState, useEffect, useCallback } from "react"
import { fetchEORCost, fetchRemoteCost, createQuoteRequestData, ensureFormDefaults } from "@/lib/shared/utils/apiUtils"
import { convertCurrency } from "@/lib/currency-converter"
import { getCountryByName, getCurrencyForCountry } from "@/lib/country-data"
import { DeelAPIResponse, RemoteAPIResponse, EORFormData, DualCurrencyQuotes, QuoteData } from "@/lib/shared/types"
import { getJsonFromSessionStorage, setJsonInSessionStorage } from "@/lib/shared/utils/storageUtils"
import { safeValidateQuoteData, validateQuoteId } from "@/lib/shared/utils/dataValidation"

export type Provider = 'deel' | 'remote'

interface UseQuoteResultsReturn {
  quoteData: QuoteData | null
  loading: boolean
  currentProvider: Provider
  switchProvider: (provider: Provider) => void
  refreshQuote: () => void
  providerLoading: { [K in Provider]: boolean }
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

// Remote-specific calculation functions
const calculateRemoteSingleCurrencyQuote = async (formData: EORFormData, data: QuoteData): Promise<QuoteData> => {
  const formDataWithDefaults = ensureFormDefaults(formData)
  const requestData = createQuoteRequestData(formDataWithDefaults)
  const remoteQuote = await fetchRemoteCost(requestData)
  let comparisonQuote: RemoteAPIResponse | undefined
  
  // Handle comparison quote if enabled (following Deel's pattern)
  if (formData.enableComparison && formData.compareCountry) {
    try {
      const compareRequestData = createQuoteRequestData(formDataWithDefaults, true)
      comparisonQuote = await fetchRemoteCost(compareRequestData)
    } catch (compareError) {
      console.error('Failed to fetch Remote comparison quote:', compareError)
    }
  }
  
  return {
    ...data,
    formData: formDataWithDefaults,
    quotes: { remote: remoteQuote, comparison: comparisonQuote },
    metadata: { ...data.metadata, currency: remoteQuote.employment.employer_currency_costs.currency.code },
    status: 'completed'
  }
}

const calculateRemoteDualCurrencyQuote = async (formData: EORFormData, data: QuoteData): Promise<QuoteData> => {
  // Ensure form data has defaults for optional fields
  const formDataWithDefaults = ensureFormDefaults(formData)
  const hasComparison = formDataWithDefaults.enableComparison && formDataWithDefaults.compareCountry
  const salaryAmount = parseFloat(formDataWithDefaults.baseSalary.replace(/[,\s]/g, ''))
  
  // Convert salary from selected currency to original (local) currency
  const conversionResult = await convertCurrency(salaryAmount, formDataWithDefaults.currency, formDataWithDefaults.originalCurrency!)
  if (!conversionResult.success || !conversionResult.data) {
    throw new Error("Failed to convert salary to local currency")
  }
  const convertedSalaryAmount = conversionResult.data.target_amount.toString()
  
  // Create API request data for both currencies
  const selectedCurrencyRequestData = createQuoteRequestData(formDataWithDefaults)
  const localCurrencyRequestData = {
    ...selectedCurrencyRequestData,
    salary: convertedSalaryAmount,
    currency: formDataWithDefaults.originalCurrency!
  }
  
  // Prepare API calls for primary quotes
  const apiCalls = [
    fetchRemoteCost(selectedCurrencyRequestData),
    fetchRemoteCost(localCurrencyRequestData)
  ]
  
  // Handle comparison quotes if enabled
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
    
    // Convert comparison salary from local currency to selected currency
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
      fetchRemoteCost(compareSelectedCurrencyRequestData),
      fetchRemoteCost(compareLocalCurrencyRequestData)
    )
  }
  
  // Execute all API calls
  const results = await Promise.all(apiCalls)
  const [selectedCurrencyData, localCurrencyData, compareSelectedData, compareLocalData] = results
  
  // Create equivalent Quote objects from Remote API responses for dual currency structure
  // Note: We need to transform Remote API responses to match the Quote interface expectations
  const createQuoteFromRemote = (remoteResponse: RemoteAPIResponse): DeelAPIResponse => {
    const employment = remoteResponse.employment
    const costs = employment.employer_currency_costs
    
    // Transform Remote breakdown items to QuoteCost format
    const quoteCosts: QuoteCost[] = [
      ...costs.monthly_contributions_breakdown.map(item => ({
        name: item.name,
        amount: item.amount.toString(),
        frequency: 'monthly',
        country: employment.country.name,
        country_code: employment.country.code
      })),
      ...costs.extra_statutory_payments_breakdown.map(item => ({
        name: item.name,
        amount: item.amount.toString(),
        frequency: 'monthly',
        country: employment.country.name,
        country_code: employment.country.code
      }))
    ]
    
    return {
      provider: 'Remote',
      salary: costs.monthly_gross_salary.toString(),
      currency: costs.currency.code,
      country: employment.country.name,
      country_code: employment.country.code,
      deel_fee: '0', // Remote doesn't have a separate fee structure like Deel
      severance_accural: '0', // This would need to be extracted if Remote provides it
      total_costs: costs.monthly_total.toString(),
      employer_costs: costs.monthly_total.toString(),
      costs: quoteCosts,
      benefits_data: [],
      additional_data: {
        additional_notes: []
      }
    }
  }
  
  // Transform Remote responses to Quote format for dual currency compatibility
  const selectedQuote = createQuoteFromRemote(selectedCurrencyData)
  const localQuote = createQuoteFromRemote(localCurrencyData)
  const compareSelectedQuote = compareSelectedData ? createQuoteFromRemote(compareSelectedData) : null
  const compareLocalQuote = compareLocalData ? createQuoteFromRemote(compareLocalData) : null
  
  const dualCurrencyQuotes: DualCurrencyQuotes = {
    selectedCurrencyQuote: selectedQuote,
    localCurrencyQuote: localQuote,
    compareSelectedCurrencyQuote: compareSelectedQuote,
    compareLocalCurrencyQuote: compareLocalQuote,
    isCalculatingSelected: false,
    isCalculatingLocal: false,
    isCalculatingCompareSelected: false,
    isCalculatingCompareLocal: false,
    isDualCurrencyMode: true,
    hasComparison: !!hasComparison
  }
  
  return {
    ...data,
    formData: formDataWithDefaults,
    quotes: { remote: selectedCurrencyData, comparison: compareSelectedData || undefined },
    dualCurrencyQuotes,
    metadata: { ...data.metadata, currency: selectedQuote.currency },
    status: 'completed'
  }
}

// Provider-agnostic calculation function
const calculateQuoteForProvider = async (
  formData: EORFormData, 
  data: QuoteData, 
  provider: Provider
): Promise<QuoteData> => {
  const isDualCurrency = formData.isCurrencyManuallySet && formData.originalCurrency && formData.originalCurrency !== formData.currency
  
  if (provider === 'deel') {
    return isDualCurrency ? calculateDualCurrencyQuote(formData, data) : calculateSingleCurrencyQuote(formData, data)
  } else if (provider === 'remote') {
    // Remote now supports both single and dual currency modes
    return isDualCurrency ? calculateRemoteDualCurrencyQuote(formData, data) : calculateRemoteSingleCurrencyQuote(formData, data)
  }
  
  throw new Error(`Unsupported provider: ${provider}`)
}

export const useQuoteResults = (quoteId: string | null): UseQuoteResultsReturn => {
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentProvider, setCurrentProvider] = useState<Provider>('deel')
  const [providerLoading, setProviderLoading] = useState<{ [K in Provider]: boolean }>({
    deel: false,
    remote: false
  })

  const switchProvider = useCallback(async (newProvider: Provider) => {
    if (!quoteData || newProvider === currentProvider) return
    
    setProviderLoading(prev => ({ ...prev, [newProvider]: true }))
    setCurrentProvider(newProvider)
    
    try {
      // Check if we already have a quote for this provider
      const hasExistingQuote = (newProvider === 'deel' && quoteData.quotes.deel) || 
                              (newProvider === 'remote' && quoteData.quotes.remote)
      
      if (!hasExistingQuote && quoteData.status === 'completed') {
        const formData = quoteData.formData as EORFormData
        const calculatedQuote = await calculateQuoteForProvider(formData, quoteData, newProvider)
        
        // Merge the new quote data with existing quotes
        const updatedQuoteData = {
          ...calculatedQuote,
          quotes: {
            ...quoteData.quotes,
            ...calculatedQuote.quotes
          }
        }
        
        setQuoteData(updatedQuoteData)
        if (quoteId) {
          setJsonInSessionStorage(quoteId, updatedQuoteData)
        }
      }
    } catch (error) {
      console.error(`Error calculating ${newProvider} quote:`, error)
      // Don't change provider if calculation fails
      setCurrentProvider(currentProvider)
    } finally {
      setProviderLoading(prev => ({ ...prev, [newProvider]: false }))
    }
  }, [quoteData, currentProvider, quoteId])

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
          // Default to Deel for initial calculation
          const finalQuoteData = await calculateQuoteForProvider(formData, data, 'deel')
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
    currentProvider,
    switchProvider,
    refreshQuote,
    providerLoading,
  }
}
