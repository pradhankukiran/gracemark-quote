// lib/shared/utils/dataValidation.ts - Runtime data validation utilities

import { QuoteData, EORFormData, DeelAPIResponse, DualCurrencyQuotes } from "@/lib/shared/types"

/**
 * Type guard to check if a value is a string
 */
const isString = (value: unknown): value is string => {
  return typeof value === 'string'
}

/**
 * Type guard to check if a value is a number
 */
const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value)
}

/**
 * Type guard to check if a value is a valid object (not null, not array)
 */
const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validates EORFormData structure
 */
export const validateEORFormData = (data: unknown): data is EORFormData => {
  if (!isObject(data)) return false

  // Check required string fields
  const requiredStringFields = [
    'employeeName', 'jobTitle', 'country', 'currency', 'clientName', 
    'clientCountry', 'clientCurrency', 'baseSalary', 'employmentType'
  ]
  
  for (const field of requiredStringFields) {
    if (!isString(data[field])) {
      console.warn(`Invalid EORFormData: ${field} must be a string`)
      return false
    }
  }

  // Check boolean fields
  if (typeof data.workVisaRequired !== 'boolean' || typeof data.isCurrencyManuallySet !== 'boolean') {
    console.warn('Invalid EORFormData: boolean fields are invalid')
    return false
  }

  return true
}

/**
 * Validates DeelAPIResponse structure
 */
export const validateDeelAPIResponse = (data: unknown): data is DeelAPIResponse => {
  if (!isObject(data)) return false

  // Check required string fields
  const requiredFields = [
    'provider', 'salary', 'currency', 'country', 'country_code',
    'deel_fee', 'total_costs', 'employer_costs'
  ]

  for (const field of requiredFields) {
    if (!isString(data[field])) {
      console.warn(`Invalid DeelAPIResponse: ${field} must be a string`)
      return false
    }
  }

  // Check costs array
  if (!Array.isArray(data.costs)) {
    console.warn('Invalid DeelAPIResponse: costs must be an array')
    return false
  }

  // Validate each cost item
  for (const cost of data.costs) {
    if (!isObject(cost) || 
        !isString(cost.name) || 
        !isString(cost.amount) || 
        !isString(cost.frequency)) {
      console.warn('Invalid DeelAPIResponse: cost item structure is invalid')
      return false
    }
  }

  return true
}

/**
 * Validates DualCurrencyQuotes structure
 */
export const validateDualCurrencyQuotes = (data: unknown): data is DualCurrencyQuotes => {
  if (!isObject(data)) return false

  // Check boolean fields
  const booleanFields = [
    'isCalculatingSelected', 'isCalculatingLocal', 
    'isCalculatingCompareSelected', 'isCalculatingCompareLocal',
    'isDualCurrencyMode', 'hasComparison'
  ]

  for (const field of booleanFields) {
    if (typeof data[field] !== 'boolean') {
      console.warn(`Invalid DualCurrencyQuotes: ${field} must be a boolean`)
      return false
    }
  }

  // Validate quote objects (they can be null)
  const quoteFields = [
    'selectedCurrencyQuote', 'localCurrencyQuote',
    'compareSelectedCurrencyQuote', 'compareLocalCurrencyQuote'
  ]

  for (const field of quoteFields) {
    const quote = data[field]
    if (quote !== null && !validateDeelAPIResponse(quote)) {
      console.warn(`Invalid DualCurrencyQuotes: ${field} is not a valid quote`)
      return false
    }
  }

  return true
}

/**
 * Validates QuoteData structure
 */
export const validateQuoteData = (data: unknown): data is QuoteData => {
  if (!isObject(data)) {
    console.warn('Invalid QuoteData: not an object')
    return false
  }

  // Check calculatorType
  if (data.calculatorType !== 'eor' && data.calculatorType !== 'ic') {
    console.warn('Invalid QuoteData: calculatorType must be "eor" or "ic"')
    return false
  }

  // Check status
  const validStatuses = ['calculating', 'completed', 'error']
  if (!validStatuses.includes(data.status)) {
    console.warn('Invalid QuoteData: status must be calculating, completed, or error')
    return false
  }

  // Check metadata
  if (!isObject(data.metadata) || 
      !isNumber(data.metadata.timestamp) || 
      !isString(data.metadata.currency)) {
    console.warn('Invalid QuoteData: metadata structure is invalid')
    return false
  }

  // Check quotes object
  if (!isObject(data.quotes)) {
    console.warn('Invalid QuoteData: quotes must be an object')
    return false
  }

  // Validate quote objects if they exist
  if (data.quotes.deel && !validateDeelAPIResponse(data.quotes.deel)) {
    console.warn('Invalid QuoteData: deel quote is invalid')
    return false
  }

  if (data.quotes.comparison && !validateDeelAPIResponse(data.quotes.comparison)) {
    console.warn('Invalid QuoteData: comparison quote is invalid')
    return false
  }

  // Validate formData based on calculatorType
  if (data.calculatorType === 'eor' && !validateEORFormData(data.formData)) {
    console.warn('Invalid QuoteData: EOR form data is invalid')
    return false
  }

  // Validate dualCurrencyQuotes if it exists
  if (data.dualCurrencyQuotes && !validateDualCurrencyQuotes(data.dualCurrencyQuotes)) {
    console.warn('Invalid QuoteData: dual currency quotes are invalid')
    return false
  }

  return true
}

/**
 * Safely validates and casts data to QuoteData type
 */
export const safeValidateQuoteData = (data: unknown): { isValid: boolean; data?: QuoteData; error?: string } => {
  try {
    if (validateQuoteData(data)) {
      return { isValid: true, data: data as QuoteData }
    } else {
      return { isValid: false, error: 'Quote data structure validation failed' }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown validation error'
    return { isValid: false, error: errorMessage }
  }
}

/**
 * Validates that a quote ID is properly formatted
 */
export const validateQuoteId = (quoteId: string | null): { isValid: boolean; error?: string } => {
  if (!quoteId) {
    return { isValid: false, error: 'Quote ID is required' }
  }

  if (!isString(quoteId)) {
    return { isValid: false, error: 'Quote ID must be a string' }
  }

  // Check if it matches expected format: quote_timestamp_randomstring
  const quoteIdPattern = /^quote_\d+_[a-z0-9]+$/
  if (!quoteIdPattern.test(quoteId)) {
    return { isValid: false, error: 'Quote ID format is invalid' }
  }

  return { isValid: true }
}