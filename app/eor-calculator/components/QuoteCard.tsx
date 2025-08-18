import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { DollarSign, Loader2 } from "lucide-react"
import { DeelAPIResponse, USDConversions } from "../types"
import { formatCurrency } from "../utils/currencyUtils"

interface QuoteCardProps {
  quote: DeelAPIResponse
  title: string
  subtitle: string
  badgeText?: string
  badgeColor?: string
  usdConversions?: USDConversions[keyof USDConversions]
  showUSDConversion?: boolean
  isConvertingToUSD?: boolean
  onConvertToUSD?: () => void
  compact?: boolean
}

export const QuoteCard = ({
  quote,
  title,
  subtitle,
  badgeText,
  badgeColor = "bg-green-100 text-green-800",
  usdConversions,
  showUSDConversion = true,
  isConvertingToUSD = false,
  onConvertToUSD,
  compact = false
}: QuoteCardProps) => {
  const showUSDButton = showUSDConversion && quote.currency !== "USD" && onConvertToUSD
  const showUSDColumns = quote.currency !== "USD" && usdConversions

  const textSizes = compact 
    ? { title: "text-2xl", amount: "text-base", total: "text-xl" }
    : { title: "text-2xl", amount: "text-xl", total: "text-3xl" }

  return (
    <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="text-center flex-1">
            <h3 className={`${textSizes.title} font-bold text-slate-900`}>{title}</h3>
            <p className="text-base text-slate-600">{subtitle}</p>
            {badgeText && (
              <span className={`inline-block px-3 py-1 ${badgeColor} text-sm font-semibold rounded-full mt-2`}>
                {badgeText}
              </span>
            )}
          </div>
          {showUSDButton && (
            <Button
              onClick={onConvertToUSD}
              disabled={isConvertingToUSD}
              variant="outline"
              size="sm"
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 ml-4"
            >
              {isConvertingToUSD ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <DollarSign className="mr-2 h-3 w-3" />
                  USD prices
                </>
              )}
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {/* Header row for columns */}
          {showUSDColumns && (
            <div className={`grid ${compact ? 'grid-cols-3 gap-2 py-1 px-2' : 'grid-cols-3 gap-4 py-2 px-4'} bg-slate-100 border-b border-slate-200`}>
              <span className="text-slate-700 font-semibold text-sm">Cost Item</span>
              <span className="text-slate-700 font-semibold text-sm text-right">
                {compact ? 'Local' : 'Local Currency'}
              </span>
              <span className="text-slate-700 font-semibold text-sm text-right">
                {compact ? 'USD' : 'USD Equivalent'}
              </span>
            </div>
          )}
          
          {/* Base Salary */}
          <div className={`${compact ? 'py-2 px-2' : 'py-3 px-4'} bg-slate-50 ${
            showUSDColumns 
              ? `grid ${compact ? 'grid-cols-3 gap-2' : 'grid-cols-3 gap-4'} items-center`
              : 'flex justify-between items-center'
          }`}>
            <span className={`text-slate-600 font-medium ${compact ? 'text-base' : 'text-base'}`}>
              Base Salary
            </span>
            <span className={`font-bold ${textSizes.amount} text-slate-900 text-right`}>
              {formatCurrency(Number.parseFloat(quote.salary), quote.currency)}
            </span>
            {showUSDColumns && usdConversions && (
              <span className={`font-bold ${textSizes.amount} text-slate-700 text-right`}>
                ${usdConversions.salary.toLocaleString()}
              </span>
            )}
          </div>

          {/* Platform Fee */}
          <div className={`${compact ? 'py-2 px-2' : 'py-3 px-4'} bg-slate-50 ${
            showUSDColumns 
              ? `grid ${compact ? 'grid-cols-3 gap-2' : 'grid-cols-3 gap-4'} items-center`
              : 'flex justify-between items-center'
          }`}>
            <span className={`text-slate-600 font-medium ${compact ? 'text-base' : 'text-base'}`}>
              Platform Fee
            </span>
            <span className={`font-bold ${textSizes.amount} text-slate-900 text-right`}>
              {formatCurrency(Number.parseFloat(quote.deel_fee), quote.currency)}
            </span>
            {showUSDColumns && usdConversions && (
              <span className={`font-bold ${textSizes.amount} text-slate-700 text-right`}>
                ${usdConversions.deelFee.toLocaleString()}
              </span>
            )}
          </div>

          {/* Cost items */}
          {quote.costs.map((cost, index) => (
            <div key={index} className={`${compact ? 'py-2 px-2' : 'py-3 px-4'} bg-slate-50 ${
              showUSDColumns 
                ? `grid ${compact ? 'grid-cols-3 gap-2' : 'grid-cols-3 gap-4'} items-center`
                : 'flex justify-between items-center'
            }`}>
              <span className={`text-slate-600 font-medium ${compact ? 'text-base' : 'text-base'}`}>
                {cost.name}
              </span>
              <span className={`font-bold ${textSizes.amount} text-slate-900 text-right`}>
                {formatCurrency(Number.parseFloat(cost.amount), quote.currency)}
              </span>
              {showUSDColumns && usdConversions && usdConversions.costs[index] !== undefined && (
                <span className={`font-bold ${textSizes.amount} text-slate-700 text-right`}>
                  {usdConversions.costs[index] === -1 
                    ? "---" 
                    : `$${usdConversions.costs[index].toLocaleString()}`
                  }
                </span>
              )}
            </div>
          ))}

          <Separator className="my-4" />

          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-2 border-primary/20">
            {showUSDColumns && usdConversions ? (
              <div className={`grid ${compact ? 'grid-cols-3 gap-2' : 'grid-cols-3 gap-4'} items-center`}>
                <span className={`${compact ? 'text-base' : 'text-xl'} font-bold text-slate-900`}>
                  Total Monthly Cost
                </span>
                <span className={`text-primary ${textSizes.total} font-bold text-right`}>
                  {formatCurrency(Number.parseFloat(quote.total_costs), quote.currency)}
                </span>
                <span className={`text-slate-700 ${compact ? 'text-base' : 'text-2xl'} font-semibold text-right`}>
                  ${usdConversions.totalCosts.toLocaleString()} USD
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className={`${compact ? 'text-base' : 'text-xl'} font-bold text-slate-900`}>
                  Total Monthly Cost
                </span>
                <span className={`text-primary ${textSizes.total} font-bold`}>
                  {formatCurrency(Number.parseFloat(quote.total_costs), quote.currency)}
                </span>
              </div>
            )}
            {isConvertingToUSD && (
              <div className="text-slate-500 text-sm mt-2 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Converting to USD...
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}