// lib/shared/utils/localOfficeData.ts - Local office data for LATAM countries

import { LocalOfficeInfo } from "@/lib/shared/types"

interface LocalOfficeData {
  [countryCode: string]: LocalOfficeInfo
}

const FALLBACK_LOCAL_OFFICE_MONTHLY_USD = 250

const createFallbackLocalOfficeInfo = (): LocalOfficeInfo => ({
  mealVoucher: 'N/A',
  transportation: 'N/A',
  wfh: 'N/A',
  healthInsurance: 'N/A',
  monthlyPaymentsToLocalOffice: FALLBACK_LOCAL_OFFICE_MONTHLY_USD.toFixed(2),
  vat: 'N/A',
  preEmploymentMedicalTest: 'N/A',
  drugTest: 'N/A',
  backgroundCheckViaDeel: 'N/A'
})

// Base data with USD values that need to be converted to local currency
export const LOCAL_OFFICE_DATA: LocalOfficeData = {
  CO: { // Colombia - USD fields will be converted to COP
    mealVoucher: 'N/A',
    transportation: '200000', // Local currency (COP)
    wfh: '200000', // Local currency (COP)
    healthInsurance: 'No',
    monthlyPaymentsToLocalOffice: '150.00', // USD - will be converted to COP
    vat: '19',
    preEmploymentMedicalTest: '20.00', // USD - will be converted to COP
    drugTest: '30.00', // USD - will be converted to COP
    backgroundCheckViaDeel: '200.00' // USD - will be converted to COP
  },
  BR: { // Brazil - USD fields will be converted to BRL
    mealVoucher: '880', // Local currency (BRL)
    transportation: '880', // Local currency (BRL)
    wfh: 'N/A',
    healthInsurance: '970', // Local currency (BRL)
    monthlyPaymentsToLocalOffice: '120.00', // USD - will be converted to BRL
    vat: '19',
    preEmploymentMedicalTest: 'N/A',
    drugTest: 'N/A',
    backgroundCheckViaDeel: '200.00' // USD - will be converted to BRL
  },
  AR: { // Argentina - USD fields will be converted to ARS
    mealVoucher: '0',
    transportation: '0',
    wfh: '100', // USD - will be converted to ARS
    healthInsurance: 'No',
    monthlyPaymentsToLocalOffice: '180.00', // USD - will be converted to ARS
    vat: '21',
    preEmploymentMedicalTest: '40.00', // USD - will be converted to ARS
    drugTest: '50.00', // USD - will be converted to ARS
    backgroundCheckViaDeel: '200.00' // USD - will be converted to ARS
  },
  MX: { // Mexico - USD fields will be converted to MXN
    mealVoucher: '0',
    transportation: '0',
    wfh: 'N/A',
    healthInsurance: 'No',
    monthlyPaymentsToLocalOffice: '290.00', // USD - will be converted to MXN
    vat: '18',
    preEmploymentMedicalTest: 'N/A',
    drugTest: 'N/A',
    backgroundCheckViaDeel: '200.00' // USD - will be converted to MXN
  },
  CL: { // Chile
    mealVoucher: '0',
    transportation: '0',
    wfh: 'N/A',
    healthInsurance: 'No',
    monthlyPaymentsToLocalOffice: 'N/A',
    vat: '19',
    preEmploymentMedicalTest: 'N/A',
    drugTest: 'N/A',
    backgroundCheckViaDeel: 'N/A'
  },
  PE: { // Peru - Local PEN values only
    mealVoucher: '0',
    transportation: '0',
    wfh: '100', // Local currency (PEN)
    healthInsurance: 'No',
    monthlyPaymentsToLocalOffice: 'N/A',
    vat: 'N/A',
    preEmploymentMedicalTest: 'N/A',
    drugTest: 'N/A',
    backgroundCheckViaDeel: 'N/A'
  }
}

export const getLocalOfficeData = (countryCode: string): LocalOfficeInfo | null => {
  const data = LOCAL_OFFICE_DATA[countryCode]
  if (data) {
    return { ...data }
  }
  return createFallbackLocalOfficeInfo()
}

// Get the original USD-based data (before conversion)
export const getOriginalLocalOfficeData = (countryCode: string): LocalOfficeInfo | null => {
  const data = LOCAL_OFFICE_DATA[countryCode]
  if (data) {
    return { ...data }
  }
  return createFallbackLocalOfficeInfo()
}

export const hasLocalOfficeData = (countryCode: string): boolean => {
  return countryCode in LOCAL_OFFICE_DATA
}

// Fields that are originally in USD and need conversion to local currency
export const getFieldCurrency = (field: keyof LocalOfficeInfo, countryCode: string): 'local' | 'usd' => {
  const usdFields: (keyof LocalOfficeInfo)[] = [
    'monthlyPaymentsToLocalOffice',
    'preEmploymentMedicalTest', 
    'drugTest',
    'backgroundCheckViaDeel'
  ]
  
  // Special cases for Argentina WFH (USD) and Peru WFH (local)
  if (field === 'wfh') {
    return countryCode === 'AR' ? 'usd' : 'local'
  }
  
  return usdFields.includes(field) ? 'usd' : 'local'
}

// Check if a field's value needs USD to local currency conversion
export const needsUSDConversion = (field: keyof LocalOfficeInfo, countryCode: string, value: string): boolean => {
  // Skip conversion for non-numeric values
  if (!value || value === 'N/A' || value === 'No' || isNaN(Number(value))) {
    return false
  }
  
  // Only convert fields that are marked as USD fields
  return getFieldCurrency(field, countryCode) === 'usd'
}

export const getDefaultLocalOfficeInfo = (): LocalOfficeInfo => {
  return createFallbackLocalOfficeInfo()
}
