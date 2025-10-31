// Updated to use consolidated data structure and added missing getCountryData export
import {
  allCountries,
  allCurrencies,
  getCountryByCode,
  getCountryByName,
  getCurrencyForCountry,
  getCurrencyInfo,
  getStatesForCountry,
  hasStates,
  getStateTypeLabel,
  getAvailableCountries,
  getEORSupportedCountries,
  type CountryInfo,
  type Currency,
  type CountryState,
} from "./data"

// Legacy interface for backward compatibility
export interface CountryLegalRequirements {
  country: string
  currency: string
  probationPeriod: number
  noticePeriod: number
  severancePay: number
  vacationDays: number
  has13thSalary: boolean
  has14thSalary: boolean
  vacationBonus: number
  transportationAllowance: number
  socialSecurityRate: number
  incomeTaxRate: number
  medicalExamRequired: boolean
  medicalExamCost: number
  platformFeeRate: number
  minimumWage: number
}

// Mock legal requirements data for countries that need calculations
// In a real implementation, this would come from a comprehensive legal database
const mockLegalRequirements: Record<string, CountryLegalRequirements> = {
  "United States of America": {
    country: "United States of America",
    currency: "USD",
    probationPeriod: 3,
    noticePeriod: 0,
    severancePay: 0,
    vacationDays: 10,
    has13thSalary: false,
    has14thSalary: false,
    vacationBonus: 0,
    transportationAllowance: 0,
    socialSecurityRate: 0.0765,
    incomeTaxRate: 0.22,
    medicalExamRequired: false,
    medicalExamCost: 0,
    platformFeeRate: 0.08,
    minimumWage: 1260,
  },
  Brazil: {
    country: "Brazil",
    currency: "BRL",
    probationPeriod: 3,
    noticePeriod: 1,
    severancePay: 1,
    vacationDays: 30,
    has13thSalary: true,
    has14thSalary: false,
    vacationBonus: 0.33,
    transportationAllowance: 220,
    socialSecurityRate: 0.28,
    incomeTaxRate: 0.15,
    medicalExamRequired: true,
    medicalExamCost: 150,
    platformFeeRate: 0.12,
    minimumWage: 1320,
  },
  Germany: {
    country: "Germany",
    currency: "EUR",
    probationPeriod: 6,
    noticePeriod: 1,
    severancePay: 0.5,
    vacationDays: 24,
    has13thSalary: false,
    has14thSalary: false,
    vacationBonus: 0,
    transportationAllowance: 0,
    socialSecurityRate: 0.195,
    incomeTaxRate: 0.25,
    medicalExamRequired: false,
    medicalExamCost: 0,
    platformFeeRate: 0.1,
    minimumWage: 2080,
  },
  "United Kingdom": {
    country: "United Kingdom",
    currency: "GBP",
    probationPeriod: 6,
    noticePeriod: 1,
    severancePay: 0,
    vacationDays: 28,
    has13thSalary: false,
    has14thSalary: false,
    vacationBonus: 0,
    transportationAllowance: 0,
    socialSecurityRate: 0.138,
    incomeTaxRate: 0.2,
    medicalExamRequired: false,
    medicalExamCost: 0,
    platformFeeRate: 0.09,
    minimumWage: 1950,
  },
  Mexico: {
    country: "Mexico",
    currency: "MXN",
    probationPeriod: 1,
    noticePeriod: 0,
    severancePay: 3,
    vacationDays: 12,
    has13thSalary: true,
    has14thSalary: false,
    vacationBonus: 0.25,
    transportationAllowance: 0,
    socialSecurityRate: 0.25,
    incomeTaxRate: 0.16,
    medicalExamRequired: true,
    medicalExamCost: 100,
    platformFeeRate: 0.11,
    minimumWage: 5255,
  },
  Philippines: {
    country: "Philippines",
    currency: "PHP",
    probationPeriod: 6,
    noticePeriod: 1,
    severancePay: 0.5,
    vacationDays: 15,
    has13thSalary: true,
    has14thSalary: false,
    vacationBonus: 0,
    transportationAllowance: 0,
    socialSecurityRate: 0.125,
    incomeTaxRate: 0.15,
    medicalExamRequired: true,
    medicalExamCost: 80,
    platformFeeRate: 0.09,
    minimumWage: 25000,
  },
  Canada: {
    country: "Canada",
    currency: "CAD",
    probationPeriod: 3,
    noticePeriod: 2,
    severancePay: 1,
    vacationDays: 15,
    has13thSalary: false,
    has14thSalary: false,
    vacationBonus: 0.04,
    transportationAllowance: 0,
    socialSecurityRate: 0.0595,
    incomeTaxRate: 0.26,
    medicalExamRequired: false,
    medicalExamCost: 0,
    platformFeeRate: 0.08,
    minimumWage: 2600,
  },
  France: {
    country: "France",
    currency: "EUR",
    probationPeriod: 4,
    noticePeriod: 1,
    severancePay: 0.25,
    vacationDays: 25,
    has13thSalary: false,
    has14thSalary: false,
    vacationBonus: 0,
    transportationAllowance: 0,
    socialSecurityRate: 0.42,
    incomeTaxRate: 0.3,
    medicalExamRequired: true,
    medicalExamCost: 200,
    platformFeeRate: 0.12,
    minimumWage: 1766,
  },
}

// Default legal requirements for countries not in the mock data
const getDefaultLegalRequirements = (countryName: string, currency: string): CountryLegalRequirements => ({
  country: countryName,
  currency,
  probationPeriod: 3,
  noticePeriod: 1,
  severancePay: 0.5,
  vacationDays: 20,
  has13thSalary: false,
  has14thSalary: false,
  vacationBonus: 0,
  transportationAllowance: 0,
  socialSecurityRate: 0.15,
  incomeTaxRate: 0.2,
  medicalExamRequired: false,
  medicalExamCost: 0,
  platformFeeRate: 0.1,
  minimumWage: 1000,
})

// Added missing getCountryData export
export const getCountryData = (countryName: string): CountryLegalRequirements | null => {
  const country = getCountryByName(countryName)
  if (!country) return null

  const currency = getCurrencyForCountry(country.code)

  // Return mock data if available, otherwise return default requirements
  return mockLegalRequirements[countryName] || getDefaultLegalRequirements(countryName, currency)
}

// Re-export everything from the consolidated data file
export {
  allCountries,
  allCurrencies,
  getCountryByCode,
  getCountryByName,
  getCurrencyForCountry,
  getCurrencyInfo,
  getStatesForCountry,
  hasStates,
  getStateTypeLabel,
  getAvailableCountries,
  getEORSupportedCountries,
  type CountryInfo,
  type Currency,
  type CountryState,
}
