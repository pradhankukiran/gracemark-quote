"use client"

import { useEffect, Suspense, memo } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calculator, Clock, CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"
import { useQuoteResults } from "./hooks/useQuoteResults"
import { useUSDConversion } from "../eor-calculator/hooks/useUSDConversion"
import { QuoteCard } from "@/lib/shared/components/QuoteCard"
import { RemoteQuoteCard } from "@/lib/shared/components/RemoteQuoteCard"
import { QuoteComparison } from "../eor-calculator/components/QuoteComparison"
import { ErrorBoundary } from "@/lib/shared/components/ErrorBoundary"
import { ProviderSelector } from "./components/ProviderSelector"
import { RemoteAPIResponse } from "@/lib/shared/types"

// QuoteData interface is now imported from useQuoteResults

const LoadingSpinner = () => (
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
)

const QuotePageContent = memo(() => {
  const searchParams = useSearchParams()
  const quoteId = searchParams.get('id')
  
  const { 
    quoteData, 
    loading, 
    currentProvider, 
    switchProvider, 
    providerLoading 
  } = useQuoteResults(quoteId)
  
  const {
    usdConversions,
    isConvertingDeelToUsd,
    isConvertingCompareToUsd,
    usdConversionError,
    autoConvertQuote,
  } = useUSDConversion()

  // Auto-convert primary quote to USD when it arrives (skip in dual currency mode)
  useEffect(() => {
    if (quoteData?.status === 'completed' && !quoteData.dualCurrencyQuotes?.isDualCurrencyMode && quoteData.quotes.deel && quoteData.quotes.deel.currency !== "USD") {
      const cleanup = autoConvertQuote(quoteData.quotes.deel, "deel")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.deel, quoteData?.dualCurrencyQuotes?.isDualCurrencyMode, autoConvertQuote])

  // Auto-convert comparison quote to USD when it arrives (skip in dual currency mode)
  useEffect(() => {
    if (quoteData?.status === 'completed' && !quoteData.dualCurrencyQuotes?.isDualCurrencyMode && quoteData.quotes.comparison && quoteData.quotes.comparison.currency !== "USD") {
      const cleanup = autoConvertQuote(quoteData.quotes.comparison, "compare")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.comparison, quoteData?.dualCurrencyQuotes?.isDualCurrencyMode, autoConvertQuote])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="text-center space-y-6 flex flex-col items-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Loading Quote...
            </h1>
            <LoadingSpinner />
          </div>
        </div>
      </div>
    )
  }

  if (!quoteData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-red-600">No Quote Data</h1>
            <Button asChild>
              <Link href="/eor-calculator">
                <Calculator className="h-4 w-4 mr-2" />
                Back to Calculator
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (quoteData.status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="mb-6">
            <Link
              href="/eor-calculator"
              className="inline-flex items-center gap-2 text-slate-600 hover:text-primary transition-all duration-200 hover:gap-3 font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Calculator</span>
            </Link>
          </div>

          <div className="text-center space-y-6">
            <XCircle className="h-16 w-16 text-red-500 mx-auto" />
            <div className="space-y-3">
              <h1 className="text-4xl font-bold text-red-600">Quote Generation Failed</h1>
              <p className="text-lg text-slate-600">{quoteData.error}</p>
            </div>
            <Button asChild>
              <Link href="/eor-calculator">
                <Calculator className="h-4 w-4 mr-2" />
                Try Again
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (quoteData.status === 'calculating') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="text-center space-y-6">
            <div className="space-y-3">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Generating Your Quote
              </h1>
              <p className="text-lg text-slate-600">
                Please wait while we calculate your EOR costs for {quoteData.formData.country}...
              </p>
            </div>

            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm max-w-2xl mx-auto">
              <CardContent className="p-12">
                <div className="flex flex-col items-center space-y-6">
                  <LoadingSpinner />
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Clock className="h-4 w-4" />
                    <span>Estimated time: 5-10 seconds</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Completed state
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* <div className="mb-6">
          <Link
            href="/eor-calculator"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-primary transition-all duration-200 hover:gap-3 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Calculate New Quote</span>
          </Link>
        </div> */}

        <div className="space-y-8">
          <div className="text-center space-y-3 relative">
            {/* Provider Selector - Top Right */}
            <div className="absolute top-0 right-0">
              <ProviderSelector
                currentProvider={currentProvider}
                onProviderChange={switchProvider}
                loading={providerLoading}
                disabled={loading || quoteData?.status !== 'completed'}
              />
            </div>
            
            <div className="flex items-center justify-center gap-2 mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Your EOR Quote
              </h1>
            </div>
            {/* <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Generated on {new Date(quoteData.metadata.timestamp).toLocaleDateString()}
            </p> */}
          </div>

          {/* Primary Quote Display */}
          {quoteData.status === "completed" && (
            <div className="max-w-4xl mx-auto">
              {(() => {
                const deelDualCurrency = quoteData.dualCurrencyQuotes?.deel;
                const shouldShowDeel = currentProvider === 'deel' && (
                  (deelDualCurrency?.isDualCurrencyMode && (deelDualCurrency?.selectedCurrencyQuote || deelDualCurrency?.localCurrencyQuote)) ||
                  (!deelDualCurrency?.isDualCurrencyMode && quoteData.quotes.deel)
                ) && (!quoteData.formData.enableComparison || (quoteData.formData.enableComparison && !quoteData.quotes.comparison && !deelDualCurrency?.isDualCurrencyMode));
                
                return shouldShowDeel ? (
                  <QuoteCard
                    quote={deelDualCurrency?.isDualCurrencyMode ? undefined : quoteData.quotes.deel || undefined}
                    title={`${deelDualCurrency?.isDualCurrencyMode ? 
                      (deelDualCurrency?.selectedCurrencyQuote?.country || quoteData.formData.country) : 
                      quoteData.quotes.deel?.country || quoteData.formData.country} EOR Quote`}
                    usdConversions={deelDualCurrency?.isDualCurrencyMode ? undefined : usdConversions.deel}
                    isConvertingToUSD={deelDualCurrency?.isDualCurrencyMode ? false : isConvertingDeelToUsd}
                    usdConversionError={deelDualCurrency?.isDualCurrencyMode ? null : usdConversionError}
                    dualCurrencyQuotes={deelDualCurrency}
                  />
                ) : null;
              })()}

              {(() => {
                const currentProviderDualCurrency = currentProvider === 'deel' ? quoteData.dualCurrencyQuotes?.deel : quoteData.dualCurrencyQuotes?.remote;
                const shouldShowRemote = currentProvider === 'remote' && (
                  (currentProviderDualCurrency?.isDualCurrencyMode && (currentProviderDualCurrency?.selectedCurrencyQuote || currentProviderDualCurrency?.localCurrencyQuote)) ||
                  (!currentProviderDualCurrency?.isDualCurrencyMode && quoteData.quotes.remote)
                ) && (!quoteData.formData.enableComparison || (quoteData.formData.enableComparison && !quoteData.quotes.comparison && !currentProviderDualCurrency?.isDualCurrencyMode));
                
                console.log('🎨 UI Render - Remote quote decision:', {
                  currentProvider,
                  shouldShowRemote,
                  isDualCurrencyMode: !!currentProviderDualCurrency?.isDualCurrencyMode,
                  hasRemoteQuote: !!quoteData.quotes.remote,
                  hasSelectedQuote: !!currentProviderDualCurrency?.selectedCurrencyQuote,
                  hasLocalQuote: !!currentProviderDualCurrency?.localCurrencyQuote,
                  selectedCurrency: currentProviderDualCurrency?.selectedCurrencyQuote?.currency,
                  localCurrency: currentProviderDualCurrency?.localCurrencyQuote?.currency
                });
                
                return shouldShowRemote;
              })() && (
                <>
                  {(() => {
                    const remoteDualCurrency = quoteData.dualCurrencyQuotes?.remote;
                    return remoteDualCurrency?.isDualCurrencyMode ? (
                      <>
                        {console.log('🎨 UI Render - Using QuoteCard with Remote dual currency data:', {
                          selectedQuote: remoteDualCurrency.selectedCurrencyQuote?.currency,
                          localQuote: remoteDualCurrency.localCurrencyQuote?.currency,
                          provider: 'Remote (dual currency mode)'
                        })}
                        <QuoteCard
                          quote={undefined}
                          title={`${remoteDualCurrency?.selectedCurrencyQuote?.country || quoteData.formData.country} EOR Quote`}
                          usdConversions={undefined}
                          isConvertingToUSD={false}
                          usdConversionError={null}
                          dualCurrencyQuotes={remoteDualCurrency}
                        />
                      </>
                    ) : (
                      <RemoteQuoteCard
                        quote={quoteData.quotes.remote}
                        title={`${quoteData.quotes.remote?.employment?.country?.name || quoteData.formData.country} EOR Quote`}
                        usdConversions={usdConversions.remote}
                        isConvertingToUSD={isConvertingDeelToUsd} // TODO: Add Remote-specific USD conversion
                        usdConversionError={usdConversionError}
                      />
                    );
                  })()}
                </>
              )}

              {/* Loading state for provider switching */}
              {providerLoading[currentProvider] && (
                <div className="flex justify-center items-center h-40">
                  <div className="text-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-slate-600">Loading {currentProvider === 'deel' ? 'Deel' : 'Remote'} quote...</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Country Comparison - Deel */}
          {quoteData.status === "completed" && currentProvider === 'deel' && !quoteData.dualCurrencyQuotes?.isDualCurrencyMode && quoteData.quotes.deel && quoteData.formData.enableComparison && quoteData.quotes.comparison && (
            <div className="max-w-7xl mx-auto">
              <QuoteComparison
                primaryQuote={quoteData.quotes.deel}
                comparisonQuote={quoteData.quotes.comparison}
                primaryTitle={quoteData.formData.country}
                comparisonTitle={quoteData.formData.compareCountry}
                usdConversions={usdConversions}
                isConvertingPrimaryToUSD={isConvertingDeelToUsd}
                isConvertingComparisonToUSD={isConvertingCompareToUsd}
                usdConversionError={usdConversionError}
              />
            </div>
          )}

          {/* Country Comparison - Remote (Single Currency) */}
          {quoteData.status === "completed" && currentProvider === 'remote' && !quoteData.dualCurrencyQuotes?.isDualCurrencyMode && quoteData.quotes.remote && quoteData.formData.enableComparison && quoteData.quotes.comparison && (
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <RemoteQuoteCard
                    quote={quoteData.quotes.remote}
                    title={`${quoteData.formData.country} EOR Quote`}
                    badgeText="Primary"
                    badgeColor="bg-blue-100 text-blue-800"
                    usdConversions={usdConversions.remote}
                    isConvertingToUSD={isConvertingDeelToUsd}
                    usdConversionError={usdConversionError}
                    compact={true}
                  />
                </div>
                <div>
                  <RemoteQuoteCard
                    quote={quoteData.quotes.comparison as RemoteAPIResponse}
                    title={`${quoteData.formData.compareCountry} EOR Quote`}
                    badgeText="Comparison"
                    badgeColor="bg-green-100 text-green-800"
                    usdConversions={usdConversions.remote}
                    isConvertingToUSD={isConvertingCompareToUsd}
                    usdConversionError={usdConversionError}
                    compact={true}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Country Comparison - Dual Currency Mode (Deel) */}
          {quoteData.status === "completed" && currentProvider === 'deel' && quoteData.dualCurrencyQuotes?.deel?.isDualCurrencyMode && quoteData.dualCurrencyQuotes?.deel?.hasComparison && 
           quoteData.dualCurrencyQuotes?.deel?.selectedCurrencyQuote && quoteData.dualCurrencyQuotes?.deel?.compareSelectedCurrencyQuote && (
            <div className="max-w-7xl mx-auto">
              <QuoteComparison
                primaryTitle={quoteData.formData.country}
                comparisonTitle={quoteData.formData.compareCountry}
                usdConversions={usdConversions}
                isConvertingPrimaryToUSD={isConvertingDeelToUsd}
                isConvertingComparisonToUSD={isConvertingCompareToUsd}
                usdConversionError={usdConversionError}
                dualCurrencyQuotes={{ ...quoteData.dualCurrencyQuotes, ...quoteData.dualCurrencyQuotes.deel }}
              />
            </div>
          )}

          {/* Country Comparison - Dual Currency Mode (Remote) */}
          {quoteData.status === "completed" && currentProvider === 'remote' && quoteData.dualCurrencyQuotes?.remote?.isDualCurrencyMode && quoteData.dualCurrencyQuotes?.remote?.hasComparison && 
           quoteData.dualCurrencyQuotes?.remote?.selectedCurrencyQuote && quoteData.dualCurrencyQuotes?.remote?.compareSelectedCurrencyQuote && (
            <div className="max-w-7xl mx-auto">
              <QuoteComparison
                primaryTitle={quoteData.formData.country}
                comparisonTitle={quoteData.formData.compareCountry}
                usdConversions={usdConversions}
                isConvertingPrimaryToUSD={isConvertingDeelToUsd}
                isConvertingComparisonToUSD={isConvertingCompareToUsd}
                usdConversionError={usdConversionError}
                dualCurrencyQuotes={{ ...quoteData.dualCurrencyQuotes, ...quoteData.dualCurrencyQuotes.remote }}
              />
            </div>
          )}

          {/* <div className="flex justify-center gap-4 pt-6">
            <Button asChild size="lg">
              <Link href="/eor-calculator">
                <Calculator className="h-4 w-4 mr-2" />
                Calculate New Quote
              </Link>
            </Button>
          </div> */}
        </div>
      </div>
    </div>
  )
});

QuotePageContent.displayName = 'QuotePageContent';

export default function QuotePage() {
  return (
    <ErrorBoundary
      fallbackTitle="Quote Loading Error"
      fallbackMessage="There was a problem loading your quote. This might be due to corrupted data or a temporary issue."
      onError={(error, errorInfo) => {
        console.error('Quote page error:', error, errorInfo)
        // Could send to error reporting service here
      }}
    >
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
          <div className="container mx-auto px-6 py-8 max-w-7xl">
            <div className="text-center space-y-6 flex flex-col items-center">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Loading Quote...
              </h1>
              <LoadingSpinner />
            </div>
          </div>
        </div>
      }>
        <QuotePageContent />
      </Suspense>
    </ErrorBoundary>
  )
}