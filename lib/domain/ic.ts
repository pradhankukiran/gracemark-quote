// Pure IC (Independent Contractor) bill-rate / markup math.
// No I/O, no React, no FX conversion — caller resolves currencies before calling.

import { DEFAULT_IC_MARKUP } from "@/lib/constants"

export interface ICKernelInput {
  /** Pay rate in the active currency. Hourly OR monthly. */
  rateAmount: number
  /** "hourly" or "monthly" — determines whether `rateAmount` is divided by `workedHours`. */
  rateBasis: "hourly" | "monthly"
  /** Hours worked per month. Use 160 for a full-time default. */
  workedHours: number
  /** 0–100 (e.g. 40 for 40% markup). Falls back to `DEFAULT_IC_MARKUP` if missing/invalid. */
  markupPercentage?: number
  /** 0–50 (e.g. 5 for 5% MSP). Defaults to 0 when missing/invalid. */
  mspPercentage?: number
  /** Already-resolved monthly transaction cost in the active currency. */
  transactionCost: number
  /** Already-resolved monthly background-check amortization in the active currency. */
  backgroundCheckMonthlyFee: number
}

export interface ICKernelOutput {
  payRate: number
  billRate: number
  agencyFee: number
  monthlyPayRate: number
  monthlyBillRate: number
  monthlyAgencyFee: number
  mspFee: number
  totalMonthlyCosts: number
  monthlyMarkup: number
}

/**
 * Compute IC quote core values. Pure: no FX, no rounding (caller rounds at the
 * boundary). Inputs already in the same currency.
 *
 * Mirrors the math in `app/api/ic-cost/route.ts:78-99`.
 */
export function composeICQuote(input: ICKernelInput): ICKernelOutput {
  const markupRate = Number.isFinite(input.markupPercentage) && (input.markupPercentage as number) > 0
    ? (input.markupPercentage as number) / 100
    : DEFAULT_IC_MARKUP

  const mspRate = Number.isFinite(input.mspPercentage) && (input.mspPercentage as number) > 0
    ? (input.mspPercentage as number) / 100
    : 0

  const payRate = input.rateBasis === "monthly"
    ? input.rateAmount / input.workedHours
    : input.rateAmount

  const agencyFee = payRate * markupRate
  const billRate = payRate + agencyFee

  const monthlyPayRate = payRate * input.workedHours
  const monthlyBillRate = billRate * input.workedHours
  const monthlyAgencyFee = agencyFee * input.workedHours

  const mspFeeHourly = billRate * mspRate
  const mspFee = mspFeeHourly * input.workedHours

  const totalMonthlyCosts =
    monthlyPayRate + input.transactionCost + input.backgroundCheckMonthlyFee + mspFee
  const monthlyMarkup = monthlyBillRate - totalMonthlyCosts

  return {
    payRate,
    billRate,
    agencyFee,
    monthlyPayRate,
    monthlyBillRate,
    monthlyAgencyFee,
    mspFee,
    totalMonthlyCosts,
    monthlyMarkup,
  }
}
