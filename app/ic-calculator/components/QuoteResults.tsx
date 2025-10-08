import { memo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Calculator } from "lucide-react"
import { ICQuoteResult, ICFormData } from "@/lib/shared/types"

interface QuoteResultsProps {
  quote: ICQuoteResult | null
  formData: ICFormData
  currency: string
}

export const QuoteResults = memo(({ quote, formData, currency }: QuoteResultsProps) => {
  const formatCurrency = (amount: number, currencyOverride?: string) => {
    const displayCurrency = currencyOverride ?? currency
    return `${displayCurrency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (!quote) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Quote Breakdown
          </h2>
          <p className="text-lg text-slate-600">
            Complete the form above to see your personalized quote
          </p>
        </div>

        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="text-center py-16">
              <div className="p-4 bg-slate-50 w-20 h-20 mx-auto mb-4 flex items-center justify-center rounded-full">
                <Calculator className="h-10 w-10 text-slate-400" />
              </div>
              <p className="text-slate-500 text-base font-medium">
                Fill out the form above to generate your personalized quote
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const rateBasis = formData.rateBasis === "monthly" ? "monthly" : "hourly"
  const isHourlyBasis = rateBasis === "hourly"
  const primaryUnit = isHourlyBasis ? "/hr" : "/month"
  const secondaryUnit = isHourlyBasis ? "/month" : "/hr"
  const payRatePrimary = isHourlyBasis ? quote.payRate : quote.monthlyPayRate
  const payRateSecondary = isHourlyBasis ? quote.monthlyPayRate : quote.payRate
  const billRatePrimary = isHourlyBasis ? quote.billRate : quote.monthlyBillRate
  const billRateSecondary = isHourlyBasis ? quote.monthlyBillRate : quote.billRate
  const totalEmploymentCost = Math.round(
    (quote.monthlyPayRate + quote.mspFee + quote.backgroundCheckMonthlyFee + quote.platformFee) * 100
  ) / 100
  const netMarginLocal = Math.round((quote.monthlyBillRate - totalEmploymentCost) * 100) / 100
  const marginFormulaParts: string[] = ["Pay Rate"]
  if (quote.mspFee > 0) {
    marginFormulaParts.push("MSP Fee")
  }
  if (quote.backgroundCheckMonthlyFee > 0) {
    marginFormulaParts.push("Background Check Fee")
  }
  marginFormulaParts.push("Platform Fee")
  const marginFormula = marginFormulaParts.join(" + ")
  const contractDurationDisplay = formData.contractDuration
    ? (() => {
        const numericValue = Number(formData.contractDuration)
        const isSingular = Math.abs(numericValue) === 1
        if (formData.contractDurationUnit === "years") {
          return `${formData.contractDuration} ${isSingular ? "year" : "years"}`
        }
        return `${formData.contractDuration} ${isSingular ? "month" : "months"}`
      })()
    : "Not specified"

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
          Quote Breakdown
        </h2>
        <p className="text-lg text-slate-600">
          Your comprehensive IC contract cost breakdown
        </p>
      </div>

      <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Rate Overview */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-primary/10 p-4 text-center border-2 border-primary/20 rounded-lg">
                <div className="text-sm text-slate-600 font-semibold mb-2 uppercase tracking-wide">
                  Pay Rate (Contractor)
                </div>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(payRatePrimary)}{primaryUnit}
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  {formatCurrency(payRateSecondary)}{secondaryUnit}
                </div>
              </div>
              <div className="bg-secondary/10 p-4 text-center border-2 border-secondary/20 rounded-lg">
                <div className="text-sm text-slate-600 font-semibold mb-2 uppercase tracking-wide">
                  Bill Rate (Client)
                </div>
                <div className="text-2xl font-bold text-secondary">
                  {formatCurrency(billRatePrimary)}{primaryUnit}
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  {formatCurrency(billRateSecondary)}{secondaryUnit}
                </div>
              </div>
            </div>

            <div className="text-center text-sm text-slate-600 bg-slate-50 p-3 rounded-md">
              Bill Rate = Pay Rate × 1.40 (40% GMK markup){' '}
              | Monthly conversions assume {quote.workedHours} hours per month
            </div>

            {/* Cost Breakdown */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Monthly Cost Breakdown</h3>

              <div className="space-y-2">
                <div className="flex justify-between items-center py-3 px-4 bg-blue-50 rounded-md border border-blue-200">
                  <span className="text-slate-700 font-semibold">Contractor Pay Rate</span>
                  <span className="font-bold text-lg text-slate-900">
                    {formatCurrency(quote.monthlyPayRate)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-md">
                  <span className="text-slate-600 font-medium">
                    Transaction Cost ({quote.transactionsPerMonth} × $55 USD, converted)
                  </span>
                  <span className="font-bold text-lg text-slate-900">
                    {formatCurrency(quote.transactionCost)}
                  </span>
                </div>

                {quote.mspFee > 0 && (
                  <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-md">
                    <span className="text-slate-600 font-medium">MSP Fee</span>
                    <span className="font-bold text-lg text-slate-900">
                      {formatCurrency(quote.mspFee)}
                    </span>
                  </div>
                )}

                {quote.backgroundCheckMonthlyFee > 0 && (
                  <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-md">
                    <span className="text-slate-600 font-medium">
                      Background Check Fee (amortized)
                    </span>
                    <span className="font-bold text-lg text-slate-900">
                      {formatCurrency(quote.backgroundCheckMonthlyFee)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-md">
                  <span className="text-slate-600 font-medium">Platform Fee</span>
                  <span className="font-bold text-lg text-slate-900">
                    {formatCurrency(quote.platformFee)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center py-3 px-4 bg-green-50 rounded-md border border-green-200">
                <span className="text-slate-700 font-semibold">
                  Total Employment Cost
                </span>
                <span className="font-bold text-lg text-slate-900">
                  {formatCurrency(totalEmploymentCost)}
                </span>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Net Margin */}
            <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 border-2 border-green-200 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-slate-900">Net Monthly Margin</span>
                <span className="text-green-600 text-3xl font-bold">
                  {formatCurrency(quote.netMargin, "USD")}
                </span>
              </div>
              <div className="text-center mt-2 text-sm text-slate-600">
                Target: $1,000 USD per month
              </div>
              <div className="mt-3 p-3 bg-white/50 rounded border border-green-300">
                <p className="text-xs text-slate-700">
                  <strong>Formula:</strong> Net Margin = Bill Rate - ({marginFormula})
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Local equivalent: {formatCurrency(netMarginLocal)}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Transaction costs are handled separately and do not affect the target margin.
                </p>
              </div>
            </div>

            {/* Service Details */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Contract Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-blue-700 font-medium">Contract Duration:</span>
                  <span className="text-blue-800 ml-2">{contractDurationDisplay}</span>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Payment Frequency:</span>
                  <span className="text-blue-800 ml-2 capitalize">{formData.paymentFrequency}</span>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Transactions/Month:</span>
                  <span className="text-blue-800 ml-2">{quote.transactionsPerMonth}</span>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Background Check:</span>
                  <span className="text-blue-800 ml-2">
                    {formData.backgroundCheckRequired
                      ? quote.backgroundCheckMonthlyFee > 0
                        ? `Yes (${formatCurrency(quote.backgroundCheckMonthlyFee)}/month)`
                        : "Yes"
                      : "No"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})

QuoteResults.displayName = 'QuoteResults'
