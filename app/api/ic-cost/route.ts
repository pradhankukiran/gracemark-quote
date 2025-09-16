import { NextRequest, NextResponse } from "next/server"
import { ICFormData, ICQuoteResult, ICQuoteRequest, ICQuoteResponse } from "@/lib/shared/types"
import { getCountryByName } from "@/lib/country-data"

// Regional adjustments for different countries/regions
const REGIONAL_ADJUSTMENTS = {
  // North America
  'US': 1.0,
  'CA': 0.95,

  // Europe
  'GB': 1.1,
  'DE': 1.05,
  'FR': 1.05,
  'NL': 1.0,
  'IE': 1.0,

  // Asia Pacific
  'SG': 0.9,
  'AU': 1.05,
  'JP': 1.15,

  // Latin America
  'MX': 0.8,
  'BR': 0.85,
  'AR': 0.75,

  // Default for unlisted countries
  'DEFAULT': 0.9,
} as const

const SERVICE_TYPE_MULTIPLIERS = {
  'Software Development': 1.0,
  'Design & Creative': 0.95,
  'Marketing & Sales': 0.9,
  'Writing & Content': 0.85,
  'Consulting': 1.1,
  'Data & Analytics': 1.05,
  'Customer Support': 0.8,
  'Other': 0.9,
} as const

export async function POST(request: NextRequest) {
  try {
    const body: ICQuoteRequest = await request.json()
    const { formData, currency } = body

    // Validate required fields
    if (!formData.rateAmount || !formData.country || !formData.serviceType) {
      return NextResponse.json({
        success: false,
        error: "Missing required fields: rateAmount, country, and serviceType are required"
      } as ICQuoteResponse, { status: 400 })
    }

    const rateAmount = parseFloat(formData.rateAmount)
    if (isNaN(rateAmount) || rateAmount <= 0) {
      return NextResponse.json({
        success: false,
        error: "Invalid rate amount"
      } as ICQuoteResponse, { status: 400 })
    }

    // Calculate quote using sophisticated business logic
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

async function calculateICQuote(formData: ICFormData, currency: string): Promise<ICQuoteResult> {
  const rateAmount = parseFloat(formData.rateAmount)
  const workedHours = 160 // Standard 160 hours per month
  const targetNetMargin = 1000 // $1,000 USD base target margin

  // Get country data for regional adjustments
  const countryData = getCountryByName(formData.country)
  const countryCode = countryData?.code || 'DEFAULT'

  // Regional and service type adjustments
  const regionalMultiplier = REGIONAL_ADJUSTMENTS[countryCode as keyof typeof REGIONAL_ADJUSTMENTS] || REGIONAL_ADJUSTMENTS.DEFAULT
  const serviceMultiplier = SERVICE_TYPE_MULTIPLIERS[formData.serviceType as keyof typeof SERVICE_TYPE_MULTIPLIERS] || SERVICE_TYPE_MULTIPLIERS['Other']

  // Adjusted target margin based on region and service type
  const adjustedTargetMargin = targetNetMargin * regionalMultiplier * serviceMultiplier

  // Fee rates (adjusted for regional complexity)
  const platformFeeRate = 0.049 * regionalMultiplier // 4.9% base, adjusted
  const paymentProcessingRate = 0.029 // 2.9% (consistent globally)
  const complianceFeeRate = formData.complianceLevel === "premium" ? 0.02 : 0.01

  // Fixed costs (adjusted for region)
  const systemProviderCost = 150 * regionalMultiplier
  const backgroundCheckCost = formData.backgroundCheckRequired ? 200 * regionalMultiplier : 0
  const contractMonths = parseInt(formData.contractDuration) || 12
  const monthlyBackgroundCheck = backgroundCheckCost / contractMonths

  let payRate: number
  let billRate: number

  if (formData.rateType === "pay-rate") {
    // Calculate bill rate from pay rate
    payRate = rateAmount
    const monthlyPayRate = payRate * workedHours

    // Bill Rate = Pay Rate + System Provider + Background Check + Net Margin + Platform Fees
    const baseCosts = monthlyPayRate + systemProviderCost + monthlyBackgroundCheck + adjustedTargetMargin
    // Account for platform fees in the bill rate calculation
    const totalFeeRate = platformFeeRate + paymentProcessingRate + complianceFeeRate
    billRate = baseCosts / (1 - totalFeeRate) / workedHours
  } else {
    // Calculate pay rate from bill rate
    billRate = rateAmount
    const monthlyBillRate = billRate * workedHours

    // Calculate all fees first
    const platformFee = monthlyBillRate * platformFeeRate
    const paymentProcessing = monthlyBillRate * paymentProcessingRate
    const complianceFee = monthlyBillRate * complianceFeeRate
    const totalFees = platformFee + paymentProcessing + complianceFee

    // Pay Rate = Bill Rate - All Costs - Net Margin
    const availableForPayRate =
      monthlyBillRate - totalFees - systemProviderCost - monthlyBackgroundCheck - adjustedTargetMargin
    payRate = Math.max(0, availableForPayRate / workedHours)
  }

  // Calculate final values based on the determined rates
  const monthlyPayRate = payRate * workedHours
  const monthlyBillRate = billRate * workedHours

  const platformFee = monthlyBillRate * platformFeeRate
  const paymentProcessing = monthlyBillRate * paymentProcessingRate
  const complianceFee = monthlyBillRate * complianceFeeRate

  const netMargin =
    monthlyBillRate -
    monthlyPayRate -
    platformFee -
    paymentProcessing -
    complianceFee -
    systemProviderCost -
    monthlyBackgroundCheck

  return {
    payRate: Math.round(payRate * 100) / 100, // Round to 2 decimal places
    billRate: Math.round(billRate * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    paymentProcessing: Math.round(paymentProcessing * 100) / 100,
    complianceFee: Math.round(complianceFee * 100) / 100,
    backgroundCheck: Math.round(monthlyBackgroundCheck * 100) / 100,
    systemProviderCost: Math.round(systemProviderCost * 100) / 100,
    netMargin: Math.round(netMargin * 100) / 100,
    totalMonthlyCost: Math.round(monthlyBillRate * 100) / 100,
    contractorReceives: Math.round(monthlyPayRate * 100) / 100,
    workedHours,
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