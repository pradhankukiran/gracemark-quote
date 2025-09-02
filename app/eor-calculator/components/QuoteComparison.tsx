import { memo } from "react"
import { DeelAPIResponse, DualCurrencyQuotes, USDConversions } from "@/lib/shared/types"
import { GenericQuoteCard } from "@/lib/shared/components/GenericQuoteCard"

type CompatibleUsdConversions = USDConversions | {
  deel?: USDConversions['deel'] | USDConversions['oyster']
  compare?: USDConversions['compare'] | USDConversions['compareOyster']
  remote?: USDConversions['remote']
  compareRemote?: USDConversions['compareRemote']
}

interface QuoteComparisonProps {
  primaryQuote?: DeelAPIResponse
  comparisonQuote?: DeelAPIResponse
  primaryTitle: string
  comparisonTitle: string
  usdConversions: CompatibleUsdConversions
  onConvertPrimaryToUSD?: () => void
  onConvertComparisonToUSD?: () => void
  isConvertingPrimaryToUSD: boolean
  isConvertingComparisonToUSD: boolean
  usdConversionError?: string | null
  dualCurrencyQuotes?: DualCurrencyQuotes
  provider?: 'deel' | 'remote' | 'rivermate' | 'oyster' | 'rippling' | 'skuad' | 'velocity'
}

export const QuoteComparison = memo(({
  primaryQuote,
  comparisonQuote,
  primaryTitle,
  comparisonTitle,
  usdConversions,
  isConvertingPrimaryToUSD,
  isConvertingComparisonToUSD,
  usdConversionError,
  dualCurrencyQuotes,
  provider = 'deel',
}: QuoteComparisonProps) => {
  const isDualMode = dualCurrencyQuotes?.isDualCurrencyMode && dualCurrencyQuotes?.hasComparison;

  const primaryCardDualQuotes = isDualMode ? {
    ...dualCurrencyQuotes,
    selectedCurrencyQuote: dualCurrencyQuotes.selectedCurrencyQuote,
    localCurrencyQuote: dualCurrencyQuotes.localCurrencyQuote,
    compareSelectedCurrencyQuote: null,
    compareLocalCurrencyQuote: null,
    hasComparison: false,
  } : undefined;

  const comparisonCardDualQuotes = isDualMode ? {
    ...dualCurrencyQuotes,
    selectedCurrencyQuote: dualCurrencyQuotes.compareSelectedCurrencyQuote,
    localCurrencyQuote: dualCurrencyQuotes.compareLocalCurrencyQuote,
    compareSelectedCurrencyQuote: null,
    compareLocalCurrencyQuote: null,
    hasComparison: false,
  } : undefined;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <GenericQuoteCard
          provider={provider}
          quote={isDualMode ? undefined : primaryQuote}
          title={primaryTitle}
          badgeText="Main Quote"
          badgeColor="bg-green-100 text-green-800"
          usdConversions={provider === 'remote' 
            ? (usdConversions as any)?.remote 
            : provider === 'rivermate' 
              ? (usdConversions as any)?.deel 
              : provider === 'oyster' 
                ? (usdConversions as any)?.deel 
                : provider === 'rippling'
                  ? (usdConversions as any)?.rippling
                  : provider === 'skuad'
                    ? (usdConversions as any)?.skuad
                    : provider === 'velocity'
                      ? (usdConversions as any)?.velocity
                      : usdConversions?.deel}
          isConvertingToUSD={isConvertingPrimaryToUSD}
          usdConversionError={usdConversionError}
          compact={true}
          dualCurrencyQuotes={primaryCardDualQuotes}
        />

        <GenericQuoteCard
          provider={provider}
          quote={isDualMode ? undefined : comparisonQuote}
          title={comparisonTitle}
          badgeText="Compare Quote"
          badgeColor="bg-blue-100 text-blue-800"
          usdConversions={provider === 'remote' 
            ? (usdConversions as any)?.compareRemote 
            : provider === 'rivermate' 
              ? (usdConversions as any)?.compare 
              : provider === 'oyster' 
                ? (usdConversions as any)?.compare 
                : provider === 'rippling' 
                  ? (usdConversions as any)?.compareRippling
                  : provider === 'skuad'
                    ? (usdConversions as any)?.compareSkuad
                    : provider === 'velocity'
                      ? (usdConversions as any)?.compareVelocity
                      : usdConversions?.compare}
          isConvertingToUSD={isConvertingComparisonToUSD}
          usdConversionError={usdConversionError}
          compact={true}
          dualCurrencyQuotes={comparisonCardDualQuotes}
        />
      </div>
    </div>
  )
});

QuoteComparison.displayName = 'QuoteComparison';
