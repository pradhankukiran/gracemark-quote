export interface ConversionData {
  exchange_rate: string
  target_currency: {
    code: string
    name: string
    symbol: string
  }
  source_currency: {
    code: string
    name: string
    symbol: string
  }
  source_amount: number
  target_amount: number
}

export interface CurrencyConversionResult {
  success: boolean
  data?: {
    conversion_data: ConversionData
  }
  error?: string
}

export interface CurrencyProvider {
  convertCurrency(
    amount: number,
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<CurrencyConversionResult>
  
  getName(): string
}