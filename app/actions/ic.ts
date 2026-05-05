'use server'

import { ICFormData, ICQuoteResult, ICQuoteRequest } from "@/lib/shared/types"
import { convertCurrency } from "@/lib/currency-converter"
import { composeICQuote } from "@/lib/domain/ic"

const TRANSACTION_COST_USD = 55 // $55 USD per transaction

export async function fetchICCostAction(input: ICQuoteRequest): Promise<ICQuoteResult> {
  const { formData, currency } = input || ({} as ICQuoteRequest)

  if (!formData?.rateAmount || !formData?.country) {
    throw new Error("Missing required fields: rateAmount and country are required")
  }

  const rateAmount = parseFloat(formData.rateAmount)
  if (isNaN(rateAmount) || rateAmount <= 0) {
    throw new Error("Invalid rate amount")
  }

  return await calculateICQuote(formData, currency)
}

async function calculateICQuote(formData: ICFormData, currency?: string): Promise<ICQuoteResult> {
  const rateAmount = parseFloat(formData.rateAmount)
  const rateBasis = formData.rateBasis === "monthly" ? "monthly" : "hourly"

  const parsedMonthlyHours = parseFloat(formData.totalMonthlyHours ?? "")
  const hasCustomHours = Number.isFinite(parsedMonthlyHours) && parsedMonthlyHours > 0
  const workedHours = hasCustomHours
    ? Math.round(Math.min(parsedMonthlyHours, 160) * 100) / 100
    : 160

  const activeCurrency = determineCurrency(currency, formData.currency)
  const baseCurrency = determineCurrency(formData.currency, currency)

  const backgroundCheckMonthlyFeeRaw = formData.backgroundCheckRequired
    ? parseNumeric(formData.backgroundCheckMonthlyFee)
    : 0
  const transactionsPerMonth = getTransactionsPerMonth(formData.paymentFrequency)

  const backgroundCheckMonthlyFee = await normalizeCurrencyAmount(
    backgroundCheckMonthlyFeeRaw,
    baseCurrency,
    activeCurrency
  )

  const transactionCost = await resolveTransactionCost(
    activeCurrency,
    transactionsPerMonth,
    formData,
    baseCurrency
  )

  const markupPercentage = parseNumeric(formData.markupPercentage)
  const mspPercentage = parseNumeric(formData.mspPercentage)

  const kernel = composeICQuote({
    rateAmount,
    rateBasis,
    workedHours,
    markupPercentage,
    mspPercentage,
    transactionCost,
    backgroundCheckMonthlyFee,
  })

  const netMarginUsd = await resolveMarginInUsd(kernel.monthlyMarkup, activeCurrency)
  const roundedNetMarginUsd = Math.round(netMarginUsd * 100) / 100

  return {
    payRate: Math.round(kernel.payRate * 100) / 100,
    billRate: Math.round(kernel.billRate * 100) / 100,
    monthlyPayRate: Math.round(kernel.monthlyPayRate * 100) / 100,
    monthlyBillRate: Math.round(kernel.monthlyBillRate * 100) / 100,
    agencyFee: Math.round(kernel.agencyFee * 100) / 100,
    monthlyAgencyFee: Math.round(kernel.monthlyAgencyFee * 100) / 100,
    transactionCost: Math.round(transactionCost * 100) / 100,
    mspFee: Math.round(kernel.mspFee * 100) / 100,
    backgroundCheckMonthlyFee: Math.round(backgroundCheckMonthlyFee * 100) / 100,
    platformFee: 0,
    monthlyMarkup: Math.round(kernel.monthlyMarkup * 100) / 100,
    netMargin: roundedNetMarginUsd,
    workedHours,
    transactionsPerMonth,
  }
}

async function resolveTransactionCost(
  currency: string,
  transactionsPerMonth: number,
  formData: ICFormData,
  baseCurrency: string
): Promise<number> {
  const monthlyOverride = formData.transactionCostMonthly
    ? parseFloat(formData.transactionCostMonthly)
    : Number.NaN

  if (!Number.isNaN(monthlyOverride) && monthlyOverride > 0) {
    return await normalizeCurrencyAmount(monthlyOverride, baseCurrency, currency)
  }

  const perTransactionOverride = formData.transactionCostPerTransaction
    ? parseFloat(formData.transactionCostPerTransaction)
    : Number.NaN

  if (!Number.isNaN(perTransactionOverride) && perTransactionOverride > 0) {
    const convertedPerTransaction = await normalizeCurrencyAmount(perTransactionOverride, baseCurrency, currency)
    return convertedPerTransaction * transactionsPerMonth
  }

  if (!currency || currency.toUpperCase() === "USD") {
    return TRANSACTION_COST_USD * transactionsPerMonth
  }

  try {
    const conversion = await convertCurrency(TRANSACTION_COST_USD, "USD", currency)
    if (conversion.success && conversion.data) {
      const perTransactionValue = Number(conversion.data.target_amount)
      if (!Number.isNaN(perTransactionValue) && perTransactionValue > 0) {
        return perTransactionValue * transactionsPerMonth
      }
    }
  } catch (error) {
    console.error("Transaction cost conversion failed:", error)
  }

  return TRANSACTION_COST_USD * transactionsPerMonth
}

function determineCurrency(primary?: string, fallback?: string): string {
  const cleanedPrimary = primary?.trim()
  if (cleanedPrimary) {
    return cleanedPrimary
  }

  const cleanedFallback = fallback?.trim()
  if (cleanedFallback) {
    return cleanedFallback
  }

  return "USD"
}

function getTransactionsPerMonth(paymentFrequency: string): number {
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

async function resolveMarginInUsd(amount: number, currency: string): Promise<number> {
  if (!Number.isFinite(amount)) {
    return 0
  }

  if (!currency || currency.toUpperCase() === "USD") {
    return amount
  }

  if (amount === 0) {
    return 0
  }

  try {
    const conversion = await convertCurrency(amount, currency, "USD")
    if (conversion.success && conversion.data) {
      const converted = Number(conversion.data.target_amount)
      if (!Number.isNaN(converted)) {
        return converted
      }
    }
  } catch (error) {
    console.error("Net margin USD conversion failed:", error)
  }

  return 0
}

function parseNumeric(value?: string | null): number {
  if (value === undefined || value === null) {
    return 0
  }
  const parsed = parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

async function normalizeCurrencyAmount(
  amount: number,
  sourceCurrency: string,
  targetCurrency: string
): Promise<number> {
  if (!Number.isFinite(amount) || amount === 0) {
    return 0
  }

  if (!sourceCurrency || !targetCurrency || sourceCurrency.toUpperCase() === targetCurrency.toUpperCase()) {
    return amount
  }

  try {
    const conversion = await convertCurrency(amount, sourceCurrency, targetCurrency)
    if (conversion.success && conversion.data) {
      const converted = Number(conversion.data.target_amount)
      if (Number.isFinite(converted)) {
        return converted
      }
    }
  } catch (error) {
    console.error("Currency normalization failed:", error)
  }

  return amount
}
