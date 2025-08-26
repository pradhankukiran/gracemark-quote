// lib/shared/types/index.ts - Consolidated type definitions

// Selected Benefit Information
export interface SelectedBenefit {
  planId: string
  planName: string
  providerId: string
  providerName: string
  price: number
  currency: string
  isMandatory: boolean
  benefitName: string
}

// Local Office Information
export interface LocalOfficeInfo {
  mealVoucher: string
  transportation: string
  wfh: string
  healthInsurance: string
  monthlyPaymentsToLocalOffice: string
  vat: string
  preEmploymentMedicalTest: string
  drugTest: string
  backgroundCheckViaDeel: string
}

// Form Data Interfaces
export interface EORFormData {
  employeeName: string
  jobTitle: string
  workVisaRequired: boolean
  country: string
  state: string
  currency: string
  isCurrencyManuallySet: boolean
  originalCurrency?: string
  clientName: string
  clientType: 'new' | 'existing' | null
  clientCountry: string
  clientCurrency: string
  baseSalary: string
  holidayDays: string
  probationPeriod: string
  hoursPerDay: string
  daysPerWeek: string
  startDate: string
  employmentType: string
  quoteType: "all-inclusive" | "statutory-only"
  contractDuration: string
  enableComparison: boolean
  compareCountry: string
  compareState: string
  compareCurrency: string
  compareSalary: string
  currentStep: "form" | "primary-quote" | "comparison"
  showProviderComparison: boolean
  showOptionalEmployeeData: boolean
  showBenefits: boolean
  selectedBenefits: {
    [key: string]: SelectedBenefit | undefined
  }
  localOfficeInfo: LocalOfficeInfo
}

// Quote Cost Interface
export interface QuoteCost {
  name: string
  amount: string
  frequency: string
  country: string
  country_code: string
}

// Main Quote Interface (previously DeelAPIResponse)
export interface Quote {
  provider: string
  salary: string
  currency: string
  country: string
  state?: {
    label: string
    value: string
  }
  country_code: string
  deel_fee: string
  severance_accural: string
  total_costs: string
  employer_costs: string
  costs: QuoteCost[]
  benefits_data: unknown[]
  additional_data: {
    additional_notes: string[]
  }
}

// Keep DeelAPIResponse as alias for backward compatibility
export type DeelAPIResponse = Quote

// Remote API Response (for Remote.com integration)
export interface RemoteAPIResponse {
  provider: string
  country: string
  currency: string
  salary: {
    annual: number
    monthly: number
  }
  costs: {
    annual_contributions: number
    monthly_contributions: number
    annual_total: number
    monthly_total: number
    monthly_tce: number
    extra_statutory_payments_total: number
    extra_statutory_payments_monthly: number
  }
  regional_costs: {
    currency: string
    annual_gross_salary: number
    monthly_gross_salary: number
    annual_contributions: number
    monthly_contributions: number
    annual_total: number
    monthly_total: number
    monthly_tce: number
    extra_statutory_payments_total: number
    extra_statutory_payments_monthly: number
  }
  details: {
    minimum_onboarding_time: number
    has_extra_statutory_payment: boolean
    country_benefits_url: string
    country_guide_url: string | null
  }
}

// Validation API Response
export interface ValidationAPIResponse {
  data: {
    holiday: {
      min: string
      max: string | null
      mostCommon: string
    }
    part_time_holiday: {
      type: string
      min: string
    }
    sick_days: {
      min: string | null
      max: string | null
    }
    salary: {
      min: string
      max: string
      frequency: string
    }
    probation: {
      min: string | null
      max: string | null
      probationRulesForJobCategorisation: unknown[]
    }
    part_time_probation: {
      min: string | null
      max: string | null
    }
    work_schedule: {
      days: {
        max: string
        min: string
      }
      hours: {
        max: string
        min: string
      }
    }
    currency: string
    hiring_guide_country_name: string
    start_date_buffer: number
    definite_contract: {
      type: string
      maximum_limitation: string | null
    }
    adjustments_information_box: string
    health_insurance: {
      status: string
      providers: Array<{
        id: string
        name: string
        is_unisure: boolean
        home_page_url: string
        currency: string
        attachments: unknown[]
        plans: Array<{
          name: string
          price: string
          currency: string
          is_enabled: boolean
          id: string
        }>
      }>
    }
    pension: {
      status: string
      providers: Array<{
        id: string
        name: string
        home_page_url: string
        contribution: {
          type: string
          minimum: string
          maximum: string
        }
      }>
    }
    mandatory_fields: unknown[]
  }
}

// USD Conversion Types
export interface USDConversions {
  deel?: {
    salary: number
    deelFee: number
    costs: number[]
    totalCosts: number
  }
  compare?: {
    salary: number
    deelFee: number
    costs: number[]
    totalCosts: number
  }
  remote?: {
    monthlySalary: number
    monthlyContributions: number
    monthlyTotal: number
    monthlyTce: number
  }
}

// Dual Currency Quote Management
export interface DualCurrencyQuotes {
  selectedCurrencyQuote: Quote | null
  localCurrencyQuote: Quote | null
  compareSelectedCurrencyQuote: Quote | null
  compareLocalCurrencyQuote: Quote | null
  isCalculatingSelected: boolean
  isCalculatingLocal: boolean
  isCalculatingCompareSelected: boolean
  isCalculatingCompareLocal: boolean
  isDualCurrencyMode: boolean
  hasComparison: boolean
}

// Validation Error Types
export interface ValidationErrors {
  salary: string | null
  holidays: string | null
  probation: string | null
  hours: string | null
  days: string | null
}

// Benefits API Types
export interface BenefitsAPIResponse {
  data: Benefit[]
}

export interface Benefit {
  name: string
  description: string
  is_mandatory: boolean
  is_discriminatory: boolean
  providers: Provider[]
}

export interface Provider {
  id: string
  name: string
  type: string
  is_unisure: boolean
  currency: string
  country: string | null
  home_page_url: string
  attachments: Attachment[]
  plans: Plan[]
  contribution_options: ContributionOption[]
  min_contribution: number | null
  max_contribution: number | null
  client_info: string | null
  employee_info: string | null
}

export interface Plan {
  id: string
  name: string
  price: number
  attachments: Attachment[]
}

export interface Attachment {
  id: string
  label: string
  url: string
}

export interface ContributionOption {
  id: string
  amount: number
}

// Quote Result Data Structure
export interface QuoteData {
  calculatorType: 'eor' | 'ic'
  formData: EORFormData | Record<string, unknown>
  quotes: {
    deel?: Quote
    remote?: RemoteAPIResponse
    comparison?: Quote
  }
  metadata: {
    timestamp: number
    currency: string
    usdConversions?: USDConversions
  }
  dualCurrencyQuotes?: DualCurrencyQuotes
  status: 'calculating' | 'completed' | 'error'
  error?: string
}