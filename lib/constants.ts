// Pricing engine constants. Centralized so business rules live in one place.

// GraceMark's target margin on EOR bill rate (45%).
export const GRACEMARK_FEE_PERCENTAGE = 0.45

// Provider service fee derived as a fraction of the GraceMark fee (30%).
export const PROVIDER_FEE_RATIO = 0.30

// Minimum absolute monthly profit in USD before a quote falls below the floor.
export const MIN_PROFIT_THRESHOLD_USD = 1000

// 1% buffer over MIN_PROFIT_THRESHOLD_USD when targeting profit (avoids
// quotes landing exactly at the floor).
export const MIN_PROFIT_TARGET_BUFFER = 1.01

// Default IC markup percentage (40%).
export const DEFAULT_IC_MARKUP = 0.40

// Reconciliation variance band against the Deel anchor: ±4%.
export const VARIANCE_LOWER_BOUND = 0.96
export const VARIANCE_UPPER_BOUND = 1.04
