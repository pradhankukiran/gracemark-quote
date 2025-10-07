import { NextRequest, NextResponse } from "next/server"
import { ICFormData, ICQuoteResult, ICQuoteRequest, ICQuoteResponse } from "@/lib/shared/types"

// Constants for IC calculation
const GMK_MARKUP = 0.40 // 40% markup on pay rate
const TRANSACTION_COST_USD = 55 // $55 USD per transaction
const TARGET_NET_MARGIN_USD = 1000 // $1,000 USD target net margin

export async function POST(request: NextRequest) {
  try {
    const body: ICQuoteRequest = await request.json()
    const { formData } = body

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
    const quote = calculateICQuote(formData)

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

function calculateICQuote(formData: ICFormData): ICQuoteResult {
  const rateAmount = parseFloat(formData.rateAmount)
  const workedHours = 160 // Standard 160 hours per month
  const rateBasis = formData.rateBasis === "monthly" ? "monthly" : "hourly"

  // Parse MSP fee (optional)
  const mspFee = formData.mspFee ? parseFloat(formData.mspFee) : 0
  const backgroundCheckMonthlyFee = formData.backgroundCheckRequired
    ? (formData.backgroundCheckMonthlyFee ? parseFloat(formData.backgroundCheckMonthlyFee) : 0)
    : 0

  // Determine transactions per month based on payment frequency
  const transactionsPerMonth = getTransactionsPerMonth(formData.paymentFrequency)

  // Calculate transaction cost ($55 USD per transaction, converted if provided)
  const providedTransactionCostMonthly = formData.transactionCostMonthly
    ? parseFloat(formData.transactionCostMonthly)
    : null
  const transactionCost = providedTransactionCostMonthly && !Number.isNaN(providedTransactionCostMonthly)
    ? providedTransactionCostMonthly
    : TRANSACTION_COST_USD * transactionsPerMonth

  let payRate: number // hourly
  let billRate: number // hourly

  if (formData.rateType === "pay-rate") {
    // Input provided as pay rate (hourly or monthly)
    const payRateHourly = rateBasis === "monthly" ? rateAmount / workedHours : rateAmount
    payRate = payRateHourly
    billRate = payRate * (1 + GMK_MARKUP)
  } else {
    // Input provided as bill rate (hourly or monthly)
    const billRateHourly = rateBasis === "monthly" ? rateAmount / workedHours : rateAmount
    billRate = billRateHourly
    payRate = billRate / (1 + GMK_MARKUP)
  }

  const monthlyPayRate = payRate * workedHours
  const monthlyBillRate = billRate * workedHours

  // Platform Fee calculation to achieve $1,000 net margin
  // Formula: Bill Rate - (Pay Rate + Transaction Cost + MSP Fee + Platform Fee) = $1,000
  // Therefore: Platform Fee = Bill Rate - Pay Rate - Transaction Cost - MSP Fee - $1,000
  const platformFee = monthlyBillRate - monthlyPayRate - transactionCost - mspFee - backgroundCheckMonthlyFee - TARGET_NET_MARGIN_USD

  // Net Margin = Bill Rate - (Pay Rate + Transaction Cost + MSP Fee + Platform Fee)
  const netMargin = TARGET_NET_MARGIN_USD

  return {
    payRate: Math.round(payRate * 100) / 100,
    billRate: Math.round(billRate * 100) / 100,
    monthlyPayRate: Math.round(monthlyPayRate * 100) / 100,
    monthlyBillRate: Math.round(monthlyBillRate * 100) / 100,
    transactionCost: Math.round(transactionCost * 100) / 100,
    mspFee: Math.round(mspFee * 100) / 100,
    backgroundCheckMonthlyFee: Math.round(backgroundCheckMonthlyFee * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    netMargin: Math.round(netMargin * 100) / 100,
    workedHours,
    transactionsPerMonth,
  }
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
