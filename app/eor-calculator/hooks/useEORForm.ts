import { useState, useEffect, useMemo } from "react"
import { EORFormData, ValidationErrors } from "../types"
import { 
  getCountryByName, 
  getCurrencyForCountry,
  getAvailableCountries,
  getStatesForCountry,
  hasStates
} from "@/lib/country-data"

const initialFormData: EORFormData = {
  employeeName: "",
  jobTitle: "",
  workVisaRequired: false,
  country: "",
  state: "",
  currency: "",
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

  // Auto-update currency when country changes
  useEffect(() => {
    if (formData.country && selectedCountryData) {
      const newCurrency = getCurrencyForCountry(selectedCountryData.code)
      if (formData.currency !== newCurrency) {
        setFormData((prev) => ({
          ...prev,
          currency: newCurrency,
          state: "",
        }))
      }
    }
  }, [formData.country, selectedCountryData, formData.currency])

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
  }
}