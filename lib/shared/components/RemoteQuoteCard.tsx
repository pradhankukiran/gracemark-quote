import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Loader2 } from "lucide-react";
import { RemoteAPIResponse, USDConversions } from "@/lib/shared/types";
import { formatCurrency } from "@/lib/shared/utils/currencyUtils";

interface RemoteQuoteCardProps {
  quote?: RemoteAPIResponse;
  title: string;
  badgeText?: string;
  badgeColor?: string;
  usdConversions?: USDConversions["remote"];
  isConvertingToUSD?: boolean;
  compact?: boolean;
  usdConversionError?: string | null;
}

export const RemoteQuoteCard = memo(({
  quote,
  title,
  badgeText,
  badgeColor = "bg-blue-100 text-blue-800",
  usdConversions,
  isConvertingToUSD = false,
  compact = false,
  usdConversionError = null,
}: RemoteQuoteCardProps) => {
  if (!quote?.employment) {
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

  const employment = quote.employment;
  const costs = employment.employer_currency_costs; // Always use employer_currency_costs (employee currency)
  
  const showUSDColumns = costs.currency.code !== "USD";
  const hasUSDData = usdConversions && Object.keys(usdConversions).length > 0;

  const textSizes = compact
    ? { title: "text-2xl", amount: "text-base", total: "text-xl" }
    : { title: "text-2xl", amount: "text-xl", total: "text-3xl" };

  // Helper to render cost row (matching Deel's structure)
  const renderCostRow = (
    label: string,
    amount: number,
    usdAmount?: number,
    isLoading = false
  ) => {
    return (
      <div
        className={`${compact ? "py-2 px-2" : "py-3 px-4"} bg-gray-50 ${
          showUSDColumns
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
          ) : (
            formatCurrency(amount, costs.currency.code)
          )}
        </span>
        {showUSDColumns && (
          <span
            className={`font-bold ${textSizes.amount} text-slate-700 text-right`}
          >
            {isLoading ? (
              <span className="text-blue-500 animate-pulse">Loading...</span>
            ) : usdAmount !== undefined ? (
              `${usdAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} USD`
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

  return (
    <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
      <CardContent className="p-6">
        {/* 3-Column Header (matching Deel's structure) */}
        <div className="grid grid-cols-3 items-center mb-6">
          {/* Left: Remote Logo */}
          <div className="flex justify-start">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">R</span>
              </div>
              <span className="font-bold text-slate-700 text-lg">Remote</span>
            </div>
          </div>

          {/* Middle: Title */}
          <div className="text-center">
            <h3 className={`${textSizes.title} font-bold text-slate-900`}>
              {title}
            </h3>
            {badgeText && (
              <span
                className={`inline-block px-3 py-1 ${badgeColor} text-sm font-semibold rounded-full mt-2`}
              >
                {badgeText}
              </span>
            )}
          </div>

          {/* Right: USD Status */}
          <div className="flex justify-end">
            {showUSDColumns && (
              isConvertingToUSD ? (
                <div className="flex items-center whitespace-nowrap text-blue-600 text-sm">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Converting...
                </div>
              ) : hasUSDData ? (
                <div className="flex items-center whitespace-nowrap text-green-600 text-sm">
                  <DollarSign className="mr-1 h-4 w-4" />
                  USD prices included
                </div>
              ) : usdConversionError ? (
                <div className="text-red-500 text-xs">
                  USD conversion failed
                </div>
              ) : null
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Header row for columns */}
          {showUSDColumns && (
            <div
              className={`grid ${
                compact ? "grid-cols-3 gap-2 py-1 px-2" : "grid-cols-3 gap-4 py-2 px-4"
              } bg-slate-100 border-b border-slate-200`}
            >
              <span className="text-slate-700 font-semibold text-sm">
                Cost Item
              </span>
              <span className="text-slate-700 font-semibold text-sm text-right">
                {compact ? "Local" : "Local Currency"}
              </span>
              <span className="text-slate-700 font-semibold text-sm text-right">
                {compact ? "USD" : "USD Equivalent"}
              </span>
            </div>
          )}

          {/* Base Salary */}
          {renderCostRow(
            "Base Salary",
            costs.monthly_gross_salary,
            usdConversions?.monthlySalary
          )}

          {/* Individual Contribution Items (like Deel's cost array) */}
          {costs.monthly_contributions_breakdown
            .filter(item => item.amount > 0)
            .map((item, index) => {
              return (
                <div key={index}>
                  {renderCostRow(
                    item.name,
                    item.amount,
                    // Calculate proportional USD amount if we have total conversions
                    usdConversions?.monthlyContributions 
                      ? (item.amount / costs.monthly_contributions_total) * usdConversions.monthlyContributions
                      : undefined
                  )}
                </div>
              );
            })}

          {/* Extra Statutory Payments as individual rows */}
          {costs.extra_statutory_payments_breakdown
            .filter(item => item.amount > 0)
            .map((item, index) => {
              return (
                <div key={index}>
                  {renderCostRow(
                    item.name,
                    item.amount,
                    // Calculate proportional USD amount if we have total conversions
                    usdConversions?.monthlyTotal && costs.extra_statutory_payments_total > 0
                      ? (item.amount / costs.extra_statutory_payments_total) * 
                        ((usdConversions.monthlyTotal - usdConversions.monthlySalary - usdConversions.monthlyContributions) || 0)
                      : undefined
                  )}
                </div>
              );
            })}

          <Separator className="my-4" />

          {/* Total Cost (matching Deel's layout with Remote branding) */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 border-2 border-blue-200">
            {showUSDColumns ? (
              <div
                className={`grid ${
                  compact ? "grid-cols-3 gap-2" : "grid-cols-3 gap-4"
                } items-center`}
              >
                <span
                  className={`${
                    compact ? "text-base" : "text-xl"
                  } font-bold text-slate-900`}
                >
                  Total Monthly Cost
                </span>
                <span
                  className={`text-blue-600 ${textSizes.total} font-bold text-right`}
                >
                  {formatCurrency(costs.monthly_total, costs.currency.code)}
                </span>
                <span
                  className={`text-slate-700 ${
                    compact ? "text-base" : "text-2xl"
                  } font-semibold text-right`}
                >
                  {usdConversions?.monthlyTotal !== undefined ? (
                    `${usdConversions.monthlyTotal.toLocaleString("en-US", {
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
                  className={`${
                    compact ? "text-base" : "text-xl"
                  } font-bold text-slate-900`}
                >
                  Total Monthly Cost
                </span>
                <span className={`text-blue-600 ${textSizes.total} font-bold`}>
                  {formatCurrency(costs.monthly_total, costs.currency.code)}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

RemoteQuoteCard.displayName = "RemoteQuoteCard";