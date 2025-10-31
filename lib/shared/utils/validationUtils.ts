// lib/shared/utils/validationUtils.ts - Shared validation utilities

import { ValidationAPIResponse } from "@/lib/shared/types"

// LATAM countries that require Local Office Information
const LATAM_COUNTRIES = ['CO', 'BR', 'AR', 'MX', 'CL', 'PE']

export const isLatamCountry = (countryCode?: string | null): boolean => {
  if (!countryCode) return false
  return LATAM_COUNTRIES.includes(countryCode)
}

export const isValidNumericFormat = (value: string): boolean => {
  if (value === "") return true
  const numericRegex = /^\d*\.?\d*$/
  return numericRegex.test(value)
}

export const validateFinalNumericInput = (
  value: string, 
  min?: number, 
  max?: number
): boolean => {
  if (value === "") return true
  
  if (!isValidNumericFormat(value)) return false
  
  const numValue = Number(value)
  
  if (isNaN(numValue)) return false
  
  if (min === undefined && max === undefined) return true
  
  if (min !== undefined && numValue < min) return false
  if (max !== undefined && numValue > max) return false
  
  return true
}

export const validateSalaryInput = (
  value: string, 
  validationData: ValidationAPIResponse | null
): boolean => {
  if (!validationData?.data?.salary) return true
  
  const min = validationData.data.salary.min ? Number(validationData.data.salary.min) : undefined
  const max = validationData.data.salary.max ? Number(validationData.data.salary.max) : undefined
  return validateFinalNumericInput(value, min, max)
}

export const validateHolidayInput = (
  value: string, 
  validationData: ValidationAPIResponse | null
): boolean => {
  if (!validationData?.data?.holiday) return true
  
  const min = validationData.data.holiday.min ? Number(validationData.data.holiday.min) : undefined
  const max = validationData.data.holiday.max ? Number(validationData.data.holiday.max) : undefined
  return validateFinalNumericInput(value, min, max)
}

export const validateProbationInput = (
  value: string, 
  validationData: ValidationAPIResponse | null
): boolean => {
  if (!validationData?.data?.probation) return true
  
  const min = validationData.data.probation.min ? Number(validationData.data.probation.min) : undefined
  const max = validationData.data.probation.max ? Number(validationData.data.probation.max) : undefined
  return validateFinalNumericInput(value, min, max)
}

export const validateHoursInput = (
  value: string, 
  validationData: ValidationAPIResponse | null
): boolean => {
  if (!validationData?.data?.work_schedule) return true
  
  const min = validationData.data.work_schedule.hours.min ? Number(validationData.data.work_schedule.hours.min) : undefined
  const max = validationData.data.work_schedule.hours.max ? Number(validationData.data.work_schedule.hours.max) : undefined
  return validateFinalNumericInput(value, min, max)
}

export const validateDaysInput = (
  value: string, 
  validationData: ValidationAPIResponse | null
): boolean => {
  if (!validationData?.data?.work_schedule) return true
  
  const min = validationData.data.work_schedule.days.min ? Number(validationData.data.work_schedule.days.min) : undefined
  const max = validationData.data.work_schedule.days.max ? Number(validationData.data.work_schedule.days.max) : undefined
  return validateFinalNumericInput(value, min, max)
}

export const generateValidationErrorMessage = (
  field: 'salary' | 'holiday' | 'probation' | 'hours' | 'days',
  validationData: ValidationAPIResponse | null,
  currency?: string
): string => {
  if (!validationData?.data) return `Invalid ${field}.`

  let min: number | undefined
  let max: number | undefined
  let unit = ''
  let fieldName: string = field

  switch (field) {
    case 'salary':
      if (!validationData.data.salary) return "Invalid salary amount."
      min = validationData.data.salary.min ? Number(validationData.data.salary.min) : undefined
      max = validationData.data.salary.max ? Number(validationData.data.salary.max) : undefined
      unit = currency || validationData.data.currency || ''
      break
    case 'holiday':
      if (!validationData.data.holiday) return "Invalid holiday days."
      min = validationData.data.holiday.min ? Number(validationData.data.holiday.min) : undefined
      max = validationData.data.holiday.max ? Number(validationData.data.holiday.max) : undefined
      fieldName = 'Holiday days'
      break
    case 'probation':
      if (!validationData.data.probation) return "Invalid probation period."
      min = validationData.data.probation.min ? Number(validationData.data.probation.min) : undefined
      max = validationData.data.probation.max ? Number(validationData.data.probation.max) : undefined
      unit = 'days'
      fieldName = 'Probation period'
      break
    case 'hours':
      if (!validationData.data.work_schedule) return "Invalid hours per day."
      min = validationData.data.work_schedule.hours.min ? Number(validationData.data.work_schedule.hours.min) : undefined
      max = validationData.data.work_schedule.hours.max ? Number(validationData.data.work_schedule.hours.max) : undefined
      fieldName = 'Hours per day'
      break
    case 'days':
      if (!validationData.data.work_schedule) return "Invalid days per week."
      min = validationData.data.work_schedule.days.min ? Number(validationData.data.work_schedule.days.min) : undefined
      max = validationData.data.work_schedule.days.max ? Number(validationData.data.work_schedule.days.max) : undefined
      fieldName = 'Days per week'
      break
  }

  if (min !== undefined && max !== undefined) {
    return `${fieldName} must be between ${unit ? unit + ' ' : ''}${min.toLocaleString()} and ${unit ? unit + ' ' : ''}${max.toLocaleString()}${unit === 'days' ? ' ' + unit : ''}`
  } else if (min !== undefined) {
    return `${fieldName} must be at least ${unit ? unit + ' ' : ''}${min.toLocaleString()}${unit === 'days' ? ' ' + unit : ''}`
  } else if (max !== undefined) {
    return `${fieldName} must not exceed ${unit ? unit + ' ' : ''}${max.toLocaleString()}${unit === 'days' ? ' ' + unit : ''}`
  }

  return `Invalid ${field}.`
}