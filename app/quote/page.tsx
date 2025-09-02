"use client"

import { useEffect, Suspense, memo } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calculator, Clock, CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"
import { useQuoteResults } from "./hooks/useQuoteResults"
import { useUSDConversion } from "../eor-calculator/hooks/useUSDConversion"
import { GenericQuoteCard } from "@/lib/shared/components/GenericQuoteCard"
import { QuoteComparison } from "../eor-calculator/components/QuoteComparison"
import { ErrorBoundary } from "@/lib/shared/components/ErrorBoundary"
import { ProviderSelector } from "./components/ProviderSelector"
import { transformRemoteResponseToQuote, transformRivermateQuoteToDisplayQuote, transformToRemoteQuote, transformOysterQuoteToDisplayQuote } from "@/lib/shared/utils/apiUtils"
import { EORFormData, RemoteAPIResponse } from "@/lib/shared/types"

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
    isConvertingRemoteToUsd,
    isConvertingCompareRemoteToUsd,
    isConvertingRivermateToUsd,
    isConvertingCompareRivermateToUsd,
    isConvertingOysterToUsd,
    isConvertingCompareOysterToUsd,
    usdConversionError,
    autoConvertQuote,
    autoConvertRemoteQuote,
  } = useUSDConversion()

  // Auto-convert primary Deel quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'deel' && quoteData.quotes.deel) {
      const cleanup = autoConvertQuote(quoteData.quotes.deel, "deel")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.deel, currentProvider, autoConvertQuote])

  // Auto-convert comparison Deel quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'deel' && quoteData.quotes.comparisonDeel) {
      const cleanup = autoConvertQuote(quoteData.quotes.comparisonDeel, "compare")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.comparisonDeel, currentProvider, autoConvertQuote])

  // Auto-convert primary Rivermate quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'rivermate' && quoteData.quotes.rivermate) {
      const cleanup = autoConvertQuote(quoteData.quotes.rivermate, "rivermate")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.rivermate, currentProvider, autoConvertQuote])

  // Auto-convert comparison Rivermate quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'rivermate' && quoteData.quotes.comparisonRivermate) {
      const cleanup = autoConvertQuote(quoteData.quotes.comparisonRivermate, "compareRivermate")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.comparisonRivermate, currentProvider, autoConvertQuote])

  // Auto-convert primary Remote quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'remote' && quoteData.quotes.remote) {
      // quotes.remote is RemoteAPIResponse; convert to optimized RemoteQuote for USD conversion
      // Guard in case of legacy shape
      const isRaw = !!(quoteData.quotes.remote as any)?.employment;
      const remoteForConversion = isRaw 
        ? transformToRemoteQuote(quoteData.quotes.remote as any)
        : (quoteData.quotes.remote as any);
      const cleanup = autoConvertRemoteQuote(remoteForConversion, "remote")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.remote, currentProvider, autoConvertRemoteQuote])

  // Auto-convert comparison Remote quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'remote' && quoteData.quotes.comparisonRemote) {
      // quotes.comparisonRemote is RemoteAPIResponse; convert to optimized for USD conversion
      // Guard in case of legacy shape
      const isRaw = !!(quoteData.quotes.comparisonRemote as any)?.employment;
      const remoteForConversion = isRaw 
        ? transformToRemoteQuote(quoteData.quotes.comparisonRemote as any)
        : (quoteData.quotes.comparisonRemote as any);
      const cleanup = autoConvertRemoteQuote(remoteForConversion, "compareRemote")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.comparisonRemote, currentProvider, autoConvertRemoteQuote])

  // Auto-convert primary Oyster quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'oyster' && quoteData.quotes.oyster) {
      const cleanup = autoConvertQuote(quoteData.quotes.oyster as any, "oyster")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.oyster, currentProvider, autoConvertQuote])

  // Auto-convert comparison Oyster quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'oyster' && quoteData.quotes.comparisonOyster) {
      const cleanup = autoConvertQuote(quoteData.quotes.comparisonOyster as any, "compareOyster")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.comparisonOyster, currentProvider, autoConvertQuote])

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
                Please wait while we calculate your EOR costs for {(quoteData.formData as EORFormData).country}...
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

  const renderQuote = () => {
    if (providerLoading[currentProvider]) {
      return (
        <div className="flex justify-center items-center h-40">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-slate-600">Loading {currentProvider === 'deel' ? 'Deel' : currentProvider === 'remote' ? 'Remote' : currentProvider === 'rivermate' ? 'Rivermate' : 'Oyster'} quote...</p>
          </div>
        </div>
      );
    }

    const quote = currentProvider === 'deel'
      ? quoteData.quotes.deel
      : currentProvider === 'remote'
        ? (quoteData.quotes.remote 
            // If raw RemoteAPIResponse present, transform for display; if legacy optimized present, we cannot build full breakdown
            ? (('employment' in (quoteData.quotes.remote as any)) 
                ? transformRemoteResponseToQuote(quoteData.quotes.remote as any)
                : undefined)
            : undefined)
        : currentProvider === 'rivermate' ? (
            // Rivermate: stored optimized quote for conversion; build display-friendly quote here
            quoteData.quotes.rivermate && ('taxItems' in (quoteData.quotes.rivermate as any))
              ? transformRivermateQuoteToDisplayQuote(quoteData.quotes.rivermate as any)
              : (quoteData.quotes.rivermate as any)
          ) : (
            // Oyster: stored optimized quote for conversion; build display-friendly quote here
            quoteData.quotes.oyster && ('contributions' in (quoteData.quotes.oyster as any))
              ? transformOysterQuoteToDisplayQuote(quoteData.quotes.oyster as any)
              : (quoteData.quotes.oyster as any)
          );
    const dualCurrencyQuotes = currentProvider === 'deel'
      ? quoteData.dualCurrencyQuotes?.deel
      : currentProvider === 'remote'
        ? quoteData.dualCurrencyQuotes?.remote
        : currentProvider === 'rivermate'
          ? quoteData.dualCurrencyQuotes?.rivermate
          : quoteData.dualCurrencyQuotes?.oyster;
    const isConvertingToUSD = currentProvider === 'deel'
      ? isConvertingDeelToUsd
      : currentProvider === 'remote'
        ? isConvertingRemoteToUsd
        : currentProvider === 'rivermate'
          ? isConvertingRivermateToUsd
          : isConvertingOysterToUsd;
    const conversions = currentProvider === 'deel'
      ? usdConversions.deel
      : currentProvider === 'remote'
        ? usdConversions.remote
        : currentProvider === 'rivermate'
          ? usdConversions.rivermate
          : usdConversions.oyster;
    const eorForm = quoteData.formData as EORFormData;

    if (!quote && !dualCurrencyQuotes) return null;

    return (
      <GenericQuoteCard
        quote={quote}
        title={`${quote?.country || eorForm.country}`}
        provider={currentProvider}
        usdConversions={conversions}
        isConvertingToUSD={isConvertingToUSD}
        usdConversionError={usdConversionError}
        dualCurrencyQuotes={dualCurrencyQuotes}
        originalCurrency={eorForm.originalCurrency || undefined}
        selectedCurrency={eorForm.currency}
      />
    );
  };

  const renderComparison = () => {
    const eorForm = quoteData.formData as EORFormData;
    if (providerLoading[currentProvider] || !eorForm.enableComparison) return null;

    if (currentProvider === 'deel') {
      if (!quoteData.quotes.deel || !quoteData.quotes.comparisonDeel) return null;
      return (
        <QuoteComparison
          provider="deel"
          primaryQuote={quoteData.quotes.deel}
          comparisonQuote={quoteData.quotes.comparisonDeel}
          primaryTitle={eorForm.country}
          comparisonTitle={eorForm.compareCountry}
          usdConversions={usdConversions}
          isConvertingPrimaryToUSD={isConvertingDeelToUsd}
          isConvertingComparisonToUSD={isConvertingCompareToUsd}
          usdConversionError={usdConversionError}
          dualCurrencyQuotes={quoteData.dualCurrencyQuotes?.deel}
        />
      );
    }

    if (currentProvider === 'rivermate') {
      if (!quoteData.quotes.rivermate || !quoteData.quotes.comparisonRivermate) return null;

      // Transform optimized rivermate quotes to display quotes when not in dual mode
      const primaryIsOptimized = 'taxItems' in (quoteData.quotes.rivermate as any);
      const compareIsOptimized = 'taxItems' in (quoteData.quotes.comparisonRivermate as any);

      const primaryDisplay = primaryIsOptimized
        ? transformRivermateQuoteToDisplayQuote(quoteData.quotes.rivermate as any)
        : (quoteData.quotes.rivermate as any);
      const compareDisplay = compareIsOptimized
        ? transformRivermateQuoteToDisplayQuote(quoteData.quotes.comparisonRivermate as any)
        : (quoteData.quotes.comparisonRivermate as any);

      return (
        <QuoteComparison
          provider="rivermate"
          primaryQuote={primaryDisplay}
          comparisonQuote={compareDisplay}
          primaryTitle={eorForm.country}
          comparisonTitle={eorForm.compareCountry}
          usdConversions={{ deel: usdConversions.rivermate, compare: usdConversions.compareRivermate }}
          isConvertingPrimaryToUSD={isConvertingRivermateToUsd}
          isConvertingComparisonToUSD={isConvertingCompareRivermateToUsd}
          usdConversionError={usdConversionError}
          dualCurrencyQuotes={quoteData.dualCurrencyQuotes?.rivermate}
        />
      );
    }

    if (currentProvider === 'oyster') {
      if (!quoteData.quotes.oyster || !quoteData.quotes.comparisonOyster) return null;

      return (
        <QuoteComparison
          provider="oyster"
          primaryQuote={('contributions' in (quoteData.quotes.oyster as any))
            ? transformOysterQuoteToDisplayQuote(quoteData.quotes.oyster as any)
            : (quoteData.quotes.oyster as any)}
          comparisonQuote={('contributions' in (quoteData.quotes.comparisonOyster as any))
            ? transformOysterQuoteToDisplayQuote(quoteData.quotes.comparisonOyster as any)
            : (quoteData.quotes.comparisonOyster as any)}
          primaryTitle={eorForm.country}
          comparisonTitle={eorForm.compareCountry}
          usdConversions={{ deel: usdConversions.oyster, compare: usdConversions.compareOyster }}
          isConvertingPrimaryToUSD={isConvertingOysterToUsd}
          isConvertingComparisonToUSD={isConvertingCompareOysterToUsd}
          usdConversionError={usdConversionError}
          dualCurrencyQuotes={quoteData.dualCurrencyQuotes?.oyster}
        />
      );
    }

    if (currentProvider === 'remote') {
      if (!quoteData.quotes.remote || !quoteData.quotes.comparisonRemote) return null;

      const providerDual = quoteData.dualCurrencyQuotes?.remote;
      const hasDualCompare = providerDual?.isDualCurrencyMode && providerDual?.hasComparison;

      // Build flattened dual objects for each card (like QuoteComparison does)
      const primaryCardDualQuotes = hasDualCompare ? {
        ...providerDual,
        selectedCurrencyQuote: providerDual.selectedCurrencyQuote,
        localCurrencyQuote: providerDual.localCurrencyQuote,
        compareSelectedCurrencyQuote: null,
        compareLocalCurrencyQuote: null,
        hasComparison: false,
      } : undefined;

      const comparisonCardDualQuotes = hasDualCompare ? {
        ...providerDual,
        selectedCurrencyQuote: providerDual.compareSelectedCurrencyQuote,
        localCurrencyQuote: providerDual.compareLocalCurrencyQuote,
        compareSelectedCurrencyQuote: null,
        compareLocalCurrencyQuote: null,
        hasComparison: false,
      } : undefined;

      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <GenericQuoteCard
              quote={hasDualCompare ? undefined : (('employment' in (quoteData.quotes.remote as any)) ? transformRemoteResponseToQuote(quoteData.quotes.remote as RemoteAPIResponse) : undefined)}
              title={`${(quoteData.formData as EORFormData).country}`}
              provider="remote"
              badgeText="Main Quote"
              badgeColor="bg-blue-100 text-blue-800"
              usdConversions={usdConversions.remote}
              isConvertingToUSD={isConvertingRemoteToUsd}
              usdConversionError={usdConversionError}
              compact={true}
              originalCurrency={(quoteData.formData as EORFormData).originalCurrency || undefined}
              selectedCurrency={(quoteData.formData as EORFormData).currency}
              dualCurrencyQuotes={primaryCardDualQuotes}
            />
          </div>
          <div>
            <GenericQuoteCard
              quote={hasDualCompare ? undefined : (('employment' in (quoteData.quotes.comparisonRemote as any)) ? transformRemoteResponseToQuote(quoteData.quotes.comparisonRemote as RemoteAPIResponse) : undefined)}
              title={`${quoteData.formData.compareCountry}`}
              provider="remote"
              badgeText="Compare Quote"
              badgeColor="bg-green-100 text-green-800"
              usdConversions={usdConversions.compareRemote}
              isConvertingToUSD={isConvertingCompareRemoteToUsd}
              usdConversionError={usdConversionError}
              compact={true}
              dualCurrencyQuotes={comparisonCardDualQuotes}
            />
          </div>
        </div>
      );
    }

    return null;
  };

  // Completed state
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="space-y-8">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Your EOR Quote
              </h1>
            </div>
          </div>

          <div className="flex justify-center mb-8">
            <ProviderSelector
              currentProvider={currentProvider}
              onProviderChange={switchProvider}
              loading={providerLoading}
              disabled={loading || quoteData?.status !== 'completed'}
            />
          </div>

          {(() => {
            const eorForm = quoteData.formData as EORFormData;
            if (eorForm.enableComparison) {
              return (
                <div className="max-w-7xl mx-auto">
                  {renderComparison()}
                </div>
              );
            } else {
              return (
                <div className="max-w-4xl mx-auto">
                  {renderQuote()}
                </div>
              );
            }
          })()}

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
