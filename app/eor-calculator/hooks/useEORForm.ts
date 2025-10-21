import { useState, useEffect, useMemo, useCallback } from "react"
import { EORFormData, ValidationErrors, LocalOfficeInfo, SelectedBenefit, LocalOfficeCustomCost } from "@/lib/shared/types"
import { 
  getCountryByName, 
  getCurrencyForCountry,
  getAvailableCountries,
  getStatesForCountry,
  hasStates
} from "@/lib/country-data"
import { convertCurrency } from "@/lib/currency-converter"
import { getDefaultLocalOfficeInfo, getLocalOfficeData, hasLocalOfficeData } from "@/lib/shared/utils/localOfficeData"

const createInitialLocalOfficeInfo = (): LocalOfficeInfo => getDefaultLocalOfficeInfo()
const createInitialLocalOfficeCustomCosts = (): LocalOfficeCustomCost[] => []

const formatCustomCostLabel = (label: string): string => {
  if (!label) return ''
  return label
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

const generateCustomCostId = (): string => {
  const globalCrypto = typeof globalThis !== 'undefined' ? (globalThis as any)?.crypto : undefined
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID()
  }
  return `loc-${Math.random().toString(36).slice(2, 11)}-${Date.now().toString(36)}`
}

const normalizeCustomCosts = (costs?: LocalOfficeCustomCost[] | null): LocalOfficeCustomCost[] => {
  if (!Array.isArray(costs)) {
    return []
  }

  return costs.map((cost) => ({
    id: typeof cost?.id === 'string' && cost.id.trim() ? cost.id : generateCustomCostId(),
    label: typeof cost?.label === 'string' ? formatCustomCostLabel(cost.label) : '',
    amount: typeof cost?.amount === 'string' ? cost.amount : '',
  }))
}

const initialFormDataBase = {
  employeeName: "",
  jobTitle: "",
  workVisaRequired: false,
  country: "",
  state: "",
  currency: "",
  isCurrencyManuallySet: false,
  originalCurrency: null,
  clientName: "",
  clientType: "new" as const,
  clientCountry: "",
  clientCurrency: "",
  baseSalary: "",
  holidayDays: "",
  probationPeriod: "",
  hoursPerDay: "",
  daysPerWeek: "",
  startDate: "",
  employmentType: "full-time" as const,
  contractType: "remote" as const,
  quoteType: "all-inclusive" as const,
  contractDuration: "12",
  contractDurationUnit: "months" as const,
  enableComparison: false,
  compareCountry: "",
  compareState: "",
  compareCurrency: "",
  compareSalary: "",
  currentStep: "form" as const,
  showProviderComparison: false,
  showOptionalEmployeeData: false,
  showBenefits: false,
  selectedBenefits: {
    healthcare: undefined,
    pension: undefined,
    life_insurance: undefined,
  } as EORFormData['selectedBenefits'],
}

const initialFormData: EORFormData = {
  ...initialFormDataBase,
  localOfficeInfo: createInitialLocalOfficeInfo(),
  compareLocalOfficeInfo: createInitialLocalOfficeInfo(),
  localOfficeCustomCosts: createInitialLocalOfficeCustomCosts(),
  compareLocalOfficeCustomCosts: createInitialLocalOfficeCustomCosts(),
}

const normalizeLocalOfficeInfo = (info?: LocalOfficeInfo | null): LocalOfficeInfo => {
  const defaults = getDefaultLocalOfficeInfo()
  if (!info) return defaults
  return {
    ...defaults,
    ...info,
  }
}

const normalizeFormData = (data: Partial<EORFormData> | null | undefined): EORFormData => {
  if (!data) {
    return {
      ...initialFormData,
      localOfficeInfo: createInitialLocalOfficeInfo(),
      compareLocalOfficeInfo: createInitialLocalOfficeInfo(),
      localOfficeCustomCosts: createInitialLocalOfficeCustomCosts(),
      compareLocalOfficeCustomCosts: createInitialLocalOfficeCustomCosts(),
    }
  }

  return {
    ...initialFormData,
    ...data,
    localOfficeInfo: normalizeLocalOfficeInfo(data.localOfficeInfo as LocalOfficeInfo | undefined),
    compareLocalOfficeInfo: normalizeLocalOfficeInfo((data as EORFormData).compareLocalOfficeInfo),
    localOfficeCustomCosts: normalizeCustomCosts((data as EORFormData).localOfficeCustomCosts),
    compareLocalOfficeCustomCosts: normalizeCustomCosts((data as EORFormData).compareLocalOfficeCustomCosts),
  }
}

