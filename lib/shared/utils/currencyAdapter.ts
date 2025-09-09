// Currency adapter for reconciliation - bridges official currency converter with simple interface
import { convertCurrency as officialConvertCurrency } from "@/lib/currency-converter"

/**
 * Simplified currency converter that matches ReconciliationService interface
 * Wraps the official currency converter and returns raw numbers for compatibility
 */
export async function convertCurrencyForReconciliation(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  if (!Number.isFinite(amount)) return 0
  if (!from || !to || from.toUpperCase() === to.toUpperCase()) return amount

  const result = await officialConvertCurrency(amount, from, to)
  
  if (!result.success) {
    throw new Error(result.error || 'Currency conversion failed')
  }

  return result.data?.target_amount || 0
}

/**
 * Server-side currency converter for API routes
 * Uses fetch to call the currency converter API with proper base URL handling
 */
export async function convertCurrencyServerSide(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  if (!Number.isFinite(amount)) return 0
  if (!from || !to || from.toUpperCase() === to.toUpperCase()) return amount
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const response = await fetch(`${baseUrl}/api/currency-converter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      amount, 
      source_currency: from, 
      target_currency: to 
    })
  })
  
  if (!response.ok) {
    throw new Error('Currency conversion failed')
  }
  
  const json = await response.json()
  const target = Number(json?.data?.conversion_data?.target_amount)
  
  if (!Number.isFinite(target)) {
    throw new Error('Invalid conversion result')
  }
  
  return target
}