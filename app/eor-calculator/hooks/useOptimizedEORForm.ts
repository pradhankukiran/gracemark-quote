import { useReducer, useMemo, useCallback, useRef } from "react"
import { EORFormData, ValidationErrors, LocalOfficeInfo } from "../types"
import { 
  getCountryByName, 
  getCurrencyForCountry,
  getAvailableCountries,
  getStatesForCountry,
  hasStates
} from "@/lib/country-data"
import { convertCurrency } from "@/lib/currency-converter"

const initialLocalOfficeInfo: LocalOfficeInfo = {
  mealVoucher: "",
  transportation: "",
  wfh: "",
  healthInsurance: "",
  monthlyPaymentsToLocalOffice: "",
  vat: "",
  preEmploymentMedicalTest: "",
  drugTest: "",
  backgroundCheckViaDeel: "",
}

const initialFormData: EORFormData = {
  employeeName: "",
  jobTitle: "",
  workVisaRequired: false,
  country: "",
  state: "",
  currency: "",
  isCurrencyManuallySet: false,
  originalCurrency: undefined,
  clientName: "",
  clientType: null,
  clientCountry: "",
  clientCurrency: "",
  baseSalary: "",
  holidayDays: "",
  probationPeriod: "",
  hoursPerDay: "",
  daysPerWeek: "",
  startDate: "",
  employmentType: "full-time",
  quoteType: "all-inclusive",
  contractDuration: "12",
  enableComparison: false,
  compareCountry: "",
  compareState: "",
  compareCurrency: "",
  compareSalary: "",
  currentStep: "form",
  showProviderComparison: false,
  selectedBenefits: {
    healthcare: undefined,
    pension: undefined,
    life_insurance: undefined,
  },
  localOfficeInfo: initialLocalOfficeInfo,
}

const initialValidationErrors: ValidationErrors = {
  salary: null,
  holidays: null,
  probation: null,
  hours: null,
  days: null,
}

// Action types for the reducer
type FormAction = 
  | { type: 'UPDATE_FIELD'; field: keyof EORFormData; value: any }
  | { type: 'UPDATE_MULTIPLE'; updates: Partial<EORFormData> }
  | { type: 'UPDATE_CURRENCY'; currency: string; originalCurrency?: string; isManual: boolean }
  | { type: 'RESET_STATE_FOR_COUNTRY' }
  | { type: 'UPDATE_LOCAL_OFFICE'; updates: Partial<LocalOfficeInfo> }
  | { type: 'CLEAR_LOCAL_OFFICE' }
  | { type: 'UPDATE_BENEFIT'; benefitType: string; planId?: string }
  | { type: 'CLEAR_BENEFITS' }
  | { type: 'CLEAR_ALL' }

type ValidationAction = 
  | { type: 'SET_ERROR'; field: keyof ValidationErrors; error: string | null }
  | { type: 'CLEAR_ALL_ERRORS' }

// Form reducer
const formReducer = (state: EORFormData, action: FormAction): EORFormData => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return { ...state, [action.field]: action.value }

    case 'UPDATE_MULTIPLE':
      return { ...state, ...action.updates }

    case 'UPDATE_CURRENCY':
      return {
        ...state,
        currency: action.currency,
        isCurrencyManuallySet: action.isManual,
        originalCurrency: action.originalCurrency ?? state.originalCurrency,
        // Reset local office info when currency changes to trigger fresh conversion
        localOfficeInfo: initialLocalOfficeInfo,
      }

    case 'RESET_STATE_FOR_COUNTRY':
      return {
        ...state,
        state: "",
        localOfficeInfo: initialLocalOfficeInfo,
      }

    case 'UPDATE_LOCAL_OFFICE':
      return {
        ...state,
        localOfficeInfo: {
          ...state.localOfficeInfo,
          ...action.updates,
        },
      }

    case 'CLEAR_LOCAL_OFFICE':
      return {
        ...state,
        localOfficeInfo: initialLocalOfficeInfo,
      }

    case 'UPDATE_BENEFIT':
      return {
        ...state,
        selectedBenefits: {
          ...state.selectedBenefits,
          [action.benefitType]: action.planId,
        },
      }

    case 'CLEAR_BENEFITS':
      return {
        ...state,
        selectedBenefits: {},
      }

    case 'CLEAR_ALL':
      return initialFormData

    default:
      return state
  }
}

// Validation reducer
const validationReducer = (state: ValidationErrors, action: ValidationAction): ValidationErrors => {
  switch (action.type) {
    case 'SET_ERROR':
      return { ...state, [action.field]: action.error }
    case 'CLEAR_ALL_ERRORS':
      return initialValidationErrors
    default:
      return state
  }
}

