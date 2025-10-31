import { useState, useCallback } from "react"
import { EORFormData, Quote, QuoteData } from "@/lib/shared/types"
import { ensureFormDefaults, createQuoteRequestData, fetchOmnipresentCost, transformOmnipresentResponseToQuote, QuoteRequestData } from "@/lib/shared/utils/apiUtils"
import { convertCurrency } from "@/lib/currency-converter"
import { getCountryByName } from "@/lib/country-data"
import { setRawQuote } from "@/lib/shared/utils/rawQuoteStore"

const applyContextFallbacks = (quote: Quote, countryName: string, countryCode: string, currency: string): Quote => {
  return {
    ...quote,
    country: quote.country || countryName,
    country_code: quote.country_code || countryCode,
    currency: quote.currency || currency,
  }
}

export const useOmnipresentQuote = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculateOmnipresentQuote = useCallback(async (formData: EORFormData, data: QuoteData): Promise<QuoteData> => {
    setLoading(true)
    setError(null)
    try {
      const withDefaults = ensureFormDefaults(formData)
      const request = createQuoteRequestData(withDefaults)

      let primaryQuote: Quote | null = null
      let primaryError: Error | null = null
      try {
        const response = await fetchOmnipresentCost(request)
        setRawQuote('omnipresent', response)

        const display = transformOmnipresentResponseToQuote(response)
        const countryInfo = getCountryByName(withDefaults.country)
        primaryQuote = applyContextFallbacks(
          display,
          withDefaults.country,
          countryInfo?.code || '',
          withDefaults.currency
        )
      } catch (err) {
        primaryError = err instanceof Error ? err : new Error(String(err))
        console.error('Omnipresent primary quote failed:', primaryError)
      }

      let comparisonQuote: Quote | undefined
      let compareSelectedCurrencyQuote: Quote | null = null

      let comparisonError: Error | null = null
      if (withDefaults.enableComparison && withDefaults.compareCountry) {
        try {
          const compareReq = createQuoteRequestData(withDefaults, true)
          const compareResp = await fetchOmnipresentCost(compareReq)
          setRawQuote('omnipresent', compareResp, 'comparison')

          const compareDisplay = transformOmnipresentResponseToQuote(compareResp)
          const compareCountryInfo = getCountryByName(withDefaults.compareCountry)
          let compQuote = applyContextFallbacks(
            compareDisplay,
            withDefaults.compareCountry,
            compareCountryInfo?.code || '',
            withDefaults.compareCurrency
          )
          comparisonQuote = compQuote

          if (
            withDefaults.isCurrencyManuallySet &&
            withDefaults.currency &&
            withDefaults.currency !== withDefaults.compareCurrency &&
            withDefaults.compareSalary && withDefaults.compareCurrency
          ) {
            const compSalary = parseFloat((withDefaults.compareSalary || '').toString().replace(/[\,\s]/g, ''))
            if (!Number.isNaN(compSalary) && compSalary > 0) {
              try {
                const conversion = await convertCurrency(compSalary, withDefaults.compareCurrency, withDefaults.currency)
                const compareSelectedReq: QuoteRequestData = {
                  ...compareReq,
                  salary: conversion.success && conversion.data ? conversion.data.target_amount.toString() : withDefaults.compareSalary,
                  currency: withDefaults.currency,
                }
                const compareSelectedResp = await fetchOmnipresentCost(compareSelectedReq)
                const compareSelectedDisplay = transformOmnipresentResponseToQuote(compareSelectedResp)
                let compSelectedQuote = applyContextFallbacks(
                  compareSelectedDisplay,
                  withDefaults.compareCountry,
                  compareCountryInfo?.code || '',
                  withDefaults.currency
                )
                compareSelectedCurrencyQuote = compSelectedQuote
              } catch (err) {
                console.warn('Omnipresent comparison (selected currency) fetch failed', err)
              }
            }
          }
        } catch (err) {
          comparisonError = err instanceof Error ? err : new Error(String(err))
          console.warn('Omnipresent comparison fetch failed', comparisonError)
        }
      }

      let localCurrencyQuote: Quote | null = null
      if (withDefaults.isCurrencyManuallySet && withDefaults.originalCurrency && withDefaults.originalCurrency !== withDefaults.currency) {
        try {
          const baseSalary = parseFloat((withDefaults.baseSalary || '').toString().replace(/[\,\s]/g, ''))
          if (!Number.isNaN(baseSalary) && baseSalary > 0) {
            const conversion = await convertCurrency(baseSalary, withDefaults.currency, withDefaults.originalCurrency)
            const localReq: QuoteRequestData = {
              ...request,
              currency: withDefaults.originalCurrency,
              salary: conversion.success && conversion.data ? conversion.data.target_amount.toString() : withDefaults.baseSalary,
            }
            const localResp = await fetchOmnipresentCost(localReq)
            const localDisplay = transformOmnipresentResponseToQuote(localResp)
            const countryInfoLocal = getCountryByName(withDefaults.country)
            let localQuote = applyContextFallbacks(
              localDisplay,
              withDefaults.country,
              countryInfoLocal?.code || '',
              withDefaults.originalCurrency
            )
            localCurrencyQuote = localQuote
          }
        } catch (err) {
          console.warn('Omnipresent local currency fetch failed', err)
        }
      }

      const dualCurrencyQuotes = localCurrencyQuote && primaryQuote ? {
        ...data.dualCurrencyQuotes,
        omnipresent: {
          selectedCurrencyQuote: primaryQuote,
          localCurrencyQuote,
          compareSelectedCurrencyQuote,
          compareLocalCurrencyQuote: comparisonQuote || null,
          isCalculatingSelected: false,
          isCalculatingLocal: false,
          isCalculatingCompareSelected: false,
          isCalculatingCompareLocal: false,
          isDualCurrencyMode: true,
          hasComparison: Boolean(comparisonQuote && compareSelectedCurrencyQuote),
        }
      } : data.dualCurrencyQuotes

      if (!primaryQuote && !comparisonQuote && !localCurrencyQuote && !(data.dualCurrencyQuotes?.omnipresent)) {
        const fatalError = primaryError || comparisonError || new Error('Omnipresent quote unavailable')
        setError(fatalError.message)
        throw fatalError
      }

      if (comparisonQuote) {
        setError(null)
      } else if (primaryError && !primaryQuote) {
        setError(primaryError.message)
      } else if (comparisonError && !comparisonQuote) {
        setError(comparisonError.message)
      } else {
        setError(null)
      }

      return {
        ...data,
        formData: withDefaults,
        quotes: {
          ...data.quotes,
          ...(primaryQuote ? { omnipresent: primaryQuote } : {}),
          ...(comparisonQuote ? { comparisonOmnipresent: comparisonQuote } : {}),
        },
        dualCurrencyQuotes,
        status: 'completed',
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to calculate Omnipresent quote'
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, calculateOmnipresentQuote }
}
