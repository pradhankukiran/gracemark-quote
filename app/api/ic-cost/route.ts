import { NextRequest, NextResponse } from "next/server"
import { ICFormData, ICQuoteResult, ICQuoteRequest, ICQuoteResponse } from "@/lib/shared/types"
import { convertCurrency } from "@/lib/currency-converter"

// Constants for IC calculation
const DEFAULT_MARKUP = 0.40 // 40% markup fallback
const TRANSACTION_COST_USD = 55 // $55 USD per transaction

export async function POST(request: NextRequest) {
  try {
    const body: ICQuoteRequest = await request.json()
    const { formData, currency } = body

    // Validate required fields
    if (!formData.rateAmount || !formData.country) {
      return NextResponse.json({
        success: false,
        error: "Missing required fields: rateAmount and country are required"
      } as ICQuoteResponse, { status: 400 })
    }

    const rateAmount = parseFloat(formData.rateAmount)
    if (isNaN(rateAmount) || rateAmount <= 0) {
      return NextResponse.json({
        success: false,
        error: "Invalid rate amount"
      } as ICQuoteResponse, { status: 400 })
    }

    // Calculate quote
    const quote = await calculateICQuote(formData, currency)

    return NextResponse.json({
      success: true,
      data: quote
    } as ICQuoteResponse)

  } catch (error) {
    console.error("IC cost calculation error:", error)
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    } as ICQuoteResponse, { status: 500 })
  }
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
  const markupRate = Number.isFinite(markupPercentage) && markupPercentage > 0
    ? markupPercentage / 100
    : DEFAULT_MARKUP

  const payRate = rateBasis === "monthly" ? rateAmount / workedHours : rateAmount
  const agencyFee = payRate * markupRate
  const billRate = payRate + agencyFee

  const monthlyPayRate = payRate * workedHours
  const monthlyBillRate = billRate * workedHours
  const monthlyAgencyFee = agencyFee * workedHours

  const mspPercentage = parseNumeric(formData.mspPercentage)
  const mspRate = Number.isFinite(mspPercentage) && mspPercentage > 0
    ? mspPercentage / 100
    : 0
  const mspFeeHourly = billRate * mspRate
  const mspFee = mspFeeHourly * workedHours

  const totalMonthlyCosts = monthlyPayRate + transactionCost + backgroundCheckMonthlyFee + mspFee
  const monthlyMarkup = monthlyBillRate - totalMonthlyCosts

  const netMarginUsd = await resolveMarginInUsd(monthlyMarkup, activeCurrency)

  const roundedNetMarginUsd = Math.round(netMarginUsd * 100) / 100

  return {
    payRate: Math.round(payRate * 100) / 100,
    billRate: Math.round(billRate * 100) / 100,
    monthlyPayRate: Math.round(monthlyPayRate * 100) / 100,
    monthlyBillRate: Math.round(monthlyBillRate * 100) / 100,
    agencyFee: Math.round(agencyFee * 100) / 100,
    monthlyAgencyFee: Math.round(monthlyAgencyFee * 100) / 100,
    transactionCost: Math.round(transactionCost * 100) / 100,
    mspFee: Math.round(mspFee * 100) / 100,
    backgroundCheckMonthlyFee: Math.round(backgroundCheckMonthlyFee * 100) / 100,
    platformFee: 0,
    monthlyMarkup: Math.round(monthlyMarkup * 100) / 100,
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

// Helper function to determine number of transactions per month
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

// Allow OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
