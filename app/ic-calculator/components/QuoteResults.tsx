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
  const formatCurrency = (amount: number) => {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
                  {formatCurrency(quote.payRate)}/hr
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  {formatCurrency(quote.contractorReceives)}/month
                </div>
              </div>
              <div className="bg-secondary/10 p-4 text-center border-2 border-secondary/20 rounded-lg">
                <div className="text-sm text-slate-600 font-semibold mb-2 uppercase tracking-wide">
                  Bill Rate (Client)
                </div>
                <div className="text-2xl font-bold text-secondary">
                  {formatCurrency(quote.billRate)}/hr
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  {formatCurrency(quote.totalMonthlyCost)}/month
                </div>
              </div>
            </div>

            <div className="text-center text-sm text-slate-600 bg-slate-50 p-3 rounded-md">
              Based on {quote.workedHours} hours per month
            </div>

            {/* Cost Breakdown */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Fee Breakdown</h3>

              <div className="space-y-2">
                <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-md">
                  <span className="text-slate-600 font-medium">Platform Fee (4.9%)</span>
                  <span className="font-bold text-lg text-slate-900">
                    {formatCurrency(quote.platformFee)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-md">
                  <span className="text-slate-600 font-medium">Payment Processing (2.9%)</span>
                  <span className="font-bold text-lg text-slate-900">
                    {formatCurrency(quote.paymentProcessing)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-md">
                  <span className="text-slate-600 font-medium">
                    Compliance Fee ({formData.complianceLevel === "premium" ? "2%" : "1%"})
                  </span>
                  <span className="font-bold text-lg text-slate-900">
                    {formatCurrency(quote.complianceFee)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-md">
                  <span className="text-slate-600 font-medium">System Provider Cost</span>
                  <span className="font-bold text-lg text-slate-900">
                    {formatCurrency(quote.systemProviderCost)}
                  </span>
                </div>

                {quote.backgroundCheck > 0 && (
                  <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-md">
                    <span className="text-slate-600 font-medium">
                      Background Check (Amortized over {formData.contractDuration} months)
                    </span>
                    <span className="font-bold text-lg text-slate-900">
                      {formatCurrency(quote.backgroundCheck)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Separator className="my-6" />

            {/* Net Margin */}
            <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 border-2 border-green-200 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-slate-900">Net Monthly Margin</span>
                <span className="text-green-600 text-3xl font-bold">
                  {formatCurrency(quote.netMargin)}
                </span>
              </div>
              <div className="text-center mt-2 text-sm text-slate-600">
                Target: $1,000 USD per month (adjusted for region and service type)
              </div>
            </div>

            {/* Service Details */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Contract Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-blue-700 font-medium">Service Type:</span>
                  <span className="text-blue-800 ml-2">{formData.serviceType}</span>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Contract Duration:</span>
                  <span className="text-blue-800 ml-2">{formData.contractDuration} months</span>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Payment Frequency:</span>
                  <span className="text-blue-800 ml-2 capitalize">{formData.paymentFrequency}</span>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Compliance Level:</span>
                  <span className="text-blue-800 ml-2 capitalize">{formData.complianceLevel}</span>
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