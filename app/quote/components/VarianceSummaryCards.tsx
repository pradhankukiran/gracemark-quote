import { TrendingUp, TrendingDown, Target, BarChart3, CheckCircle } from "lucide-react"

interface VarianceSummaryCardsProps {
  deelPrice: number
  cheapest: number
  average: number
  median: number
  stdDev: number
  compliantCount: number
  totalCount: number
  currency: string
}

export function VarianceSummaryCards({
  deelPrice,
  cheapest,
  average,
  median,
  stdDev,
  compliantCount,
  totalCount,
  currency
}: VarianceSummaryCardsProps) {
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const complianceRate = totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 0

  const cards = [
    {
      title: "Deel Baseline",
      value: formatMoney(deelPrice),
      icon: Target,
      color: "blue",
      description: "Reference price"
    },
    {
      title: "Cheapest Option",
      value: formatMoney(cheapest),
      icon: TrendingDown,
      color: "green",
      description: "Lowest quote"
    },
    {
      title: "Average Price",
      value: formatMoney(average),
      icon: BarChart3,
      color: "purple",
      description: "Mean of all quotes"
    },
    {
      title: "Median Price",
      value: formatMoney(median),
      icon: BarChart3,
      color: "indigo",
      description: "Middle value"
    },
    {
      title: "Std Deviation",
      value: formatMoney(stdDev),
      icon: TrendingUp,
      color: "orange",
      description: "Price variance"
    },
    {
      title: "Compliance Rate",
      value: `${complianceRate}%`,
      icon: CheckCircle,
      color: complianceRate >= 70 ? "green" : complianceRate >= 50 ? "yellow" : "red",
      description: `${compliantCount}/${totalCount} within ±4%`
    }
  ]

  const colorClasses: Record<string, { bg: string; icon: string; border: string; text: string }> = {
    blue: { bg: "bg-blue-50", icon: "text-blue-600", border: "border-blue-200", text: "text-blue-900" },
    green: { bg: "bg-green-50", icon: "text-green-600", border: "border-green-200", text: "text-green-900" },
    purple: { bg: "bg-purple-50", icon: "text-purple-600", border: "border-purple-200", text: "text-purple-900" },
    indigo: { bg: "bg-indigo-50", icon: "text-indigo-600", border: "border-indigo-200", text: "text-indigo-900" },
    orange: { bg: "bg-orange-50", icon: "text-orange-600", border: "border-orange-200", text: "text-orange-900" },
    yellow: { bg: "bg-yellow-50", icon: "text-yellow-600", border: "border-yellow-200", text: "text-yellow-900" },
    red: { bg: "bg-red-50", icon: "text-red-600", border: "border-red-200", text: "text-red-900" }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      {cards.map((card, index) => {
        const Icon = card.icon
        const colors = colorClasses[card.color]

        return (
          <div
            key={index}
            className={`${colors.bg} border ${colors.border} shadow-sm hover:shadow-md transition-shadow duration-200 p-4`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className={`p-2 ${colors.bg} border ${colors.border} shadow-sm`}>
                <Icon className={`h-5 w-5 ${colors.icon}`} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">{card.title}</p>
              <p className={`text-2xl font-bold ${colors.text}`}>{card.value}</p>
              <p className="text-xs text-slate-500 mt-1">{card.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