/**
 * Optimized EOR Form hook using reducers for better performance
 * This reduces the number of re-renders by grouping related state updates
 */
export const useOptimizedEORForm = () => {
  const [formData, dispatchForm] = useReducer(formReducer, initialFormData)
  const [validationErrors, dispatchValidation] = useReducer(validationReducer, initialValidationErrors)
  
  // Use refs for values that shouldn't trigger re-renders
  const currencyUpdateTimeoutRef = useRef<NodeJS.Timeout>()

  // Memoize expensive computations
  const countries = useMemo(() => getAvailableCountries(), [])

  const selectedCountryData = useMemo(() => 
    formData.country ? getCountryByName(formData.country) : null, 
    [formData.country]
  )

  const clientCountryData = useMemo(() => 
    formData.clientCountry ? getCountryByName(formData.clientCountry) : null, 
    [formData.clientCountry]
  )

  const compareCountryData = useMemo(() => 
    formData.compareCountry ? getCountryByName(formData.compareCountry) : null, 
    [formData.compareCountry]
  )

  const availableStates = useMemo(() => 
    selectedCountryData ? getStatesForCountry(selectedCountryData.code) : [], 
    [selectedCountryData]
  )

  const compareAvailableStates = useMemo(() => 
    compareCountryData ? getStatesForCountry(compareCountryData.code) : [], 
    [compareCountryData]
  )

  const showStateDropdown = useMemo(() => 
    selectedCountryData && hasStates(selectedCountryData.code), 
    [selectedCountryData]
  )

  const showCompareStateDropdown = useMemo(() => 
    compareCountryData && hasStates(compareCountryData.code), 
    [compareCountryData]
  )

  // Optimized update functions using useCallback to prevent unnecessary re-renders
  const updateFormData = useCallback((updates: Partial<EORFormData>) => {
    dispatchForm({ type: 'UPDATE_MULTIPLE', updates })
  }, [])

  const updateSingleField = useCallback(<K extends keyof EORFormData>(field: K, value: EORFormData[K]) => {
    dispatchForm({ type: 'UPDATE_FIELD', field, value })
  }, [])

  const updateValidationError = useCallback((field: keyof ValidationErrors, error: string | null) => {
    dispatchValidation({ type: 'SET_ERROR', field, error })
  }, [])

  const clearValidationErrors = useCallback(() => {
    dispatchValidation({ type: 'CLEAR_ALL_ERRORS' })
  }, [])

  const clearAllData = useCallback(() => {
    dispatchForm({ type: 'CLEAR_ALL' })
    dispatchValidation({ type: 'CLEAR_ALL_ERRORS' })
  }, [])

  const updateBenefitSelection = useCallback((benefitType: string, planId: string | undefined) => {
    dispatchForm({ type: 'UPDATE_BENEFIT', benefitType, planId })
  }, [])

  const clearBenefitsSelection = useCallback(() => {
    dispatchForm({ type: 'CLEAR_BENEFITS' })
  }, [])

  const updateLocalOfficeInfo = useCallback((updates: Partial<LocalOfficeInfo>) => {
    dispatchForm({ type: 'UPDATE_LOCAL_OFFICE', updates })
  }, [])

  const clearLocalOfficeInfo = useCallback(() => {
    dispatchForm({ type: 'CLEAR_LOCAL_OFFICE' })
  }, [])

  // Debounced currency update to prevent excessive API calls
  const updateCurrencyWithDebounce = useCallback((
    country: string,
    countryData: any,
    isCurrencyManuallySet: boolean,
    currentCurrency: string
  ) => {
    if (currencyUpdateTimeoutRef.current) {
      clearTimeout(currencyUpdateTimeoutRef.current)
    }

    currencyUpdateTimeoutRef.current = setTimeout(() => {
      if (!isCurrencyManuallySet) {
        const newCurrency = getCurrencyForCountry(countryData.code)
        
        if (currentCurrency !== newCurrency) {
          dispatchForm({
            type: 'UPDATE_CURRENCY',
            currency: newCurrency,
            originalCurrency: newCurrency,
            isManual: false
          })
          dispatchForm({ type: 'RESET_STATE_FOR_COUNTRY' })
        }
      } else {
        // Store original currency even when manually set
        const originalCurrency = getCurrencyForCountry(countryData.code)
        dispatchForm({
          type: 'UPDATE_CURRENCY',
          currency: currentCurrency,
          originalCurrency: originalCurrency,
          isManual: true
        })
      }
    }, 100) // Small delay to batch updates
  }, [])

  // Handle country changes more efficiently
  const handleCountryChange = useCallback((newCountry: string) => {
    const newCountryData = getCountryByName(newCountry)
    if (!newCountryData) return

    updateSingleField('country', newCountry)
    
    // Debounce currency updates to prevent excessive state changes
    updateCurrencyWithDebounce(
      newCountry,
      newCountryData,
      formData.isCurrencyManuallySet,
      formData.currency
    )
  }, [formData.isCurrencyManuallySet, formData.currency, updateSingleField, updateCurrencyWithDebounce])

  // Handle client country changes
  const handleClientCountryChange = useCallback((newClientCountry: string) => {
    updateSingleField('clientCountry', newClientCountry)
    
    const newClientCountryData = getCountryByName(newClientCountry)
    if (newClientCountryData) {
      const newClientCurrency = getCurrencyForCountry(newClientCountryData.code)
      updateSingleField('clientCurrency', newClientCurrency)
    }
  }, [updateSingleField])

  // Handle comparison country changes
  const handleCompareCountryChange = useCallback((newCompareCountry: string) => {
    const newCompareCountryData = getCountryByName(newCompareCountry)
    if (!newCompareCountryData) return

    const newCompareCurrency = getCurrencyForCountry(newCompareCountryData.code)
    
    updateFormData({
      compareCountry: newCompareCountry,
      compareCurrency: newCompareCurrency,
      compareState: "",
      compareSalary: "",
    })
  }, [updateFormData])

  const overrideCurrency = useCallback(async (newCurrency: string, onConversionInfo?: (info: string) => void) => {
    const currentCurrency = formData.currency
    const currentSalary = formData.baseSalary
    
    // Update currency immediately
    dispatchForm({
      type: 'UPDATE_CURRENCY',
      currency: newCurrency,
      isManual: true
    })
    
    // Convert salary if there's an existing value and currencies are different
    if (currentSalary && currentCurrency && currentCurrency !== newCurrency) {
      const salaryAmount = parseFloat(currentSalary.replace(/[,\s]/g, ''))
      
      if (!isNaN(salaryAmount) && salaryAmount > 0) {
        try {
          const result = await convertCurrency(salaryAmount, currentCurrency, newCurrency)
          
          if (result.success && result.data) {
            updateSingleField('baseSalary', result.data.target_amount.toString())
            
            if (onConversionInfo) {
              const oldAmount = salaryAmount.toLocaleString()
              const newAmount = result.data.target_amount.toLocaleString()
              onConversionInfo(`Salary converted from ${currentCurrency} ${oldAmount} to ${newCurrency} ${newAmount}`)
            }
          }
        } catch (error) {
          console.warn('Currency conversion failed:', error)
        }
      }
    }
  }, [formData.currency, formData.baseSalary, updateSingleField])

  const resetToDefaultCurrency = useCallback(async () => {
    if (!formData.originalCurrency) return

    const currentCurrency = formData.currency
    const currentSalary = formData.baseSalary
    const targetCurrency = formData.originalCurrency
    
    // Update currency immediately
    dispatchForm({
      type: 'UPDATE_CURRENCY',
      currency: targetCurrency,
      isManual: false
    })
    
    // Convert salary if needed
    if (currentSalary && currentCurrency && currentCurrency !== targetCurrency) {
      const salaryAmount = parseFloat(currentSalary.replace(/[,\s]/g, ''))
      
      if (!isNaN(salaryAmount) && salaryAmount > 0) {
        try {
          const result = await convertCurrency(salaryAmount, currentCurrency, targetCurrency)
          
          if (result.success && result.data) {
            updateSingleField('baseSalary', result.data.target_amount.toString())
          }
        } catch (error) {
          console.warn('Currency conversion failed during reset:', error)
        }
      }
    }
  }, [formData.originalCurrency, formData.currency, formData.baseSalary, updateSingleField])

  const isFormValid = useCallback(() => {
    return formData.country && formData.baseSalary && formData.clientCountry &&
           !Object.values(validationErrors).some(error => error !== null)
  }, [formData.country, formData.baseSalary, formData.clientCountry, validationErrors])

  return {
    formData,
    validationErrors,
    countries,
    selectedCountryData,
    availableStates,
    showStateDropdown,
    clientCountryData,
    compareCountryData,
    compareAvailableStates,
    showCompareStateDropdown,
    updateFormData,
    updateSingleField,
    updateValidationError,
    clearValidationErrors,
    clearAllData,
    isFormValid,
    updateBenefitSelection,
    clearBenefitsSelection,
    updateLocalOfficeInfo,
    clearLocalOfficeInfo,
    overrideCurrency,
    resetToDefaultCurrency,
    handleCountryChange,
    handleClientCountryChange,
    handleCompareCountryChange,
  }
}