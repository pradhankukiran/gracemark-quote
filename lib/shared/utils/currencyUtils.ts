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
 * Fetches a single FX rate for `sourceCurrency -> USD` so all amounts in a
 * single quote conversion can be multiplied by the same rate. This avoids
 * per-line drift caused by fallback providers picking different rates across
 * concurrent `convertCurrency` calls.
 */
const fetchUsdRate = async (
  sourceCurrency: string,
  signal?: AbortSignal
): Promise<number> => {
  const result = await convertCurrency(1, sourceCurrency, "USD", signal)
  if (!result.success || !result.data) {
    throw new Error(result.error || `Failed to fetch USD rate for ${sourceCurrency}`)
  }
  const { source_amount, target_amount } = result.data
  // Prefer the exact ratio over the (rounded/string) `exchange_rate` field for
  // arithmetic precision.
  const rate = source_amount > 0 ? target_amount / source_amount : target_amount
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid USD rate for ${sourceCurrency}: ${rate}`)
  }
  return rate
}

/**
 * Converts a Deel quote to USD with dedicated implementation.
 *
 * Rate-locked: a single FX rate is fetched once per quote and applied to
 * every line item, fee, and total. This guarantees the displayed total
 * equals the sum of the displayed line items (no per-line drift).
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

  // console.log("=== DEEL USD CONVERSION ===", quote.currency, "->", "USD")

  const sourceCurrency = quote.currency
  if (sourceCurrency === "USD") {
    return { success: true, data: undefined } // Already in USD
  }

  try {
    const clean = (v: string) => v?.toString().replace(/[\,\s]/g, '') || '0'

    // Single FX call: locks the rate for this quote conversion.
    const rate = await fetchUsdRate(sourceCurrency, signal)

    if (signal?.aborted) {
      return { success: false, error: "Deel conversion aborted" };
    }

    // Pure-local multiplications for every amount.
    const toUsd = (raw: string | number) => {
      const n = typeof raw === 'number' ? raw : Number.parseFloat(clean(raw))
      return Number.isFinite(n) ? n * rate : 0
    }

    const convertedSalary = toUsd(quote.salary)
    const convertedFee = toUsd(quote.deel_fee)
    const convertedSeverance = toUsd(quote.severance_accural || '0')
    const convertedCosts = quote.costs.map((cost) => toUsd(cost.amount))
    const convertedTotal = toUsd(quote.total_costs)

    const result = {
      salary: convertedSalary,
      deelFee: convertedFee,
      costs: convertedCosts,
      // Exclude platform fee and severance from totals (preserve original semantics).
      totalCosts: convertedTotal - convertedFee - convertedSeverance,
    }

    // console.log("✅ Deel USD conversion successful")
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
 * Converts a Rivermate quote to USD with dedicated implementation.
 *
 * Rate-locked: see {@link fetchUsdRate}. One FX call, all amounts multiplied
 * locally so the converted total equals the sum of the converted line items.
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

  // console.log("=== RIVERMATE USD CONVERSION ===", quote.currency, "->", "USD")

  const sourceCurrency = quote.currency
  if (sourceCurrency === "USD") {
    return { success: true, data: undefined } // Already in USD
  }

  try {
    // Single FX call: locks the rate for this quote conversion.
    const rate = await fetchUsdRate(sourceCurrency, signal)

    if (signal?.aborted) {
      return { success: false, error: "Rivermate conversion aborted" };
    }

    // Local multiplication EXCLUDING management fee and accruals (preserved semantics).
    const convertedSalary = quote.salary * rate
    const convertedTaxItems = quote.taxItems.map((item) => item.amount * rate)
    const convertedTotal = convertedSalary + convertedTaxItems.reduce((sum, v) => sum + v, 0)

    const result = {
      salary: convertedSalary,
      deelFee: 0, // Excluded
      costs: convertedTaxItems, // Only tax items
      totalCosts: convertedTotal, // Salary + tax items only
    }

    // console.log("✅ Rivermate USD conversion successful")
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
 * Converts a Remote quote to USD.
 *
 * Rate-locked: see {@link fetchUsdRate}. One FX call, all amounts multiplied
 * locally so the converted total equals the sum of the converted line items.
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

  // console.log("=== REMOTE USD CONVERSION ===", quote.currency, "->", "USD")

  const sourceCurrency = quote.currency
  if (sourceCurrency === "USD") {
    return { success: true, data: undefined } // Already in USD
  }

  try {
    // Single FX call: locks the rate for this quote conversion.
    const rate = await fetchUsdRate(sourceCurrency, signal)

    if (signal?.aborted) {
      return { success: false, error: "Remote conversion aborted" };
    }

    // Local multiplication using Remote's optimized structure.
    const result = {
      monthlySalary: quote.salary * rate,
      monthlyContributions: quote.contributions * rate,
      monthlyTotal: quote.total * rate,
      monthlyTce: quote.tce * rate,
    }

    // console.log("✅ Remote USD conversion successful")
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
 * Converts an Oyster quote to USD (salary + employer contributions only).
 *
 * Rate-locked: see {@link fetchUsdRate}. One FX call, all amounts multiplied
 * locally so the converted total equals the sum of the converted line items.
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
    // Single FX call: locks the rate for this quote conversion.
    const rate = await fetchUsdRate(sourceCurrency, signal)

    if (signal?.aborted) return { success: false, error: "Oyster conversion aborted" }

    const salary = quote.salary * rate
    const costs = quote.contributions.map(c => c.amount * rate)
    const totalCosts = salary + costs.reduce((s, v) => s + v, 0)

    return { success: true, data: { salary, costs, totalCosts } }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: "Oyster conversion aborted" }
    }
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
