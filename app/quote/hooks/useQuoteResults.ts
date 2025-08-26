import { useState, useEffect, useCallback } from "react"
import { fetchEORCost, fetchRemoteCost, createQuoteRequestData, ensureFormDefaults } from "@/lib/shared/utils/apiUtils"
import { convertCurrency } from "@/lib/currency-converter"
import { getCountryByName, getCurrencyForCountry } from "@/lib/country-data"
import { getRemoteCountryCurrency } from "@/lib/remote-mapping"
import { DeelAPIResponse, RemoteAPIResponse, EORFormData, DualCurrencyQuotes, ProviderDualCurrencyQuotes, QuoteData, QuoteCost } from "@/lib/shared/types"
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
    const deelDualCurrencyQuotes: ProviderDualCurrencyQuotes = {
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

    const dualCurrencyQuotes: DualCurrencyQuotes = {
      deel: deelDualCurrencyQuotes,
      // Legacy support
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
  let requestData = createQuoteRequestData(formDataWithDefaults)

  // If currency is manually set, convert to the country's local currency before sending to Remote
  if (formData.isCurrencyManuallySet && formData.originalCurrency && formData.currency !== formData.originalCurrency) {
    const salaryAmount = parseFloat(formData.baseSalary.replace(/[,\s]/g, ''))
    const conversionResult = await convertCurrency(salaryAmount, formData.currency, formData.originalCurrency)

    if (conversionResult.success && conversionResult.data) {
      requestData = {
        ...requestData,
        salary: conversionResult.data.target_amount.toString(),
        currency: formData.originalCurrency,
      }
    } else {
      // Handle conversion failure: throw an error or fall back to original values
      throw new Error('Failed to convert currency for Remote.com calculation.')
    }
  }

  const remoteQuote = await fetchRemoteCost(requestData)
  let comparisonQuote: RemoteAPIResponse | undefined

  // Handle comparison quote if enabled
  if (formData.enableComparison && formData.compareCountry) {
    try {
      const compareRequestData = createQuoteRequestData(formDataWithDefaults, true)
      // Similar currency conversion logic might be needed here if comparison currency can be different
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
    status: 'completed',
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
    const compareRegionalCurrency = getRemoteCountryCurrency(formDataWithDefaults.compareCountry!)
    const selectedCurrency = formDataWithDefaults.currency
    // Comparison salary is entered in the selected currency (same as main country)
    const compareSalaryInSelected = parseFloat(formDataWithDefaults.compareSalary?.replace(/[,\s]/g, '') || '0')
    
    console.log('🎯 Remote Dual Currency - Comparison Data:', {
      compareCountry: formDataWithDefaults.compareCountry,
      compareLocalCurrency,
      compareRegionalCurrency,
      selectedCurrency,
      compareSalaryInSelected
    });

    // Create selected currency request (comparison salary is already in selected currency)
    const compareSelectedCurrencyRequestData: QuoteRequestData = {
      salary: compareSalaryInSelected.toString(),
      country: formDataWithDefaults.compareCountry!,
      currency: selectedCurrency,
      clientCountry: formDataWithDefaults.clientCountry,
      age: 30,
      state: formDataWithDefaults.compareState,
    }
    
    // Convert comparison salary from selected currency to comparison country's regional currency
    // This mirrors the main country logic where we convert from selected to regional currency for Remote API
    let compareLocalCurrencyRequestData: QuoteRequestData
    
    if (compareRegionalCurrency && selectedCurrency !== compareRegionalCurrency) {
      // Need to convert from selected currency to comparison country's regional currency
      const comparisonConversionResult = await convertCurrency(compareSalaryInSelected, selectedCurrency, compareRegionalCurrency)
      if (!comparisonConversionResult.success || !comparisonConversionResult.data) {
        throw new Error(`Failed to convert comparison salary from ${selectedCurrency} to ${compareRegionalCurrency}`)
      }
      const compareSalaryInRegional = comparisonConversionResult.data.target_amount
      
      compareLocalCurrencyRequestData = {
        salary: Math.round(compareSalaryInRegional).toString(),
        country: formDataWithDefaults.compareCountry!,
        currency: compareRegionalCurrency,
        clientCountry: formDataWithDefaults.clientCountry,
        age: 30,
        state: formDataWithDefaults.compareState,
      }
      
      console.log('✅ Remote Dual Currency - Comparison currency converted:', {
        originalAmount: compareSalaryInSelected,
        originalCurrency: selectedCurrency,
        convertedAmount: Math.round(compareSalaryInRegional),
        targetCurrency: compareRegionalCurrency
      });
    } else {
      // No conversion needed, use selected currency (same as regional currency)
      compareLocalCurrencyRequestData = {
        salary: compareSalaryInSelected.toString(),
        country: formDataWithDefaults.compareCountry!,
        currency: compareRegionalCurrency || selectedCurrency,
        clientCountry: formDataWithDefaults.clientCountry,
        age: 30,
        state: formDataWithDefaults.compareState,
      }
    }

    console.log('🎯 Remote Dual Currency - Comparison Requests:', {
      selected: compareSelectedCurrencyRequestData,
      regional: compareLocalCurrencyRequestData
    });
    
    apiCalls.push(
      fetchRemoteCost(compareSelectedCurrencyRequestData),
      fetchRemoteCost(compareLocalCurrencyRequestData)
    )
  }
  
  // Execute all API calls
  const results = await Promise.all(apiCalls)
  const [selectedCurrencyData, localCurrencyData, compareSelectedData, compareLocalData] = results
  
  console.log('🎯 Remote Dual Currency - API Results:', {
    selectedCurrency: selectedCurrencyData?.employment?.employer_currency_costs?.currency?.code,
    localCurrency: localCurrencyData?.employment?.employer_currency_costs?.currency?.code,
    compareSelected: compareSelectedData?.employment?.employer_currency_costs?.currency?.code,
    compareLocal: compareLocalData?.employment?.employer_currency_costs?.currency?.code
  })
  
  // Create equivalent Quote objects from Remote API responses for dual currency structure
  // Note: We need to transform Remote API responses to match the Quote interface expectations
  const createQuoteFromRemote = (remoteResponse: RemoteAPIResponse): DeelAPIResponse => {
    const employment = remoteResponse.employment
    const costs = employment.employer_currency_costs
    
    // Transform Remote breakdown items to QuoteCost format
    const quoteCosts: QuoteCost[] = [
      ...(costs.monthly_contributions_breakdown || []).map(item => ({
        name: item.name,
        amount: item.amount.toString(),
        frequency: 'monthly',
        country: employment.country.name,
        country_code: employment.country.code
      })),
      ...(costs.extra_statutory_payments_breakdown || []).map(item => ({
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
  
  console.log('🎯 Remote Dual Currency - Transformed Quotes:', {
    selectedQuote: { currency: selectedQuote.currency, total: selectedQuote.total_costs },
    localQuote: { currency: localQuote.currency, total: localQuote.total_costs },
    compareSelectedQuote: compareSelectedQuote ? { currency: compareSelectedQuote.currency, total: compareSelectedQuote.total_costs } : null,
    compareLocalQuote: compareLocalQuote ? { currency: compareLocalQuote.currency, total: compareLocalQuote.total_costs } : null
  })
  
  const remoteDualCurrencyQuotes: ProviderDualCurrencyQuotes = {
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

  const dualCurrencyQuotes: DualCurrencyQuotes = {
    remote: remoteDualCurrencyQuotes,
    // Legacy support
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
  
  console.log('🎯 Remote Dual Currency - Final Structure:', {
    dualCurrencyQuotes: {
      selectedCurrency: dualCurrencyQuotes.selectedCurrencyQuote?.currency,
      localCurrency: dualCurrencyQuotes.localCurrencyQuote?.currency,
      isDualMode: dualCurrencyQuotes.isDualCurrencyMode
    },
    quotes: { 
      remote: !!selectedCurrencyData,
      comparison: !!compareSelectedData 
    }
  })
  
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
    console.log('🔄 Provider Switch - Starting switch to:', newProvider, 'from:', currentProvider)
    
    if (!quoteData || newProvider === currentProvider) {
      console.log('🔄 Provider Switch - Skipping: no data or same provider')
      return
    }
    
    setProviderLoading(prev => ({ ...prev, [newProvider]: true }))
    setCurrentProvider(newProvider)
    
    try {
      // Check if we already have a quote for this provider
      const hasExistingQuote = (newProvider === 'deel' && quoteData.quotes.deel) || 
                              (newProvider === 'remote' && quoteData.quotes.remote)
      
      console.log('🔄 Provider Switch - Has existing quote:', hasExistingQuote, {
        deel: !!quoteData.quotes.deel,
        remote: !!quoteData.quotes.remote,
        requestedProvider: newProvider
      })
      
      if (!hasExistingQuote && quoteData.status === 'completed') {
        console.log('🔄 Provider Switch - Calculating new quote for:', newProvider)
        const formData = quoteData.formData as EORFormData
        const calculatedQuote = await calculateQuoteForProvider(formData, quoteData, newProvider)
        console.log('✅ Provider Switch - Quote calculated successfully:', {
          provider: newProvider,
          hasQuote: !!calculatedQuote.quotes[newProvider]
        })
        
        const updatedQuotes = {
          ...quoteData.quotes,
          [newProvider]: calculatedQuote.quotes[newProvider],
          comparison: calculatedQuote.quotes.comparison, // Keep this in sync
        };

        if (calculatedQuote.quotes.comparison) {
          if (newProvider === 'deel') {
            updatedQuotes.comparisonDeel = calculatedQuote.quotes.comparison as Quote;
          } else { // 'remote'
            updatedQuotes.comparisonRemote = calculatedQuote.quotes.comparison as RemoteAPIResponse;
          }
        }

        // Merge the new quote data with existing quotes, preserving provider-specific dual currency data
        const updatedQuoteData = {
          ...calculatedQuote,
          quotes: updatedQuotes,
          dualCurrencyQuotes: {
            ...quoteData.dualCurrencyQuotes,
            ...calculatedQuote.dualCurrencyQuotes
          }
        }
        
        console.log('✅ Provider Switch - Updated quote data:', {
          deel: !!updatedQuoteData.quotes.deel,
          remote: !!updatedQuoteData.quotes.remote,
          currentProvider: newProvider,
          dualCurrencyMode: !!updatedQuoteData.dualCurrencyQuotes?.isDualCurrencyMode,
          dualCurrencyQuotes: {
            deel: updatedQuoteData.dualCurrencyQuotes?.deel ? {
              selectedCurrency: updatedQuoteData.dualCurrencyQuotes.deel.selectedCurrencyQuote?.currency,
              localCurrency: updatedQuoteData.dualCurrencyQuotes.deel.localCurrencyQuote?.currency,
              isDualMode: updatedQuoteData.dualCurrencyQuotes.deel.isDualCurrencyMode
            } : null,
            remote: updatedQuoteData.dualCurrencyQuotes?.remote ? {
              selectedCurrency: updatedQuoteData.dualCurrencyQuotes.remote.selectedCurrencyQuote?.currency,
              localCurrency: updatedQuoteData.dualCurrencyQuotes.remote.localCurrencyQuote?.currency,
              isDualMode: updatedQuoteData.dualCurrencyQuotes.remote.isDualCurrencyMode
            } : null
          }
        })
        
        setQuoteData(updatedQuoteData)
        if (quoteId) {
          setJsonInSessionStorage(quoteId, updatedQuoteData)
        }
      } else {
        console.log('🔄 Provider Switch - Using existing quote for:', newProvider)
        if (quoteData.formData.enableComparison) {
          const newComparison = newProvider === 'deel' ? quoteData.quotes.comparisonDeel : quoteData.quotes.comparisonRemote;
          // Only update state if the generic comparison quote is not the correct one
          if (newComparison && quoteData.quotes.comparison !== newComparison) {
            setQuoteData({
              ...quoteData,
              quotes: {
                ...quoteData.quotes,
                comparison: newComparison,
              }
            });
          }
        }
      }
    } catch (error) {
      console.error(`❌ Provider Switch - Error calculating ${newProvider} quote:`, error)
      // Don't change provider if calculation fails
      setCurrentProvider(currentProvider)
    } finally {
      setProviderLoading(prev => ({ ...prev, [newProvider]: false }))
      console.log('🔄 Provider Switch - Finished switch to:', newProvider)
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
