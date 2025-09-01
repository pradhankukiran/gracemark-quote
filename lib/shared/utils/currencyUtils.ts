// lib/shared/utils/currencyUtils.ts - Consolidated currency utilities

import { convertCurrency } from "@/lib/currency-converter"
import { Quote, DeelAPIResponse, RemoteAPIResponse, USDConversions, DeelQuote, RemoteQuote, RivermateQuote } from "@/lib/shared/types"

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
 * Converts a Deel quote to USD with dedicated implementation
 */
export const convertDeelQuoteToUsd = async (
  quote: DeelQuote,
  signal?: AbortSignal
): Promise<{
  success: boolean
  data?: USDConversions["deel"]
  error?: string
}> => {
  if (!quote) {
    return { success: false, error: "No Deel quote provided" }
  }

  console.log("=== DEEL USD CONVERSION ===", quote.currency, "->", "USD")

  const sourceCurrency = quote.currency
  if (sourceCurrency === "USD") {
    return { success: true, data: undefined } // Already in USD
  }

  try {
    const clean = (v: string) => v?.toString().replace(/[\,\s]/g, '') || '0'
    
    // Prepare amounts for conversion
    const amountsToConvert = [
      Number.parseFloat(clean(quote.salary)),
      Number.parseFloat(clean(quote.deel_fee)),
      ...quote.costs.map((cost) => Number.parseFloat(clean(cost.amount))),
      Number.parseFloat(clean(quote.total_costs)),
    ]

    // Convert all amounts to USD
    const conversionPromises = amountsToConvert.map((amount) => 
      convertCurrency(amount, sourceCurrency, "USD", signal)
    )

    const conversionResults = await Promise.all(conversionPromises)

    if (signal?.aborted) {
      return { success: false, error: "Deel conversion aborted" };
    }

    const failedConversion = conversionResults.find((r) => !r.success)
    if (failedConversion) {
      throw new Error(failedConversion.error || "A Deel currency conversion failed")
    }

    const convertedAmounts = conversionResults.map((r) => r.data!.target_amount)

    const result = {
      salary: convertedAmounts[0],
      deelFee: convertedAmounts[1],
      costs: convertedAmounts.slice(2, -1),
      totalCosts: convertedAmounts[convertedAmounts.length - 1],
    }

    console.log("✅ Deel USD conversion successful")
    return { success: true, data: result }
  } catch (error) {
    console.error("❌ Deel USD conversion failed:", error instanceof Error ? error.message : error)
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: "Deel conversion aborted" };
    }
    return {
      success: false,
      error: "Failed to convert Deel quote to USD - " + (error instanceof Error ? error.message : "Unknown error"),
    }
  }
}

/**
 * Converts a Rivermate quote to USD with dedicated implementation
 */
export const convertRivermateQuoteToUsd = async (
  quote: RivermateQuote,
  signal?: AbortSignal
): Promise<{
  success: boolean
  data?: USDConversions["rivermate"]
  error?: string
}> => {
  if (!quote) {
    return { success: false, error: "No Rivermate quote provided" }
  }

  console.log("=== RIVERMATE USD CONVERSION ===", quote.currency, "->", "USD")

  const sourceCurrency = quote.currency
  if (sourceCurrency === "USD") {
    return { success: true, data: undefined } // Already in USD
  }

  try {
    // Prepare amounts for conversion using Rivermate's optimized structure
    const amountsToConvert = [
      quote.salary,
      quote.managementFee,
      ...quote.taxItems.map((item) => item.amount),
      quote.accrualsProvision,
      quote.total,
    ]

    // Convert all amounts to USD
    const conversionPromises = amountsToConvert.map((amount) =>
      convertCurrency(amount, sourceCurrency, "USD", signal)
    )

    const conversionResults = await Promise.all(conversionPromises)

    if (signal?.aborted) {
      return { success: false, error: "Rivermate conversion aborted" };
    }

    const failedConversion = conversionResults.find((r) => !r.success)
    if (failedConversion) {
      throw new Error(failedConversion.error || "A Rivermate currency conversion failed")
    }

    const convertedAmounts = conversionResults.map((r) => r.data!.target_amount)

    const result = {
      salary: convertedAmounts[0],
      deelFee: convertedAmounts[1], // Management fee maps to deelFee for compatibility
      costs: convertedAmounts.slice(2, -2), // Tax items + accruals provision
      totalCosts: convertedAmounts[convertedAmounts.length - 1],
    }

    console.log("✅ Rivermate USD conversion successful")
    return { success: true, data: result }
  } catch (error) {
    console.error("❌ Rivermate USD conversion failed:", error instanceof Error ? error.message : error)
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: "Rivermate conversion aborted" };
    }
    return {
      success: false,
      error: "Failed to convert Rivermate quote to USD - " + (error instanceof Error ? error.message : "Unknown error"),
    }
  }
}

/**
 * Converts a Remote quote to USD
 */
export const convertRemoteQuoteToUsd = async (
  quote: RemoteQuote,
  signal?: AbortSignal
): Promise<{
  success: boolean
  data?: USDConversions["remote"]
  error?: string
}> => {
  if (!quote) {
    return { success: false, error: "No Remote quote provided" }
  }

  console.log("=== REMOTE USD CONVERSION ===", quote.currency, "->", "USD")

  const sourceCurrency = quote.currency
  if (sourceCurrency === "USD") {
    return { success: true, data: undefined } // Already in USD
  }

  try {
    // Prepare amounts for conversion using Remote's optimized structure
    const amountsToConvert = [
      quote.salary,
      quote.contributions,
      quote.total,
      quote.tce,
    ]

    const conversionPromises = amountsToConvert.map((amount) =>
      convertCurrency(amount, sourceCurrency, "USD", signal)
    )

    const conversionResults = await Promise.all(conversionPromises)

    if (signal?.aborted) {
      return { success: false, error: "Remote conversion aborted" };
    }

    const failedConversion = conversionResults.find((r) => !r.success)
    if (failedConversion) {
      throw new Error(failedConversion.error || "A Remote currency conversion failed")
    }

    const convertedAmounts = conversionResults.map((r) => r.data!.target_amount)

    const result = {
      monthlySalary: convertedAmounts[0],
      monthlyContributions: convertedAmounts[1],
      monthlyTotal: convertedAmounts[2],
      monthlyTce: convertedAmounts[3],
    }

    console.log("✅ Remote USD conversion successful")
    return { success: true, data: result }
  } catch (error) {
    console.error("❌ Remote USD conversion failed:", error instanceof Error ? error.message : error)
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: "Remote conversion aborted" };
    }
    return {
      success: false,
      error: "Failed to convert Remote quote to USD - " + (error instanceof Error ? error.message : "Unknown error"),
    }
  }
}

