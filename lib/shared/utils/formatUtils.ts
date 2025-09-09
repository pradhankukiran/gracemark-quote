// Format Utils - Safe formatting utilities to prevent runtime errors

/**
 * Safely formats a number using toLocaleString() with fallback handling
 * @param value - The value to format (can be number, undefined, null, NaN)
 * @param defaultValue - Value to use if input is invalid (default: 0)
 * @param locale - Locale for formatting (default: 'en-US')
 * @param options - Intl.NumberFormat options
 * @returns Formatted string or formatted default value
 */
export const safeToLocaleString = (
  value: number | undefined | null,
  defaultValue: number = 0,
  locale: string = 'en-US',
  options?: Intl.NumberFormatOptions
): string => {
  // Handle undefined, null, or NaN values
  if (value === undefined || value === null || isNaN(value)) {
    return defaultValue.toLocaleString(locale, options)
  }
  
  // Ensure we have a valid number
  if (typeof value !== 'number') {
    return defaultValue.toLocaleString(locale, options)
  }
  
  return value.toLocaleString(locale, options)
}

/**
 * Safely parses a monetary value from string format
 * @param value - String value that might contain currency symbols, commas
 * @param defaultValue - Value to return if parsing fails
 * @returns Parsed number or default value
 */
export const parseMoney = (value: string | undefined | null, defaultValue: number = 0): number => {
  if (!value || typeof value !== 'string') {
    return defaultValue
  }
  
  try {
    // Remove currency symbols, commas, and spaces
    const cleaned = value.replace(/[$,\s]/g, '')
    const parsed = parseFloat(cleaned)
    
    // Return default if parsing resulted in NaN
    return isNaN(parsed) ? defaultValue : parsed
  } catch {
    return defaultValue
  }
}

/**
 * Safely formats currency with symbol
 * @param amount - Amount to format
 * @param currency - Currency symbol or code
 * @param defaultValue - Fallback if amount is invalid
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: number | undefined | null,
  currency: string = 'USD',
  defaultValue: number = 0
): string => {
  const safeAmount = safeToLocaleString(amount, defaultValue)
  return `${currency} ${safeAmount}`
}

/**
 * Safely gets a numeric value with fallback
 * @param value - Value to check
 * @param defaultValue - Fallback value
 * @returns Valid number or default
 */
export const safeNumber = (value: number | undefined | null, defaultValue: number = 0): number => {
  if (value === undefined || value === null || isNaN(value)) {
    return defaultValue
  }
  
  if (typeof value !== 'number') {
    return defaultValue
  }
  
  return value
}

/**
 * Safely calculates a difference between two numbers
 * @param a - First number
 * @param b - Second number  
 * @param defaultA - Fallback for first number
 * @param defaultB - Fallback for second number
 * @returns Safe difference
 */
export const safeDifference = (
  a: number | undefined | null,
  b: number | undefined | null,
  defaultA: number = 0,
  defaultB: number = 0
): number => {
  const safeA = safeNumber(a, defaultA)
  const safeB = safeNumber(b, defaultB)
  
  return safeA - safeB
}