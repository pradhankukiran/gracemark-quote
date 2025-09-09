// lib/shared/utils/currencyUtils.ts - Consolidated currency utilities

import { convertCurrency } from "@/lib/currency-converter"
import { USDConversions, DeelQuote, RemoteQuote, RivermateQuote, OysterQuote } from "@/lib/shared/types"

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
    
    // Prepare amounts for conversion, including severance accrual so we can exclude it from totals later
    const amountsToConvert = [
      Number.parseFloat(clean(quote.salary)),
      Number.parseFloat(clean(quote.deel_fee)),
      Number.parseFloat(clean(quote.severance_accural || '0')),
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

    // Exclude platform fee from totals (but keep individual conversion values)
    const convertedSalary = convertedAmounts[0]
    const convertedFee = convertedAmounts[1]
    const convertedSeverance = convertedAmounts[2]
    const convertedCosts = convertedAmounts.slice(3, -1)
    const convertedTotal = convertedAmounts[convertedAmounts.length - 1]

    const result = {
      salary: convertedSalary,
      deelFee: convertedFee,
      costs: convertedCosts,
      totalCosts: convertedTotal - convertedFee - convertedSeverance,
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
    // Prepare amounts for conversion EXCLUDING management fee and accruals
    const amountsToConvert = [
      quote.salary,
      ...quote.taxItems.map((item) => item.amount),
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
    const convertedSalary = convertedAmounts[0]
    const convertedTaxItems = convertedAmounts.slice(1)
    const convertedTotal = convertedSalary + convertedTaxItems.reduce((sum, v) => sum + v, 0)

    const result = {
      salary: convertedSalary,
      deelFee: 0, // Excluded
      costs: convertedTaxItems, // Only tax items
      totalCosts: convertedTotal, // Salary + tax items only
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

/**
 * Converts an Oyster quote to USD (salary + employer contributions only)
 */
export const convertOysterQuoteToUsd = async (
  quote: OysterQuote,
  signal?: AbortSignal
): Promise<{ success: boolean; data?: USDConversions["oyster"]; error?: string }> => {
  if (!quote) return { success: false, error: "No Oyster quote provided" }

  const sourceCurrency = quote.currency
  if (sourceCurrency === "USD") {
    return { success: true, data: undefined }
  }

  try {
    const amountsToConvert = [
      quote.salary,
      ...quote.contributions.map(c => c.amount),
    ]

    const results = await Promise.all(
      amountsToConvert.map(a => convertCurrency(a, sourceCurrency, "USD", signal))
    )

    if (signal?.aborted) return { success: false, error: "Oyster conversion aborted" }

    const failed = results.find(r => !r.success)
    if (failed) throw new Error(failed.error || "A Oyster currency conversion failed")

    const conv = results.map(r => r.data!.target_amount)
    const salary = conv[0]
    const costs = conv.slice(1)
    const totalCosts = salary + costs.reduce((s, v) => s + v, 0)

    return { success: true, data: { salary, costs, totalCosts } }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: "Oyster conversion aborted" }
    }
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
