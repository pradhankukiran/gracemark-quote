import { convertCurrency } from "@/lib/currency-converter"
import { DeelAPIResponse, USDConversions } from "../types"

interface ProgressCallback {
  onSalaryConverted?: (amount: number) => void
  onFeeConverted?: (amount: number) => void
  onCostConverted?: (costIndex: number, amount: number) => void
  onTotalConverted?: (amount: number) => void
}

export const convertQuoteToUsd = async (
  quote: DeelAPIResponse,
  progressCallback?: ProgressCallback
): Promise<{
  success: boolean
  data?: USDConversions["deel"]
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

    // Convert main amounts serially with progressive updates
    const salaryResult = await convertCurrency(salaryAmount, sourceCurrency, "USD")
    if (!salaryResult.success) {
      throw new Error("Failed to convert salary")
    }
    // Immediately notify UI of salary conversion
    progressCallback?.onSalaryConverted?.(salaryResult.data!.target_amount)

    const feeResult = await convertCurrency(feeAmount, sourceCurrency, "USD")
    if (!feeResult.success) {
      throw new Error("Failed to convert platform fee")
    }
    // Immediately notify UI of fee conversion
    progressCallback?.onFeeConverted?.(feeResult.data!.target_amount)

    // Convert cost items serially with progressive updates
    const convertedCosts: number[] = []
    for (let i = 0; i < quote.costs.length; i++) {
      const cost = quote.costs[i]
      const costAmount = Number.parseFloat(cost.amount)
      const costResult = await convertCurrency(costAmount, sourceCurrency, "USD")
      if (!costResult.success) {
        throw new Error(`Failed to convert ${cost.name}`)
      }
      const convertedAmount = costResult.data!.target_amount
      convertedCosts.push(convertedAmount)
      // Immediately notify UI of this cost conversion
      progressCallback?.onCostConverted?.(i, convertedAmount)
    }

    const totalResult = await convertCurrency(totalAmount, sourceCurrency, "USD")
    if (!totalResult.success) {
      throw new Error("Failed to convert total costs")
    }
    // Immediately notify UI of total conversion
    progressCallback?.onTotalConverted?.(totalResult.data!.target_amount)

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