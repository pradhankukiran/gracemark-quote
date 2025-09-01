// lib/shared/utils/currencyUtils.ts - Consolidated currency utilities

import { convertCurrency } from "@/lib/currency-converter"
import { DeelAPIResponse, RemoteAPIResponse, USDConversions } from "@/lib/shared/types"

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
 * Converts a Deel quote to USD
 */
export const convertQuoteToUsd = async (
  quote: DeelAPIResponse,
  signal?: AbortSignal
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
    return { success: true, data: undefined } // Already in USD
  }

  try {
    const amountsToConvert = [
      Number.parseFloat(quote.salary),
      Number.parseFloat(quote.deel_fee),
      ...quote.costs.map((cost) => Number.parseFloat(cost.amount)),
      Number.parseFloat(quote.total_costs),
    ]

    const conversionPromises = amountsToConvert.map((amount) =>
      convertCurrency(amount, sourceCurrency, "USD", signal)
    )

    const conversionResults = await Promise.all(conversionPromises)

    if (signal?.aborted) {
      return { success: false, error: "Conversion aborted" };
    }

    const failedConversion = conversionResults.find((r) => !r.success)
    if (failedConversion) {
      throw new Error(failedConversion.error || "A currency conversion failed")
    }

    const successfulResults = conversionResults.map((r) => r.data!)

    const salaryAmount = successfulResults[0].target_amount
    const feeAmount = successfulResults[1].target_amount
    const costAmounts = successfulResults.slice(2, -1).map((r) => r.target_amount)
    const totalAmount = successfulResults[successfulResults.length - 1].target_amount

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
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: "Conversion aborted" };
    }
    return {
      success: false,
      error: "Failed to convert to USD - " + (error instanceof Error ? error.message : "Unknown error"),
    }
  }
}

/**
 * Converts a Remote quote to USD
 */
export const convertRemoteQuoteToUsd = async (
  quote: RemoteAPIResponse,
  signal?: AbortSignal
): Promise<{
  success: boolean
  data?: USDConversions["remote"]
  error?: string
}> => {
  if (!quote?.employment) {
    return { success: false, error: "No Remote quote provided" }
  }

  const costs = quote.employment.employer_currency_costs
  const sourceCurrency = costs.currency.code
  if (sourceCurrency === "USD") {
    return { success: true, data: undefined } // Already in USD
  }

  try {
    const amountsToConvert = [
      costs.monthly_gross_salary,
      costs.monthly_contributions_total,
      costs.monthly_total,
      costs.monthly_tce,
    ]

    const conversionPromises = amountsToConvert.map((amount) =>
      convertCurrency(amount, sourceCurrency, "USD", signal)
    )

    const conversionResults = await Promise.all(conversionPromises)

    if (signal?.aborted) {
      return { success: false, error: "Conversion aborted" };
    }

    const failedConversion = conversionResults.find((r) => !r.success)
    if (failedConversion) {
      throw new Error(failedConversion.error || "A currency conversion failed")
    }

    const successfulResults = conversionResults.map((r) => r.data!)

    return {
      success: true,
      data: {
        monthlySalary: successfulResults[0].target_amount,
        monthlyContributions: successfulResults[1].target_amount,
        monthlyTotal: successfulResults[2].target_amount,
        monthlyTce: successfulResults[3].target_amount,
      },
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: "Conversion aborted" };
    }
    return {
      success: false,
      error: "Failed to convert Remote quote to USD - " + (error instanceof Error ? error.message : "Unknown error"),
    }
  }
}