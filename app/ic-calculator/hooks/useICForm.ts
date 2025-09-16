import { useState, useEffect, useMemo, useCallback } from "react"
import { ICFormData, ICValidationErrors } from "@/lib/shared/types"
import {
  getCountryByName,
  getCurrencyForCountry,
  getAvailableCountries,
  getStatesForCountry,
  hasStates
} from "@/lib/country-data"

const initialFormData: ICFormData = {
  contractorName: "",
  serviceType: "",
  country: "",
  state: "",
  currency: "USD",
  rateType: "pay-rate",
  rateAmount: "",
  paymentFrequency: "monthly",
  contractDuration: "12",
  complianceLevel: "standard",
  backgroundCheckRequired: false,
}

const initialValidationErrors: ICValidationErrors = {
  contractorName: null,
  serviceType: null,
  country: null,
  rateAmount: null,
  contractDuration: null,
  complianceLevel: null,
}

const IC_FORM_STORAGE_KEY = "ic-calculator-form-data"
const STORAGE_EXPIRY_HOURS = 24

export const useICForm = () => {
  // Initialize formData with localStorage
  const [formData, setFormData] = useState<ICFormData>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(IC_FORM_STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          // Basic expiry check (24 hours)
          if (parsed.timestamp && Date.now() - parsed.timestamp < STORAGE_EXPIRY_HOURS * 60 * 60 * 1000) {
            return parsed.data
          }
        }
      } catch (error) {
        console.warn('Failed to load IC form data:', error)
        // Clear corrupted data
        localStorage.removeItem(IC_FORM_STORAGE_KEY)
      }
    }
    return initialFormData
  })

  // Ensure persisted data is also loaded post-mount (avoids SSR hydration pitfalls)
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(IC_FORM_STORAGE_KEY) : null
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.timestamp && Date.now() - parsed.timestamp < STORAGE_EXPIRY_HOURS * 60 * 60 * 1000) {
          // Only update if it looks like a valid object with basic expected keys
          if (parsed.data && typeof parsed.data === 'object') {
            setFormData((prev) => {
              // Avoid needless rerender if same reference/shape
              try {
                const prevJson = JSON.stringify(prev)
                const nextJson = JSON.stringify(parsed.data)
                return prevJson === nextJson ? prev : parsed.data
              } catch {
                return parsed.data
              }
            })
          }
        }
      }
    } catch (error) {
      console.warn('Post-mount IC form load failed:', error)
    }
  }, [])

  const [validationErrors, setValidationErrors] = useState<ICValidationErrors>(initialValidationErrors)
  const [currency, setCurrency] = useState(formData.currency || "USD")

  const countries = useMemo(() => getAvailableCountries(), [])
  const selectedCountryData = useMemo(() =>
    formData.country ? getCountryByName(formData.country) : null,
    [formData.country]
  )
  const availableStates = selectedCountryData ? getStatesForCountry(selectedCountryData.code) : []
  const showStateDropdown = Boolean(selectedCountryData && hasStates(selectedCountryData.code))

  // Auto-save to localStorage whenever formData changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const dataToSave = {
          data: formData,
          timestamp: Date.now()
        }
        localStorage.setItem(IC_FORM_STORAGE_KEY, JSON.stringify(dataToSave))
      } catch (error) {
        console.warn('Failed to save IC form data:', error)
      }
    }
  }, [formData])

  // Auto-update currency when country changes
  useEffect(() => {
    if (formData.country && selectedCountryData) {
      const newCurrency = getCurrencyForCountry(selectedCountryData.code)
      setCurrency(newCurrency)
      setFormData((prev) => ({
        ...prev,
        currency: newCurrency,
        state: "", // Reset state when country changes
      }))
    }
  }, [formData.country, selectedCountryData])

  const updateFormData = useCallback((updates: Partial<ICFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }, [])

  const updateValidationError = useCallback((field: keyof ICValidationErrors, error: string | null) => {
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
        localStorage.removeItem(IC_FORM_STORAGE_KEY)
      } catch (error) {
        console.warn('Failed to clear stored IC form data:', error)
      }
    }
  }, [])

  const clearAllData = useCallback(() => {
    setFormData(initialFormData)
    setValidationErrors(initialValidationErrors)
    setCurrency("USD")
    clearStoredData()
  }, [clearStoredData])

  const handleCountryChange = useCallback((country: string) => {
    updateFormData({ country, state: '' })
  }, [updateFormData])

  const isFormValid = useCallback(() => {
    // Check that required fields have actual content (not just truthy)
    const hasValidContractorName = formData.contractorName && formData.contractorName.trim() !== ''
    const hasValidServiceType = formData.serviceType && formData.serviceType.trim() !== ''
    const hasValidCountry = formData.country && formData.country.trim() !== ''
    const hasValidRateAmount = formData.rateAmount && formData.rateAmount.trim() !== '' && parseFloat(formData.rateAmount) > 0
    const hasValidCurrency = currency && currency.trim() !== ''
    const hasNoValidationErrors = !Object.values(validationErrors).some(error => error !== null)

    return Boolean(hasValidContractorName && hasValidServiceType && hasValidCountry && hasValidRateAmount && hasValidCurrency && hasNoValidationErrors)
  }, [formData.contractorName, formData.serviceType, formData.country, formData.rateAmount, currency, validationErrors])

  // Service type options
  const serviceTypes = useMemo(() => [
    "Software Development",
    "Design & Creative",
    "Marketing & Sales",
    "Writing & Content",
    "Consulting",
    "Data & Analytics",
    "Customer Support",
    "Other",
  ], [])

  // Payment frequency options
  const paymentFrequencies = useMemo(() => [
    { value: "weekly", label: "Weekly" },
    { value: "bi-weekly", label: "Bi-weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "milestone", label: "Milestone-based" },
  ], [])

  // Contract duration options
  const contractDurations = useMemo(() => [
    { value: "3", label: "3 Months" },
    { value: "6", label: "6 Months" },
    { value: "12", label: "12 Months" },
    { value: "24", label: "24 Months" },
  ], [])

  // Compliance level options
  const complianceLevels = useMemo(() => [
    { value: "standard", label: "Standard (1%)" },
    { value: "premium", label: "Premium (2%)" },
  ], [])

  return {
    formData,
    currency,
    validationErrors,
    countries,
    selectedCountryData,
    availableStates,
    showStateDropdown,
    serviceTypes,
    paymentFrequencies,
    contractDurations,
    complianceLevels,
    updateFormData,
    updateValidationError,
    clearValidationErrors,
    clearAllData,
    clearStoredData,
    isFormValid,
    handleCountryChange,
  }
}