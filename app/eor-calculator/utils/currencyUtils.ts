import { convertCurrency } from "@/lib/currency-converter"
import { DeelAPIResponse, USDConversions } from "../types"

export const convertQuoteToUsd = async (
  quote: DeelAPIResponse,
  quoteType: "deel" | "compare"
): Promise<{
  success: boolean
  data?: USDConversions[typeof quoteType]
  error?: string
}> => {
  if (!quote) {
    return { success: false, error: "No quote provided" }
  }

  const sourceCurrency = quote.currency
  if (sourceCurrency === "USD") {
    return { success: true } // Already in USD
  }

  try {
    const salaryAmount = Number.parseFloat(quote.salary)
    const feeAmount = Number.parseFloat(quote.deel_fee)
    const totalAmount = Number.parseFloat(quote.total_costs)

    // Convert main amounts serially
    const salaryResult = await convertCurrency(salaryAmount, sourceCurrency, "USD")
    if (!salaryResult.success) {
      throw new Error("Failed to convert salary")
    }

    const feeResult = await convertCurrency(feeAmount, sourceCurrency, "USD")
    if (!feeResult.success) {
      throw new Error("Failed to convert platform fee")
    }

    const totalResult = await convertCurrency(totalAmount, sourceCurrency, "USD")
    if (!totalResult.success) {
      throw new Error("Failed to convert total costs")
    }

    // Convert cost items serially
    const convertedCosts: number[] = []
    for (const cost of quote.costs) {
      const costAmount = Number.parseFloat(cost.amount)
      const costResult = await convertCurrency(costAmount, sourceCurrency, "USD")
      if (!costResult.success) {
        throw new Error(`Failed to convert ${cost.name}`)
      }
      convertedCosts.push(costResult.data!.target_amount)
    }

    return {
      success: true,
      data: {
        salary: salaryResult.data!.target_amount,
        deelFee: feeResult.data!.target_amount,
        costs: convertedCosts,
        totalCosts: totalResult.data!.target_amount
      }
    }
  } catch (error) {
    return {
      success: false,
      error: "Failed to convert to USD - " + (error instanceof Error ? error.message : "Unknown error")
    }
  }
}

export const formatCurrency = (amount: number, currency: string): string => {
  return `${currency} ${amount.toLocaleString()}`
}

export const formatNumberWithCommas = (value: string): string => {
  const num = Number.parseFloat(value)
  return isNaN(num) ? value : num.toLocaleString()
}