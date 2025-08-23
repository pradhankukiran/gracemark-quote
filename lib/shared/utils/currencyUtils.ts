// lib/shared/utils/currencyUtils.ts - Consolidated currency utilities

import { convertCurrency } from "@/lib/currency-converter"
import { DeelAPIResponse, USDConversions } from "@/lib/shared/types"

// Progress callback interface for USD conversion
interface ProgressCallback {
  onSalaryConverted?: (amount: number) => void
  onFeeConverted?: (amount: number) => void
  onCostConverted?: (costIndex: number, amount: number) => void
  onTotalConverted?: (amount: number) => void
}

/**
 * Formats a number as currency with the specified currency code
 */
export const formatCurrency = (amount: number, currency: string): string => {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Formats a string number with commas and decimal places
 */
export const formatNumberWithCommas = (value: string): string => {
  const num = Number.parseFloat(value);
  return isNaN(num) ? value : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Converts a Deel quote to USD with progress callbacks
 */
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
    const sourceCurrency = quote.currency
    const amountsToConvert = [
      Number.parseFloat(quote.salary),
      Number.parseFloat(quote.deel_fee),
      ...quote.costs.map((cost) => Number.parseFloat(cost.amount)),
      Number.parseFloat(quote.total_costs),
    ]

    const conversionPromises = amountsToConvert.map((amount) =>
      convertCurrency(amount, sourceCurrency, "USD")
    )

    const conversionResults = await Promise.all(conversionPromises)

    const failedConversion = conversionResults.find((r) => !r.success)
    if (failedConversion) {
      throw new Error(failedConversion.error || "A currency conversion failed")
    }

    const successfulResults = conversionResults.map((r) => r.data!)

    const salaryAmount = successfulResults[0].target_amount
    const feeAmount = successfulResults[1].target_amount
    const costAmounts = successfulResults.slice(2, -1).map((r) => r.target_amount)
    const totalAmount = successfulResults[successfulResults.length - 1].target_amount

    // Call callbacks to update UI progressively
    progressCallback?.onSalaryConverted?.(salaryAmount)
    progressCallback?.onFeeConverted?.(feeAmount)
    costAmounts.forEach((amount, i) => {
      progressCallback?.onCostConverted?.(i, amount)
    })
    progressCallback?.onTotalConverted?.(totalAmount)

    return {
      success: true,
      data: {
        salary: salaryAmount,
        deelFee: feeAmount,
        costs: costAmounts,
        totalCosts: totalAmount,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: "Failed to convert to USD - " + (error instanceof Error ? error.message : "Unknown error"),
    }
  }
}
