import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Loader2 } from "lucide-react";
import { Quote, USDConversions, DualCurrencyQuotes } from "@/lib/shared/types";
import { formatCurrency } from "@/lib/shared/utils/currencyUtils";

interface QuoteCardProps {
  quote?: Quote;
  title: string;
  subtitle: string;
  badgeText?: string;
  badgeColor?: string;
  usdConversions?: USDConversions["deel"] | USDConversions["compare"];
  isConvertingToUSD?: boolean;
  compact?: boolean;
  usdConversionError?: string | null;
  // Dual currency props
  dualCurrencyQuotes?: DualCurrencyQuotes;
}

export const QuoteCard = ({
  quote,
  title,
  subtitle,
  badgeText,
  badgeColor = "bg-green-100 text-green-800",
  usdConversions,
  isConvertingToUSD = false,
  compact = false,
  usdConversionError = null,
  dualCurrencyQuotes,
}: QuoteCardProps) => {
  // Determine display mode
  const isDualCurrencyMode =
    dualCurrencyQuotes?.isDualCurrencyMode &&
    dualCurrencyQuotes?.selectedCurrencyQuote &&
    dualCurrencyQuotes?.localCurrencyQuote;

  const selectedQuote = dualCurrencyQuotes?.selectedCurrencyQuote;
  const localQuote = dualCurrencyQuotes?.localCurrencyQuote;
  const isCalculatingSelected = dualCurrencyQuotes?.isCalculatingSelected;
  const isCalculatingLocal = dualCurrencyQuotes?.isCalculatingLocal;

  // Use dual currency quotes if available, otherwise fall back to single quote
  const primaryQuote = isDualCurrencyMode ? selectedQuote : quote;

  // Always show USD columns for non-USD quotes in single currency mode
  const showUSDColumns = !isDualCurrencyMode && quote && quote.currency !== "USD";
  const hasUSDData = usdConversions && Object.keys(usdConversions).length > 0;

  const textSizes = compact
    ? { title: "text-2xl", amount: "text-base", total: "text-xl" }
    : { title: "text-2xl", amount: "text-xl", total: "text-3xl" };

  // Helper function to render cost item row
  const renderCostRow = (
    label: string,
    selectedAmount: string | number,
    localAmount?: string | number,
    isLoading = false
  ) => {
    const showDualColumns = isDualCurrencyMode || showUSDColumns;

    return (
      <div
        className={`${compact ? "py-2 px-2" : "py-3 px-4"} bg-gray-50 ${
          showDualColumns
            ? `grid ${
                compact ? "grid-cols-3 gap-2" : "grid-cols-3 gap-4"
              } items-center`
            : "flex justify-between items-center"
        }`}
      >
        <span
          className={`text-slate-600 font-medium ${
            compact ? "text-base" : "text-base"
          }`}
        >
          {label}
        </span>
        <span
          className={`font-bold ${textSizes.amount} text-slate-900 text-right`}
        >
          {isLoading ? (
            <span className="text-blue-500 animate-pulse">Loading...</span>
          ) : typeof selectedAmount === "string" ? (
            selectedAmount
          ) : (
            formatCurrency(selectedAmount, primaryQuote?.currency || "")
          )}
        </span>
        {showDualColumns && (
          <span
            className={`font-bold ${textSizes.amount} text-slate-700 text-right`}
          >
            {isLoading ? (
              <span className="text-blue-500 animate-pulse">Loading...</span>
            ) : isDualCurrencyMode && localAmount !== undefined ? (
              typeof localAmount === "string" ? (
                localAmount
              ) : (
                formatCurrency(localAmount, localQuote?.currency || "")
              )
            ) : usdConversions && localAmount !== undefined ? (
              typeof localAmount === "string" ? (
                localAmount
              ) : (
                `${localAmount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              )
            ) : isConvertingToUSD ? (
              <span className="text-blue-500 animate-pulse">Converting...</span>
            ) : usdConversionError ? (
              <span className="text-red-400 text-sm">Failed</span>
            ) : (
              <span className="text-slate-400">Pending...</span>
            )}
          </span>
        )}
      </div>
    );
  };

  // Return loading state if no quote data is available
  if (!primaryQuote && !isDualCurrencyMode) {
    return (
      <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="text-center flex-1">
            <h3 className={`${textSizes.title} font-bold text-slate-900`}>
              {title}
            </h3>
            <p className="text-base text-slate-600">{subtitle}</p>
            {badgeText && (
              <span
                className={`inline-block px-3 py-1 ${badgeColor} text-sm font-semibold rounded-full mt-2`}
              >
                {badgeText}
              </span>
            )}
          </div>

          {/* Status indicators */}
          {isDualCurrencyMode ? (
            <div className="ml-4 text-right">
              {isCalculatingSelected || isCalculatingLocal ? (
                <div className="flex items-center text-blue-600 text-sm">
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Loading dual quotes...
                </div>
              ) : (
                <div className="flex items-center text-green-600 text-sm">
                  <DollarSign className="mr-1 h-3 w-3" />
                  Dual currency view
                </div>
              )}
            </div>
          ) : (
            showUSDColumns && (
              <div className="ml-4 text-right">
                {isConvertingToUSD ? (
                  <div className="flex items-center text-blue-600 text-sm">
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Converting to USD...
                  </div>
                ) : hasUSDData ? (
                  <div className="flex items-center text-green-600 text-sm">
                    <DollarSign className="mr-1 h-3 w-3" />
                    USD prices included
                  </div>
                ) : usdConversionError ? (
                  <div className="text-red-500 text-xs max-w-32">
                    USD conversion failed
                  </div>
                ) : null}
              </div>
            )
          )}
        </div>

        <div className="space-y-4">
          {/* Header row for columns */}
          {(isDualCurrencyMode || showUSDColumns) && (
            <div
              className={`grid ${
                compact ? "grid-cols-3 gap-2 py-1 px-2" : "grid-cols-3 gap-4 py-2 px-4"
              } bg-slate-100 border-b border-slate-200`}
            >
              <span className="text-slate-700 font-semibold text-sm">
                Cost Item
              </span>
              <span className="text-slate-700 font-semibold text-sm text-right">
                {isDualCurrencyMode
                  ? compact
                    ? `${selectedQuote?.currency}`
                    : `Selected (${selectedQuote?.currency})`
                  : compact
                  ? "Local"
                  : "Local Currency"}
              </span>
              <span className="text-slate-700 font-semibold text-sm text-right">
                {isDualCurrencyMode
                  ? compact
                    ? `${localQuote?.currency}`
                    : `Local Market (${localQuote?.currency})`
                  : compact
                  ? "USD"
                  : "USD Equivalent"}
              </span>
            </div>
          )}

          {/* Base Salary */}
          {primaryQuote &&
            renderCostRow(
              "Base Salary",
              Number.parseFloat(primaryQuote.salary),
              isDualCurrencyMode && localQuote
                ? Number.parseFloat(localQuote.salary)
                : usdConversions?.salary,
              isCalculatingSelected || isCalculatingLocal
            )}

          {/* Platform Fee */}
          {primaryQuote &&
            renderCostRow(
              "Platform Fee",
              Number.parseFloat(primaryQuote.deel_fee),
              isDualCurrencyMode && localQuote
                ? Number.parseFloat(localQuote.deel_fee)
                : usdConversions?.deelFee,
              isCalculatingSelected || isCalculatingLocal
            )}

          {/* Cost items */}
          {primaryQuote?.costs.map((cost, index) => {
            const localCostAmount =
              isDualCurrencyMode && localQuote?.costs[index]
                ? Number.parseFloat(localQuote.costs[index].amount)
                : usdConversions?.costs?.[index];

            return (
              <div key={index}>
                {renderCostRow(
                  cost.name,
                  Number.parseFloat(cost.amount),
                  localCostAmount,
                  isCalculatingSelected || isCalculatingLocal
                )}
              </div>
            );
          }) || []}

          <Separator className="my-4" />

          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-2 border-primary/20">
            {isDualCurrencyMode || showUSDColumns ? (
              <div
                className={`grid ${
                  compact ? "grid-cols-3 gap-2" : "grid-cols-3 gap-4"
                } items-center`}
              >
                <span
                  className={`${`
                    compact ? "text-base" : "text-xl"
                  `} font-bold text-slate-900`}
                >
                  Total Monthly Cost
                </span>
                <span
                  className={`text-primary ${textSizes.total} font-bold text-right`}
                >
                  {isCalculatingSelected || isCalculatingLocal ? (
                    <span className="text-blue-500 animate-pulse">
                      Loading...
                    </span>
                  ) : primaryQuote ? (
                    formatCurrency(
                      Number.parseFloat(primaryQuote.total_costs),
                      primaryQuote.currency
                    )
                  ) : (
                    <span className="text-slate-400">Pending...</span>
                  )}
                </span>
                <span
                  className={`text-slate-700 ${
                    compact ? "text-base" : "text-2xl"
                  } font-semibold text-right`}
                >
                  {isCalculatingSelected || isCalculatingLocal ? (
                    <span className="text-blue-500 animate-pulse">
                      Loading...
                    </span>
                  ) : isDualCurrencyMode && localQuote ? (
                    formatCurrency(
                      Number.parseFloat(localQuote.total_costs),
                      localQuote.currency
                    )
                  ) : usdConversions &&
                    usdConversions.totalCosts !== undefined ? (
                    `${usdConversions.totalCosts.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} USD`
                  ) : isConvertingToUSD ? (
                    <span className="text-blue-500 animate-pulse">
                      Converting...
                    </span>
                  ) : usdConversionError ? (
                    <span className="text-red-400">Failed</span>
                  ) : (
                    <span className="text-slate-400">Pending...</span>
                  )}
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span
                  className={`${`
                    compact ? "text-base" : "text-xl"
                  `} font-bold text-slate-900`}
                >
                  Total Monthly Cost
                </span>
                <span className={`text-primary ${textSizes.total} font-bold`}>
                  {primaryQuote ? (
                    formatCurrency(
                      Number.parseFloat(primaryQuote.total_costs),
                      primaryQuote.currency
                    )
                  ) : (
                    <span className="text-slate-400">Pending...</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};