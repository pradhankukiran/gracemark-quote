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

// Helper function to safely access USD conversion data
const getProviderUsdConversion = (
  usdConversions: CompatibleUsdConversions, 
  provider: string, 
  isComparison: boolean = false
): USDConversions['deel'] | undefined => {
  const conversions = usdConversions as Record<string, unknown>
  
  if (isComparison) {
    switch (provider) {
      case 'remote': return conversions.compareRemote as USDConversions['deel'] | undefined
      case 'rivermate': 
      case 'oyster': return conversions.compare as USDConversions['deel'] | undefined
      case 'rippling': return conversions.compareRippling as USDConversions['deel'] | undefined
      case 'skuad': return conversions.compareSkuad as USDConversions['deel'] | undefined
      case 'velocity': return conversions.compareVelocity as USDConversions['deel'] | undefined
      default: return conversions.compare as USDConversions['deel'] | undefined
    }
  } else {
    switch (provider) {
      case 'remote': return conversions.remote as USDConversions['deel'] | undefined
      case 'rivermate':
      case 'oyster': return conversions.deel as USDConversions['deel'] | undefined
      case 'rippling': return conversions.rippling as USDConversions['deel'] | undefined
      case 'skuad': return conversions.skuad as USDConversions['deel'] | undefined
      case 'velocity': return conversions.velocity as USDConversions['deel'] | undefined
      default: return conversions.deel as USDConversions['deel'] | undefined
    }
  }
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
          usdConversions={getProviderUsdConversion(usdConversions, provider, false)}
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
          usdConversions={getProviderUsdConversion(usdConversions, provider, true)}
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