const initialValidationErrors: ValidationErrors = {
  salary: null,
  holidays: null,
  probation: null,
  hours: null,
  days: null,
}

const EOR_FORM_STORAGE_KEY = "eor-calculator-form-data"
const STORAGE_EXPIRY_HOURS = 24

export const useEORForm = () => {
  // Initialize formData with localStorage
  const [formData, setFormData] = useState<EORFormData>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(EOR_FORM_STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          // Basic expiry check (24 hours)
          if (parsed.timestamp && Date.now() - parsed.timestamp < STORAGE_EXPIRY_HOURS * 60 * 60 * 1000) {
            return normalizeFormData(parsed.data as Partial<EORFormData>)
          }
        }
      } catch (error) {
        console.warn('Failed to load EOR form data:', error)
        // Clear corrupted data
        localStorage.removeItem(EOR_FORM_STORAGE_KEY)
      }
    }
    return initialFormData
  })
  
  // Ensure persisted data is also loaded post-mount (avoids SSR hydration pitfalls)
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(EOR_FORM_STORAGE_KEY) : null
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.timestamp && Date.now() - parsed.timestamp < STORAGE_EXPIRY_HOURS * 60 * 60 * 1000) {
          // Only update if it looks like a valid object with basic expected keys
          if (parsed.data && typeof parsed.data === 'object') {
            setFormData((prev) => {
              // Avoid needless rerender if same reference/shape
              try {
                const nextData = normalizeFormData(parsed.data as Partial<EORFormData>)
                const prevJson = JSON.stringify(prev)
                const nextJson = JSON.stringify(nextData)
                return prevJson === nextJson ? prev : nextData
              } catch {
                return normalizeFormData(parsed.data as Partial<EORFormData>)
              }
            })
          }
        }
      }
    } catch (error) {
      console.warn('Post-mount EOR form load failed:', error)
    }
  }, [])
  
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(initialValidationErrors)
  const [currency, setCurrency] = useState("")
  const [clientCurrency, setClientCurrency] = useState("")
  const [compareCurrency, setCompareCurrency] = useState("")
  const [salaryConversionMessage, setSalaryConversionMessage] = useState<string | null>(null)

  const countries = useMemo(() => getAvailableCountries(), [])
  const selectedCountryData = useMemo(() => 
    formData.country ? getCountryByName(formData.country) : null, 
    [formData.country]
  )
  const availableStates = selectedCountryData ? getStatesForCountry(selectedCountryData.code) : []
  const showStateDropdown = selectedCountryData && hasStates(selectedCountryData.code)

  const clientCountryData = useMemo(() => 
    formData.clientCountry ? getCountryByName(formData.clientCountry) : null, 
    [formData.clientCountry]
  )

  const compareCountryData = useMemo(() => 
    formData.compareCountry ? getCountryByName(formData.compareCountry) : null, 
    [formData.compareCountry]
  )
  const compareAvailableStates = compareCountryData ? getStatesForCountry(compareCountryData.code) : []
  const showCompareStateDropdown = compareCountryData && hasStates(compareCountryData.code)

  // Auto-save to localStorage whenever formData changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const dataToSave = {
          data: formData,
          timestamp: Date.now()
        }
        localStorage.setItem(EOR_FORM_STORAGE_KEY, JSON.stringify(dataToSave))
      } catch (error) {
        console.warn('Failed to save EOR form data:', error)
      }
    }
  }, [formData])

  // Auto-update currency and local office data when country changes
  useEffect(() => {
    if (formData.country && selectedCountryData && !formData.isCurrencyManuallySet) {
      const newCurrency = getCurrencyForCountry(selectedCountryData.code)
      setCurrency(newCurrency)
      setFormData((prev) => ({
        ...prev,
        currency: newCurrency,
      }))
    } else if (formData.country && selectedCountryData) {
      const originalCurrency = getCurrencyForCountry(selectedCountryData.code)
      if (formData.originalCurrency !== originalCurrency) {
        setFormData((prev) => ({
          ...prev,
          originalCurrency: originalCurrency,
        }))
      }
    }
  }, [formData.country, selectedCountryData, formData.isCurrencyManuallySet, formData.originalCurrency])

  // Auto-update client currency when client country changes
  useEffect(() => {
    if (formData.clientCountry && clientCountryData) {
      const newClientCurrency = getCurrencyForCountry(clientCountryData.code)
      setClientCurrency(newClientCurrency)
      setFormData((prev) => ({
        ...prev,
        clientCurrency: newClientCurrency,
      }))
    }
  }, [formData.clientCountry, clientCountryData])

  // Auto-update comparison currency when comparison country changes
  useEffect(() => {
    if (formData.compareCountry && compareCountryData) {
      const newCurrency = getCurrencyForCountry(compareCountryData.code);
      setCompareCurrency(newCurrency)
      setFormData((prev) => ({
        ...prev,
        compareCurrency: newCurrency,
      }))
    }
  }, [
    formData.compareCountry, 
    compareCountryData
  ])

  const updateFormData = useCallback((updates: Partial<EORFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }, [])

  

  const updateValidationError = useCallback((field: keyof ValidationErrors, error: string | null) => {
    setValidationErrors((prev) => ({
      ...prev,
      [field]: error
    }))
  }, [])

  const clearValidationErrors = useCallback(() => {
    setValidationErrors(initialValidationErrors)
  }, [])

  const clearStoredData = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(EOR_FORM_STORAGE_KEY)
      } catch (error) {
        console.warn('Failed to clear stored EOR form data:', error)
      }
    }
  }, [])

  const clearAllData = useCallback(() => {
    setFormData(initialFormData)
    setValidationErrors(initialValidationErrors)
    setCurrency("")
    setClientCurrency("")
    setCompareCurrency("")
    clearStoredData()
  }, [clearStoredData])

  const updateBenefitSelection = useCallback((benefitType: string, benefitData: SelectedBenefit | undefined) => {
    setFormData((prev) => ({
      ...prev,
      selectedBenefits: {
        ...prev.selectedBenefits,
        [benefitType]: benefitData,
      },
    }))
  }, [])

  const clearBenefitsSelection = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      selectedBenefits: {},
    }))
  }, [])

  const updatePrimaryLocalOfficeInfo = useCallback((updates: Partial<LocalOfficeInfo>) => {
    setFormData((prev) => ({
      ...prev,
      localOfficeInfo: {
        ...prev.localOfficeInfo,
        ...updates,
      },
    }))
  }, [])

  const updateComparisonLocalOfficeInfo = useCallback((updates: Partial<LocalOfficeInfo>) => {
    setFormData((prev) => ({
      ...prev,
      compareLocalOfficeInfo: {
        ...prev.compareLocalOfficeInfo,
        ...updates,
      },
    }))
  }, [])

  const addPrimaryLocalOfficeCustomCost = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      localOfficeCustomCosts: [
        ...prev.localOfficeCustomCosts,
        { id: generateCustomCostId(), label: '', amount: '' },
      ],
    }))
  }, [])

  const updatePrimaryLocalOfficeCustomCost = useCallback((id: string, updates: Partial<LocalOfficeCustomCost>) => {
    setFormData((prev) => ({
      ...prev,
      localOfficeCustomCosts: prev.localOfficeCustomCosts.map((cost) =>
        cost.id === id ? { ...cost, ...updates, label: updates.label !== undefined ? formatCustomCostLabel(updates.label) : cost.label } : cost
      ),
    }))
  }, [])

  const removePrimaryLocalOfficeCustomCost = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      localOfficeCustomCosts: prev.localOfficeCustomCosts.filter((cost) => cost.id !== id),
    }))
  }, [])

  const addComparisonLocalOfficeCustomCost = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      compareLocalOfficeCustomCosts: [
        ...prev.compareLocalOfficeCustomCosts,
        { id: generateCustomCostId(), label: '', amount: '' },
      ],
    }))
  }, [])

  const updateComparisonLocalOfficeCustomCost = useCallback((id: string, updates: Partial<LocalOfficeCustomCost>) => {
    setFormData((prev) => ({
      ...prev,
      compareLocalOfficeCustomCosts: prev.compareLocalOfficeCustomCosts.map((cost) =>
        cost.id === id ? { ...cost, ...updates, label: updates.label !== undefined ? formatCustomCostLabel(updates.label) : cost.label } : cost
      ),
    }))
  }, [])

  const removeComparisonLocalOfficeCustomCost = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      compareLocalOfficeCustomCosts: prev.compareLocalOfficeCustomCosts.filter((cost) => cost.id !== id),
    }))
  }, [])

  const clearComparisonLocalOfficeInfo = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      compareLocalOfficeInfo: getDefaultLocalOfficeInfo(),
      compareLocalOfficeCustomCosts: createInitialLocalOfficeCustomCosts(),
      compareCurrency: '',
      compareSalary: '',
    }))
    setCompareCurrency('')
  }, [])

  const handleCompareCountryChange = useCallback((value: string) => {
    const countryData = value ? getCountryByName(value) : null
    const normalizedCode = countryData?.code || ''
    const localOfficeDefaults = getLocalOfficeData(normalizedCode)
    const defaultCurrency = value ? getCurrencyForCountry(normalizedCode) : ''

    setFormData((prev) => ({
      ...prev,
      compareCountry: value,
      compareState: '',
      compareCurrency: defaultCurrency,
      compareSalary: '',
      compareLocalOfficeInfo: localOfficeDefaults ? { ...localOfficeDefaults } : getDefaultLocalOfficeInfo(),
      compareLocalOfficeCustomCosts: createInitialLocalOfficeCustomCosts(),
    }))
    setCompareCurrency(defaultCurrency)
  }, [])

  const handleCountryChange = useCallback((country: string) => {
    const countryData = country ? getCountryByName(country) : null
    const normalizedCode = countryData?.code || ''
    const localOfficeDefaults = getLocalOfficeData(normalizedCode)

    setFormData((prev) => ({
      ...prev,
      country,
      state: '',
      localOfficeInfo: { ...localOfficeDefaults },
      localOfficeCustomCosts: createInitialLocalOfficeCustomCosts(),
    }))
    setSalaryConversionMessage(null) // Clear message on country change
  }, []);

  useEffect(() => {
    if (!formData.country) return
    const normalizedCode = selectedCountryData?.code || ''
    const currentMonthly = formData.localOfficeInfo?.monthlyPaymentsToLocalOffice || ''
    const needsDefault = !currentMonthly.trim() || currentMonthly.trim().toUpperCase() === 'N/A'

    const isBespoke = !!normalizedCode && hasLocalOfficeData(normalizedCode)

  if (!isBespoke && needsDefault) {
    const defaults = getLocalOfficeData(normalizedCode)
    setFormData((prev) => ({
      ...prev,
      localOfficeInfo: {
        ...defaults,
      },
    }))
  }
}, [formData.country, formData.localOfficeInfo?.monthlyPaymentsToLocalOffice, selectedCountryData?.code])

  useEffect(() => {
    if (!formData.compareCountry) return
    const normalizedCode = compareCountryData?.code || ''
    const currentMonthly = formData.compareLocalOfficeInfo?.monthlyPaymentsToLocalOffice || ''
    const needsDefault = !currentMonthly.trim() || currentMonthly.trim().toUpperCase() === 'N/A'

    const isBespoke = !!normalizedCode && hasLocalOfficeData(normalizedCode)

    if (!isBespoke && needsDefault) {
      const defaults = getLocalOfficeData(normalizedCode)
      setFormData((prev) => ({
        ...prev,
        compareLocalOfficeInfo: {
          ...defaults,
        },
      }))
    }
  }, [formData.compareCountry, formData.compareLocalOfficeInfo?.monthlyPaymentsToLocalOffice, compareCountryData?.code])

  

  const overrideCurrency = useCallback(async (newCurrency: string) => {
    const currentCurrency = currency
    const currentSalary = formData.baseSalary
    
    setSalaryConversionMessage(null)

    // Update currency immediately
    setCurrency(newCurrency)
    setFormData((prev) => ({
      ...prev,
      currency: newCurrency,
      isCurrencyManuallySet: true,
    }))
    
    // Convert salary if there's an existing value and currencies are different
    if (currentSalary && currentCurrency && currentCurrency !== newCurrency) {
      const salaryAmount = parseFloat(currentSalary.replace(/[,\s]/g, ''))
      
      if (!isNaN(salaryAmount) && salaryAmount > 0) {
        try {
          const result = await convertCurrency(salaryAmount, currentCurrency, newCurrency)
          
          if (result.success && result.data) {
            // Update with converted salary
            setFormData((prev) => ({
              ...prev,
              baseSalary: result.data!.target_amount.toString(),
            }))
            
            const oldAmount = salaryAmount.toLocaleString()
            const newAmount = result.data.target_amount.toLocaleString()
            setSalaryConversionMessage(`Salary converted from ${currentCurrency} ${oldAmount} to ${newCurrency} ${newAmount}`)
          }
        } catch (error) {
          console.warn('Currency conversion failed:', error)
          setSalaryConversionMessage('Automatic salary conversion failed.')
        }
      }
    }
  }, [currency, formData.baseSalary])

  const resetToDefaultCurrency = useCallback(async () => {
    if (formData.originalCurrency) {
      const currentCurrency = currency
      const currentSalary = formData.baseSalary
      const targetCurrency = formData.originalCurrency
      
      setSalaryConversionMessage(null)

      // Update currency immediately
      setCurrency(targetCurrency)
      setFormData((prev) => ({
        ...prev,
        currency: targetCurrency,
        isCurrencyManuallySet: false,
      }))
      
      // Convert salary if there's an existing value and currencies are different
      if (currentSalary && currentCurrency && currentCurrency !== targetCurrency) {
        const salaryAmount = parseFloat(currentSalary.replace(/[,\s]/g, ''))
        
        if (!isNaN(salaryAmount) && salaryAmount > 0) {
          try {
            const result = await convertCurrency(salaryAmount, currentCurrency, targetCurrency)
            
            if (result.success && result.data) {
              // Update with converted salary
              setFormData((prev) => ({
                ...prev,
                baseSalary: result.data!.target_amount.toString(),
              }))
              const oldAmount = salaryAmount.toLocaleString()
              const newAmount = result.data.target_amount.toLocaleString()
              setSalaryConversionMessage(`Salary reset from ${currentCurrency} ${oldAmount} to ${targetCurrency} ${newAmount}`)
            }
          } catch (error) {
            console.warn('Currency conversion failed during reset:', error)
            setSalaryConversionMessage('Automatic salary conversion failed.')
          }
        }
      }
    }
  }, [formData.originalCurrency, currency, formData.baseSalary])

  const isFormValid = useCallback(() => {
    // console.log('🔍 isFormValid - Checking form validity')
    // console.log('📝 Form data key fields:', {
    //   country: formData.country,
    //   baseSalary: formData.baseSalary,
    //   clientCountry: formData.clientCountry,
    //   currency: formData.currency || currency
    // })
    // console.log('❌ Validation errors:', validationErrors)
    
    // Check that required fields have actual content (not just truthy)
    const hasValidCountry = formData.country && formData.country.trim() !== ''
    const hasValidSalary = formData.baseSalary && formData.baseSalary.trim() !== ''
    const hasValidClientCountry = formData.clientCountry && formData.clientCountry.trim() !== ''
    const hasValidCurrency = (formData.currency || currency) && (formData.currency || currency).trim() !== ''
    const hasNoValidationErrors = !Object.values(validationErrors).some(error => error !== null)
    
    // console.log('✅ Field validity checks:', {
    //   hasValidCountry,
    //   hasValidSalary,
    //   hasValidClientCountry,
    //   hasValidCurrency,
    //   hasNoValidationErrors
    // })
    
    const isValid = hasValidCountry && hasValidSalary && hasValidClientCountry && hasValidCurrency && hasNoValidationErrors
    // console.log('🏁 Form is valid:', isValid)
    
    return isValid
  }, [formData.country, formData.baseSalary, formData.clientCountry, formData.currency, currency, validationErrors])

  return {
    formData,
    currency,
    clientCurrency,
    compareCurrency,
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
    updateValidationError,
    clearValidationErrors,
    clearAllData,
    clearStoredData,
    isFormValid,
    updateBenefitSelection,
    clearBenefitsSelection,
    updatePrimaryLocalOfficeInfo,
    updateComparisonLocalOfficeInfo,
    addPrimaryLocalOfficeCustomCost,
    updatePrimaryLocalOfficeCustomCost,
    removePrimaryLocalOfficeCustomCost,
    addComparisonLocalOfficeCustomCost,
    updateComparisonLocalOfficeCustomCost,
    removeComparisonLocalOfficeCustomCost,
    clearComparisonLocalOfficeInfo,
    overrideCurrency,
    resetToDefaultCurrency,
    handleCompareCountryChange,
    handleCountryChange,
    salaryConversionMessage,
  }
}
