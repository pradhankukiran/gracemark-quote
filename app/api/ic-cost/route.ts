import { NextRequest, NextResponse } from "next/server"
import { ICFormData, ICQuoteResult, ICQuoteRequest, ICQuoteResponse } from "@/lib/shared/types"
import { convertCurrency } from "@/lib/currency-converter"

// Constants for IC calculation
const GMK_MARKUP = 0.40 // 40% markup on pay rate
const TRANSACTION_COST_USD = 55 // $55 USD per transaction
const TARGET_NET_MARGIN_USD = 1000 // $1,000 USD target net margin

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

    // Calculate quote using simple 40% markup formula
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
  const workedHours = 160 // Standard 160 hours per month
  const rateBasis = formData.rateBasis === "monthly" ? "monthly" : "hourly"

  const activeCurrency = determineCurrency(currency, formData.currency)

  const parseAmount = (value?: string | null) => {
    if (!value) return 0
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const mspFeeValue = parseAmount(formData.mspFee)
  const backgroundCheckMonthlyFee = formData.backgroundCheckRequired
    ? parseAmount(formData.backgroundCheckMonthlyFee)
    : 0
  const transactionsPerMonth = getTransactionsPerMonth(formData.paymentFrequency)

  const transactionCost = await resolveTransactionCost(activeCurrency, transactionsPerMonth, formData)

  const payRate = rateBasis === "monthly" ? rateAmount / workedHours : rateAmount
  const billRate = payRate * (1 + GMK_MARKUP)

  const monthlyPayRate = payRate * workedHours
  const monthlyBillRate = billRate * workedHours

  const targetNetMarginLocal = await resolveTargetNetMargin(activeCurrency)
  const platformFeeRaw = monthlyBillRate - monthlyPayRate - mspFeeValue - backgroundCheckMonthlyFee - targetNetMarginLocal
  const platformFee = Math.round(platformFeeRaw * 100) / 100

  const netMarginDisplayUsd = TARGET_NET_MARGIN_USD

  return {
    payRate: Math.round(payRate * 100) / 100,
    billRate: Math.round(billRate * 100) / 100,
    monthlyPayRate: Math.round(monthlyPayRate * 100) / 100,
    monthlyBillRate: Math.round(monthlyBillRate * 100) / 100,
    transactionCost: Math.round(transactionCost * 100) / 100,
    mspFee: Math.round(mspFeeValue * 100) / 100,
    backgroundCheckMonthlyFee: Math.round(backgroundCheckMonthlyFee * 100) / 100,
    platformFee,
    netMargin: Math.round(netMarginDisplayUsd * 100) / 100,
    workedHours,
    transactionsPerMonth,
  }
}

async function resolveTransactionCost(currency: string, transactionsPerMonth: number, formData: ICFormData): Promise<number> {
  const monthlyOverride = formData.transactionCostMonthly
    ? parseFloat(formData.transactionCostMonthly)
    : Number.NaN

  if (!Number.isNaN(monthlyOverride) && monthlyOverride > 0) {
    return monthlyOverride
  }

  const perTransactionOverride = formData.transactionCostPerTransaction
    ? parseFloat(formData.transactionCostPerTransaction)
    : Number.NaN

  if (!Number.isNaN(perTransactionOverride) && perTransactionOverride > 0) {
    return perTransactionOverride * transactionsPerMonth
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

async function resolveTargetNetMargin(currency: string): Promise<number> {
  if (!currency || currency.toUpperCase() === "USD") {
    return TARGET_NET_MARGIN_USD
  }

  try {
    const conversion = await convertCurrency(TARGET_NET_MARGIN_USD, "USD", currency)
    if (conversion.success && conversion.data) {
      const converted = Number(conversion.data.target_amount)
      if (!Number.isNaN(converted) && converted > 0) {
        return converted
      }
    }
  } catch (error) {
    console.error("Net margin conversion failed:", error)
  }

  return TARGET_NET_MARGIN_USD
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
