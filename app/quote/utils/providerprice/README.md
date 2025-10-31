# Provider Price Extractors

This directory contains provider-specific price extraction logic for the EOR quote reconciliation system.

## Structure

Each provider has its own dedicated file with a function that extracts and calculates the total monthly price from raw quotes and enhancements:

- `getDeelProviderPrice.ts` - Deel-specific price extraction
- `getRemoteProviderPrice.ts` - Remote-specific price extraction
- `getRivermateProviderPrice.ts` - Rivermate-specific price extraction (manual salary + tax + accruals calculation)
- `getOysterProviderPrice.ts` - Oyster-specific price extraction
- `getRipplingProviderPrice.ts` - Rippling-specific price extraction
- `getSkuadProviderPrice.ts` - Skuad-specific price extraction
- `getVelocityProviderPrice.ts` - Velocity-specific price extraction
- `getPlayrollProviderPrice.ts` - Playroll-specific price extraction
- `getOmnipresentProviderPrice.ts` - Omnipresent-specific price extraction

## Shared Utilities

`sharedUtils.ts` contains helper functions used across all provider extractors:

- `parseNumericValue()` - Parses numeric values from various formats
- `pickPositive()` - Returns the first positive numeric value from a list
- `baseQuoteContainsPattern()` - Checks if base quote contains a pattern (for duplicate detection)
- `resolveEnhancementMonthly()` - Resolves monthly enhancement amounts
- `computeEnhancementAddOns()` - Computes total enhancement add-ons

## How It Works

### With Enhancement Data
When enhancement exists (normal flow):
1. Uses `enhancement.monthlyCostBreakdown.baseCost` - the exact base used in enhancement calculation
2. Uses `enhancement.monthlyCostBreakdown.enhancements` - pre-calculated and deduplicated enhancements
3. Returns `baseCost + enhancements`

**Important:** The extractors use `enhancement.baseQuote.monthlyTotal` as the source for base cost. This ensures consistency with the enhancement calculation and prevents discrepancies from re-extracting raw quote data.

### Without Enhancement Data
When enhancement doesn't exist (fallback):
- Extracts base total directly from raw quote using provider-specific logic
- Returns the base total without enhancements

## Usage

Import the provider-specific extractors from the index file:

```typescript
import {
  getDeelProviderPrice,
  getRemoteProviderPrice,
  // ... other providers
} from './utils/providerprice'

const price = getDeelProviderPrice(rawQuote, enhancement, contractMonths)
```

## Function Signature

All provider price extractors follow the same signature:

```typescript
function getProviderPrice(
  rawQuote: unknown,
  enhancement: EnhancedQuote | undefined,
  contractMonths: number
): number | null
```

**Parameters:**
- `rawQuote` - The raw quote data from the provider API
- `enhancement` - Optional enhancement data with additional costs
- `contractMonths` - Number of months for the contract

**Returns:**
- `number` - The total monthly price (base + enhancements when enhancement exists)
- `null` - If no valid price could be extracted
