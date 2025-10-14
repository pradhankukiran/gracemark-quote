import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { ICFormData, ICValidationErrors } from "@/lib/shared/types"
import {
  getCountryByName,
  getCurrencyForCountry,
  getAvailableCountries,
  getStatesForCountry,
  hasStates
} from "@/lib/country-data"
import { convertCurrency } from "@/lib/currency-converter"

const initialFormData: ICFormData = {
  contractorName: "",
  country: "",
  state: "",
  currency: "USD",
  displayInUSD: false,
  rateBasis: "hourly",
  rateAmount: "",
  totalMonthlyHours: "160",
  markupPercentage: "40",
  paymentFrequency: "monthly",
  contractDuration: "12",
  contractDurationUnit: "months",
  complianceLevel: "standard",
  backgroundCheckRequired: false,
  mspPercentage: "",
  backgroundCheckMonthlyFee: "",
  transactionCostPerTransaction: "",
  transactionCostMonthly: "",
}

const initialValidationErrors: ICValidationErrors = {
  contractorName: null,
  country: null,
  rateAmount: null,
  contractDuration: null,
  complianceLevel: null,
}

const IC_FORM_STORAGE_KEY = "ic-calculator-form-data"
const STORAGE_EXPIRY_HOURS = 24
const BACKGROUND_CHECK_FEE_USD = 200
const TRANSACTION_COST_PER_TRANSACTION_USD = 55

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
            return {
              ...initialFormData,
              ...parsed.data,
            }
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
              const mergedData = { ...initialFormData, ...parsed.data }
              try {
                const prevJson = JSON.stringify(prev)
                const nextJson = JSON.stringify(mergedData)
                return prevJson === nextJson ? prev : mergedData
              } catch {
                return mergedData
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
  const [displayCurrency, setDisplayCurrency] = useState(formData.displayInUSD ? "USD" : (formData.currency || "USD"))
  const [rateConversionMessage, setRateConversionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const conversionAbortController = useRef<AbortController | null>(null)
  const currencyToggleAbortController = useRef<AbortController | null>(null)
const backgroundConversionAbortController = useRef<AbortController | null>(null)
const transactionConversionAbortController = useRef<AbortController | null>(null)

  const countries = useMemo(() => getAvailableCountries(), [])
  const selectedCountryData = useMemo(() =>
    formData.country ? getCountryByName(formData.country) : null,
    [formData.country]
  )
const availableStates = selectedCountryData ? getStatesForCountry(selectedCountryData.code) : []
const showStateDropdown = Boolean(selectedCountryData && hasStates(selectedCountryData.code))

const getTransactionsPerMonth = (paymentFrequency: string): number => {
  switch (paymentFrequency) {
    case "weekly":
      return 4
    case "bi-weekly":
      return 2
    case "monthly":
      return 1
    case "milestone":
      return 1
    default:
      return 1
  }
}

  useEffect(() => {
    return () => {
      conversionAbortController.current?.abort()
      backgroundConversionAbortController.current?.abort()
      transactionConversionAbortController.current?.abort()
      currencyToggleAbortController.current?.abort()
    }
  }, [])

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

  useEffect(() => {
    if (!formData.currency) {
      setCurrency("USD")
      return
    }

    if (formData.currency !== currency) {
      setCurrency(formData.currency)
    }
  }, [formData.currency, currency])

  // Update display currency based on displayInUSD toggle
  useEffect(() => {
    const newDisplayCurrency = formData.displayInUSD ? "USD" : currency
    if (newDisplayCurrency !== displayCurrency) {
      setDisplayCurrency(newDisplayCurrency)
    }
  }, [formData.displayInUSD, currency, displayCurrency])

  useEffect(() => {
    if (!formData.backgroundCheckRequired) {
      backgroundConversionAbortController.current?.abort()
      backgroundConversionAbortController.current = null
      setFormData((prev) => {
        if (!prev.backgroundCheckMonthlyFee) {
          return prev
        }
        return {
          ...prev,
          backgroundCheckMonthlyFee: "",
        }
      })
      return
    }

    const rawDuration = Number(formData.contractDuration || "")
    const durationValue = Number.isFinite(rawDuration) ? rawDuration : 0
    const durationMonths = formData.contractDurationUnit === "years"
      ? durationValue * 12
      : durationValue

    if (!durationMonths || Number.isNaN(durationMonths) || durationMonths <= 0 || !currency) {
      backgroundConversionAbortController.current?.abort()
      backgroundConversionAbortController.current = null
      setFormData((prev) => {
        if (!prev.backgroundCheckMonthlyFee) {
          return prev
        }
        return {
          ...prev,
          backgroundCheckMonthlyFee: "",
        }
      })
      return
    }

    backgroundConversionAbortController.current?.abort()
    const controller = new AbortController()
    backgroundConversionAbortController.current = controller

    ;(async () => {
      try {
        const result = await convertCurrency(BACKGROUND_CHECK_FEE_USD, "USD", currency, controller.signal)
        if (controller.signal.aborted) {
          return
        }

        if (result.success && result.data) {
          const convertedTotal = Number(result.data.target_amount)
          const monthlyAmount = Number((convertedTotal / durationMonths).toFixed(2))
          const nextValue = monthlyAmount.toFixed(2)

          setFormData((prev) => {
            if (prev.backgroundCheckMonthlyFee === nextValue) {
              return prev
            }
            return {
              ...prev,
              backgroundCheckMonthlyFee: nextValue,
            }
          })
        } else {
          setFormData((prev) => {
            if (!prev.backgroundCheckMonthlyFee) {
              return prev
            }
            return {
              ...prev,
              backgroundCheckMonthlyFee: "",
            }
          })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setFormData((prev) => {
            if (!prev.backgroundCheckMonthlyFee) {
              return prev
            }
            return {
              ...prev,
              backgroundCheckMonthlyFee: "",
            }
          })
        }
      } finally {
        if (backgroundConversionAbortController.current === controller) {
          backgroundConversionAbortController.current = null
        }
      }
    })()
  }, [formData.backgroundCheckRequired, formData.contractDuration, formData.contractDurationUnit, currency, setFormData])

  useEffect(() => {
    if (!currency) {
      transactionConversionAbortController.current?.abort()
      transactionConversionAbortController.current = null
      setFormData((prev) => {
        if (!prev.transactionCostPerTransaction && !prev.transactionCostMonthly) {
          return prev
        }
        return {
          ...prev,
          transactionCostPerTransaction: "",
          transactionCostMonthly: "",
        }
      })
      return
    }

    const transactionsPerMonth = getTransactionsPerMonth(formData.paymentFrequency)
    if (transactionsPerMonth <= 0) {
      setFormData((prev) => {
        if (!prev.transactionCostPerTransaction && !prev.transactionCostMonthly) {
          return prev
        }
        return {
          ...prev,
          transactionCostPerTransaction: "",
          transactionCostMonthly: "",
        }
      })
      return
    }

    transactionConversionAbortController.current?.abort()
    const controller = new AbortController()
    transactionConversionAbortController.current = controller

    const updateTransactionCosts = (perTransactionValue: number) => {
      const monthlyValue = perTransactionValue * transactionsPerMonth
      const perTransactionFormatted = perTransactionValue.toFixed(2)
      const monthlyFormatted = monthlyValue.toFixed(2)

      setFormData((prev) => {
        if (
          prev.transactionCostPerTransaction === perTransactionFormatted &&
          prev.transactionCostMonthly === monthlyFormatted
        ) {
          return prev
        }
        return {
          ...prev,
          transactionCostPerTransaction: perTransactionFormatted,
          transactionCostMonthly: monthlyFormatted,
        }
      })
    }

    if (currency.toUpperCase() === "USD") {
      updateTransactionCosts(TRANSACTION_COST_PER_TRANSACTION_USD)
      transactionConversionAbortController.current = null
      return
    }

    ;(async () => {
      try {
        const result = await convertCurrency(
          TRANSACTION_COST_PER_TRANSACTION_USD,
          "USD",
          currency,
          controller.signal
        )
        if (controller.signal.aborted) {
          return
        }

        if (result.success && result.data) {
          const perTransactionValue = Number(result.data.target_amount)
          updateTransactionCosts(perTransactionValue)
        } else {
          setFormData((prev) => {
            if (!prev.transactionCostPerTransaction && !prev.transactionCostMonthly) {
              return prev
            }
            return {
              ...prev,
              transactionCostPerTransaction: "",
              transactionCostMonthly: "",
            }
          })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setFormData((prev) => {
            if (!prev.transactionCostPerTransaction && !prev.transactionCostMonthly) {
              return prev
            }
            return {
              ...prev,
              transactionCostPerTransaction: "",
              transactionCostMonthly: "",
            }
          })
        }
      } finally {
        if (transactionConversionAbortController.current === controller) {
          transactionConversionAbortController.current = null
        }
      }
    })()
  }, [currency, formData.paymentFrequency, setFormData])

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
    conversionAbortController.current?.abort()
    conversionAbortController.current = null
    backgroundConversionAbortController.current?.abort()
    backgroundConversionAbortController.current = null
    setFormData(initialFormData)
    setValidationErrors(initialValidationErrors)
    setCurrency("USD")
    setRateConversionMessage(null)
    clearStoredData()
  }, [clearStoredData])

  const handleCountryChange = useCallback((country: string) => {
    conversionAbortController.current?.abort()
    conversionAbortController.current = null
    setRateConversionMessage(null)

    setFormData((prev) => ({
      ...prev,
      country,
      state: '',
    }))

    if (!country) {
      setCurrency("USD")
      setFormData((prev) => ({
        ...prev,
        currency: "USD",
        transactionCostPerTransaction: "",
        transactionCostMonthly: "",
      }))
      return
    }

    const countryData = getCountryByName(country)
    if (!countryData) {
      return
    }

    const newCurrency = getCurrencyForCountry(countryData.code)
    if (!newCurrency) {
      return
    }

    setCurrency(newCurrency)
    setFormData((prev) => ({
      ...prev,
      currency: newCurrency,
      transactionCostPerTransaction: "",
      transactionCostMonthly: "",
      rateAmount: "",
      mspPercentage: "",
    }))

    setRateConversionMessage(null)
  }, [currency, setFormData])

  const handleCurrencyToggle = useCallback(async (useUSD: boolean) => {
    currencyToggleAbortController.current?.abort()
    const controller = new AbortController()
    currencyToggleAbortController.current = controller

    const sourceCurrency = useUSD ? currency : "USD"
    const targetCurrency = useUSD ? "USD" : currency

    // If currencies are the same (e.g., country is already USA), just toggle without conversion
    if (sourceCurrency === targetCurrency) {
      setFormData((prev) => ({
        ...prev,
        displayInUSD: useUSD,
      }))
      currencyToggleAbortController.current = null
      return
    }

    try {
      // Convert rateAmount if it exists
      let convertedRateAmount = formData.rateAmount
      if (formData.rateAmount && parseFloat(formData.rateAmount) > 0) {
        const rateResult = await convertCurrency(
          parseFloat(formData.rateAmount),
          sourceCurrency,
          targetCurrency,
          controller.signal
        )
        if (controller.signal.aborted) return
        if (rateResult.success && rateResult.data) {
          convertedRateAmount = rateResult.data.target_amount.toFixed(2)
        }
      }

      setFormData((prev) => ({
        ...prev,
        displayInUSD: useUSD,
        rateAmount: convertedRateAmount,
      }))
    } catch (error) {
      console.error('Currency toggle conversion failed:', error)
      // Still toggle but keep the values as-is
      setFormData((prev) => ({
        ...prev,
        displayInUSD: useUSD,
      }))
    } finally {
      if (currencyToggleAbortController.current === controller) {
        currencyToggleAbortController.current = null
      }
    }
  }, [currency, formData.rateAmount, setFormData])

  const isFormValid = useCallback(() => {
    // Check that required fields have actual content (not just truthy)
    const hasValidCountry = formData.country && formData.country.trim() !== ''
    const hasValidRateAmount = formData.rateAmount && formData.rateAmount.trim() !== '' && parseFloat(formData.rateAmount) > 0
    const hasValidCurrency = currency && currency.trim() !== ''
    const hasNoValidationErrors = !Object.values(validationErrors).some(error => error !== null)

    return Boolean(hasValidCountry && hasValidRateAmount && hasValidCurrency && hasNoValidationErrors)
  }, [formData.country, formData.rateAmount, currency, validationErrors])

  // Service type options
  // Payment frequency options
  const paymentFrequencies = useMemo(() => [
    { value: "weekly", label: "Weekly" },
    { value: "bi-weekly", label: "Bi-weekly" },
    { value: "monthly", label: "Monthly" },
  ], [])

  // Compliance level options
  const complianceLevels = useMemo(() => [
    { value: "standard", label: "Standard (1%)" },
    { value: "premium", label: "Premium (2%)" },
  ], [])

  return {
    formData,
    currency,
    displayCurrency,
    validationErrors,
    countries,
    selectedCountryData,
    availableStates,
    showStateDropdown,
    paymentFrequencies,
    complianceLevels,
    updateFormData,
    updateValidationError,
    clearValidationErrors,
    clearAllData,
    clearStoredData,
    isFormValid,
    rateConversionMessage,
    handleCountryChange,
    handleCurrencyToggle,
  }
}
