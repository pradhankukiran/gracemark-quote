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

  // Round-trip prevention: stores the rate snapshot from before the most recent
  // toggle. If the user toggles back to the previous displayInUSD state without
  // editing the rate in between, we restore the saved value verbatim instead of
  // re-converting via FX (which would round-trip-drift the value).
  const previousRateSnapshot = useRef<{
    rateAmount: string
    displayInUSD: boolean
    expectedCurrentRate: string
  } | null>(null)

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
    const targetCurrency = formData.displayInUSD ? "USD" : currency

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

    if (!durationMonths || Number.isNaN(durationMonths) || durationMonths <= 0 || !targetCurrency) {
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
        const result = await convertCurrency(BACKGROUND_CHECK_FEE_USD, "USD", targetCurrency, controller.signal)
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
    // Note: formData.displayInUSD intentionally omitted — handleCurrencyToggle
    // performs the bg-check conversion atomically alongside the toggle, so
    // refiring this effect on displayInUSD changes would race with the toggle
    // and recompute via FX twice. The effect still fires on currency/country
    // changes and contract-duration changes, which it needs to handle.
  }, [formData.backgroundCheckRequired, formData.contractDuration, formData.contractDurationUnit, currency, setFormData])

  useEffect(() => {
    const targetCurrency = formData.displayInUSD ? "USD" : currency

    if (!targetCurrency) {
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

    if (targetCurrency.toUpperCase() === "USD") {
      updateTransactionCosts(TRANSACTION_COST_PER_TRANSACTION_USD)
      transactionConversionAbortController.current = null
      return
    }

    ;(async () => {
      try {
        const result = await convertCurrency(
          TRANSACTION_COST_PER_TRANSACTION_USD,
          "USD",
          targetCurrency,
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
    // Note: formData.displayInUSD intentionally omitted — handleCurrencyToggle
    // performs the transaction-cost conversion atomically alongside the toggle.
    // The effect still fires on currency (country change) and paymentFrequency.
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
    // Abort any in-flight toggle, plus the fee-recompute effects' in-flight FX
    // calls — those effects no longer re-fire on displayInUSD change, but a
    // pending request from a prior currency/duration change could otherwise
    // overwrite the atomic values we're about to set below.
    currencyToggleAbortController.current?.abort()
    backgroundConversionAbortController.current?.abort()
    backgroundConversionAbortController.current = null
    transactionConversionAbortController.current?.abort()
    transactionConversionAbortController.current = null
    const controller = new AbortController()
    currencyToggleAbortController.current = controller

    const sourceCurrency = useUSD ? currency : "USD"
    const targetCurrency = useUSD ? "USD" : currency

    // No-op currency case (e.g. country is USA). No conversion needed; the
    // toggle is purely a display-state flip.
    if (sourceCurrency === targetCurrency) {
      previousRateSnapshot.current = null
      setFormData((prev) => ({
        ...prev,
        displayInUSD: useUSD,
      }))
      currencyToggleAbortController.current = null
      return
    }

    // Round-trip prevention: if the user is toggling back to the previous
    // displayInUSD state and hasn't edited rateAmount in the interim, restore
    // the saved rate verbatim instead of re-converting via FX (which would
    // accumulate rounding drift on each round trip).
    const snapshot = previousRateSnapshot.current
    const isRoundTrip =
      snapshot !== null &&
      snapshot.displayInUSD === useUSD &&
      snapshot.expectedCurrentRate === (formData.rateAmount || "")

    // Determine bg-check duration (used for atomic recompute below).
    const rawDuration = Number(formData.contractDuration || "")
    const durationValue = Number.isFinite(rawDuration) ? rawDuration : 0
    const durationMonths = formData.contractDurationUnit === "years"
      ? durationValue * 12
      : durationValue
    const bgCheckActive =
      formData.backgroundCheckRequired &&
      durationMonths > 0 &&
      !Number.isNaN(durationMonths)

    const transactionsPerMonth = getTransactionsPerMonth(formData.paymentFrequency)
    const txCostActive = transactionsPerMonth > 0

    try {
      // Build the FX call set. We always need the bg-check + tx-cost
      // recomputes (they derive from constants in USD), but rate conversion
      // can be skipped if the user is doing a round trip OR has no rate yet.
      const rateAmountNum = parseFloat(formData.rateAmount || "")
      const needsRateConvert =
        !isRoundTrip && !!formData.rateAmount && rateAmountNum > 0

      const ratePromise = needsRateConvert
        ? convertCurrency(rateAmountNum, sourceCurrency, targetCurrency, controller.signal)
        : Promise.resolve(null)

      const bgCheckPromise =
        bgCheckActive && targetCurrency.toUpperCase() !== "USD"
          ? convertCurrency(BACKGROUND_CHECK_FEE_USD, "USD", targetCurrency, controller.signal)
          : Promise.resolve(null)

      const txCostPromise =
        txCostActive && targetCurrency.toUpperCase() !== "USD"
          ? convertCurrency(TRANSACTION_COST_PER_TRANSACTION_USD, "USD", targetCurrency, controller.signal)
          : Promise.resolve(null)

      const [rateResult, bgCheckResult, txCostResult] = await Promise.all([
        ratePromise,
        bgCheckPromise,
        txCostPromise,
      ])

      if (controller.signal.aborted) return

      // Resolve the new rate value: round-trip restore wins over FX result.
      let nextRateAmount = formData.rateAmount
      if (isRoundTrip && snapshot) {
        nextRateAmount = snapshot.rateAmount
      } else if (rateResult && rateResult.success && rateResult.data) {
        nextRateAmount = rateResult.data.target_amount.toFixed(2)
      }

      // Resolve bg-check monthly fee.
      let nextBackgroundCheckMonthlyFee = formData.backgroundCheckMonthlyFee
      if (!bgCheckActive) {
        nextBackgroundCheckMonthlyFee = ""
      } else if (targetCurrency.toUpperCase() === "USD") {
        nextBackgroundCheckMonthlyFee = (BACKGROUND_CHECK_FEE_USD / durationMonths).toFixed(2)
      } else if (bgCheckResult && bgCheckResult.success && bgCheckResult.data) {
        const convertedTotal = Number(bgCheckResult.data.target_amount)
        nextBackgroundCheckMonthlyFee = (convertedTotal / durationMonths).toFixed(2)
      } else if (bgCheckResult) {
        // FX failed for bg-check — clear the field rather than leaving stale data.
        nextBackgroundCheckMonthlyFee = ""
      }

      // Resolve transaction-cost fields.
      let nextTransactionCostPerTransaction = formData.transactionCostPerTransaction
      let nextTransactionCostMonthly = formData.transactionCostMonthly
      if (!txCostActive) {
        nextTransactionCostPerTransaction = ""
        nextTransactionCostMonthly = ""
      } else if (targetCurrency.toUpperCase() === "USD") {
        const perTx = TRANSACTION_COST_PER_TRANSACTION_USD
        nextTransactionCostPerTransaction = perTx.toFixed(2)
        nextTransactionCostMonthly = (perTx * transactionsPerMonth).toFixed(2)
      } else if (txCostResult && txCostResult.success && txCostResult.data) {
        const perTx = Number(txCostResult.data.target_amount)
        nextTransactionCostPerTransaction = perTx.toFixed(2)
        nextTransactionCostMonthly = (perTx * transactionsPerMonth).toFixed(2)
      } else if (txCostResult) {
        nextTransactionCostPerTransaction = ""
        nextTransactionCostMonthly = ""
      }

      // Update the round-trip snapshot. Saves the rate from BEFORE this toggle
      // so that toggling back can restore it verbatim. After a successful
      // round-trip restore, clear the snapshot so the next toggle starts a
      // fresh chain.
      if (!isRoundTrip) {
        previousRateSnapshot.current = {
          rateAmount: formData.rateAmount,
          displayInUSD: !useUSD,
          expectedCurrentRate: nextRateAmount,
        }
      } else {
        previousRateSnapshot.current = null
      }

      // Apply ALL conversions in a single setFormData call. This is the
      // "atomic" fix: rate, bg-check, and tx-cost all flip in one update so
      // the calculator never reads a half-converted state. React 19 batches
      // this naturally; the explicit single setFormData also ensures any
      // synchronous selector sees a consistent snapshot.
      setFormData((prev) => ({
        ...prev,
        displayInUSD: useUSD,
        rateAmount: nextRateAmount,
        backgroundCheckMonthlyFee: nextBackgroundCheckMonthlyFee,
        transactionCostPerTransaction: nextTransactionCostPerTransaction,
        transactionCostMonthly: nextTransactionCostMonthly,
      }))
    } catch (error) {
      if (controller.signal.aborted) return
      console.error('Currency toggle conversion failed:', error)
      // Conversion failed unexpectedly — flip the toggle anyway so the UI
      // stays responsive, but leave dependent fields untouched.
      setFormData((prev) => ({
        ...prev,
        displayInUSD: useUSD,
      }))
    } finally {
      if (currencyToggleAbortController.current === controller) {
        currencyToggleAbortController.current = null
      }
    }
  }, [
    currency,
    formData.rateAmount,
    formData.backgroundCheckRequired,
    formData.backgroundCheckMonthlyFee,
    formData.contractDuration,
    formData.contractDurationUnit,
    formData.paymentFrequency,
    formData.transactionCostPerTransaction,
    formData.transactionCostMonthly,
    setFormData,
  ])

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
