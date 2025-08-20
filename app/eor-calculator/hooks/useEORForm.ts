import { useState, useEffect, useMemo } from "react"
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

export const useEORForm = () => {
  const [formData, setFormData] = useState<EORFormData>(initialFormData)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(initialValidationErrors)

  const countries = getAvailableCountries()
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

  // Auto-update currency when country changes (only if not manually set)
  useEffect(() => {
    if (formData.country && selectedCountryData && !formData.isCurrencyManuallySet) {
      const newCurrency = getCurrencyForCountry(selectedCountryData.code)
      if (formData.currency !== newCurrency) {
        setFormData((prev) => ({
          ...prev,
          currency: newCurrency,
          originalCurrency: newCurrency,
          state: "",
          isCurrencyManuallySet: false,
        }))
      }
    } else if (formData.country && selectedCountryData) {
      // Store original currency even when manually set, for reset functionality
      const originalCurrency = getCurrencyForCountry(selectedCountryData.code)
      if (formData.originalCurrency !== originalCurrency) {
        setFormData((prev) => ({
          ...prev,
          originalCurrency: originalCurrency,
        }))
      }
    }
  }, [formData.country, selectedCountryData, formData.currency, formData.isCurrencyManuallySet])

  // Auto-update client currency when client country changes
  useEffect(() => {
    if (formData.clientCountry && clientCountryData) {
      const newClientCurrency = getCurrencyForCountry(clientCountryData.code)
      if (formData.clientCurrency !== newClientCurrency) {
        setFormData((prev) => ({
          ...prev,
          clientCurrency: newClientCurrency,
        }))
      }
    }
  }, [formData.clientCountry, clientCountryData, formData.clientCurrency])

  // Auto-update comparison currency when comparison country changes
  useEffect(() => {
    if (formData.compareCountry && compareCountryData) {
      const newCurrency = getCurrencyForCountry(compareCountryData.code)
      if (formData.compareCurrency !== newCurrency) {
        setFormData((prev) => ({
          ...prev,
          compareCurrency: newCurrency,
          compareState: "",
          compareSalary: "",
        }))
      }
    }
  }, [formData.compareCountry, compareCountryData, formData.compareCurrency])

  const updateFormData = (updates: Partial<EORFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }

  const updateValidationError = (field: keyof ValidationErrors, error: string | null) => {
    setValidationErrors((prev) => ({ ...prev, [field]: error }))
  }

  const clearValidationErrors = () => {
    setValidationErrors(initialValidationErrors)
  }

  const clearAllData = () => {
    setFormData(initialFormData)
    setValidationErrors(initialValidationErrors)
  }

  const updateBenefitSelection = (benefitType: string, planId: string | undefined) => {
    setFormData((prev) => ({
      ...prev,
      selectedBenefits: {
        ...prev.selectedBenefits,
        [benefitType]: planId,
      },
    }))
  }

  const clearBenefitsSelection = () => {
    setFormData((prev) => ({
      ...prev,
      selectedBenefits: {},
    }))
  }

  const updateLocalOfficeInfo = (updates: Partial<LocalOfficeInfo>) => {
    setFormData((prev) => ({
      ...prev,
      localOfficeInfo: {
        ...prev.localOfficeInfo,
        ...updates,
      },
    }))
  }

  const clearLocalOfficeInfo = () => {
    setFormData((prev) => ({
      ...prev,
      localOfficeInfo: initialLocalOfficeInfo,
    }))
  }

  const overrideCurrency = async (newCurrency: string, onConversionInfo?: (info: string) => void) => {
    const currentCurrency = formData.currency
    const currentSalary = formData.baseSalary
    
    // Update currency immediately
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
            
            // Provide conversion info if callback is available
            if (onConversionInfo) {
              const oldAmount = salaryAmount.toLocaleString()
              const newAmount = result.data.target_amount.toLocaleString()
              onConversionInfo(`Salary converted from ${currentCurrency} ${oldAmount} to ${newCurrency} ${newAmount}`)
            }
          }
        } catch (error) {
          // Conversion failed, but currency change still applies
          console.warn('Currency conversion failed:', error)
        }
      }
    }
  }

  const resetToDefaultCurrency = async () => {
    if (formData.originalCurrency) {
      const currentCurrency = formData.currency
      const currentSalary = formData.baseSalary
      const targetCurrency = formData.originalCurrency
      
      // Update currency immediately
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
            }
          } catch (error) {
            // Conversion failed, but currency reset still applies
            console.warn('Currency conversion failed during reset:', error)
          }
        }
      }
    }
  }

  const isFormValid = () => {
    return formData.country && formData.baseSalary && formData.clientCountry &&
           !Object.values(validationErrors).some(error => error !== null)
  }

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
  }
}