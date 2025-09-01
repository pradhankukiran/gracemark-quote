import { useState, useEffect, useMemo, useCallback } from "react"
import { EORFormData, ValidationErrors, LocalOfficeInfo, SelectedBenefit } from "@/lib/shared/types"
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
  originalCurrency: null,
  clientName: "",
  clientType: "new",
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
  showOptionalEmployeeData: false,
  showBenefits: false,
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

export const useEORForm = () => {
  const [formData, setFormData] = useState<EORFormData>(initialFormData)
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

  const clearAllData = useCallback(() => {
    setFormData(initialFormData)
    setValidationErrors(initialValidationErrors)
  }, [])

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

  const updateLocalOfficeInfo = useCallback((updates: Partial<LocalOfficeInfo>) => {
    setFormData((prev) => ({
      ...prev,
      localOfficeInfo: {
        ...prev.localOfficeInfo,
        ...updates,
      },
    }))
  }, [])

  const clearLocalOfficeInfo = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      localOfficeInfo: initialLocalOfficeInfo,
    }))
  }, [])

  const handleCompareCountryChange = useCallback((value: string) => {
    setFormData((prev) => ({
      ...prev,
      compareCountry: value,
    }))
  }, [])

  const handleCountryChange = useCallback((country: string) => {
    updateFormData({ country, state: '' }); // Also reset state when country changes
    setSalaryConversionMessage(null); // Clear message on country change
  }, [updateFormData]);

  

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
    return formData.country && formData.baseSalary && formData.clientCountry &&
           !Object.values(validationErrors).some(error => error !== null)
  }, [formData.country, formData.baseSalary, formData.clientCountry, validationErrors])

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
    isFormValid,
    updateBenefitSelection,
    clearBenefitsSelection,
    updateLocalOfficeInfo,
    clearLocalOfficeInfo,
    overrideCurrency,
    resetToDefaultCurrency,
    handleCompareCountryChange,
    handleCountryChange,
    salaryConversionMessage,
  }
}
