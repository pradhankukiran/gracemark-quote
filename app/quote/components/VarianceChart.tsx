import { CheckCircle, XCircle, Crown } from "lucide-react"
import { ProviderType } from "@/lib/types/enhancement"

interface VarianceChartProps {
  providers: Array<{
    provider: string
    price: number
    inRange?: boolean
    isWinner?: boolean
  }>
  deelPrice: number
  currency: string
}

export function VarianceChart({ providers, deelPrice, currency }: VarianceChartProps) {
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Calculate bounds
  const lowerBound = deelPrice * 0.96
  const upperBound = deelPrice * 1.04
  const minPrice = Math.min(...providers.map(p => p.price), lowerBound)
  const maxPrice = Math.max(...providers.map(p => p.price), upperBound)
  const range = maxPrice - minPrice
  const padding = range * 0.1

  // Sort providers by price
  const sortedProviders = [...providers].sort((a, b) => a.price - b.price)

  // Calculate positions
  const calculatePosition = (price: number) => {
    return ((price - minPrice + padding) / (range + 2 * padding)) * 100
  }

  const lowerBoundPos = calculatePosition(lowerBound)
  const upperBoundPos = calculatePosition(upperBound)
  const deelPos = calculatePosition(deelPrice)

  return (
      <div className="space-y-2.5">
        {sortedProviders.map((provider, index) => {
          const isCompliant = provider.inRange ?? true
          const isDeelBaseline = provider.provider === 'deel'
          const isWinner = provider.isWinner ?? false
          const barWidth = calculatePosition(provider.price)

          const barColor = isDeelBaseline
            ? "bg-gradient-to-r from-blue-500 to-blue-600"
            : isCompliant
            ? "bg-gradient-to-r from-green-500 to-green-600"
            : "bg-gradient-to-r from-red-500 to-red-600"

          const ComplianceIcon = isCompliant ? CheckCircle : XCircle
          const iconColor = isCompliant ? "text-green-600" : "text-red-600"

          return (
            <div key={provider.provider} className="relative">
              {/* Provider Label */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800 capitalize min-w-[90px]">
                    {provider.provider}
                  </span>
                  {isDeelBaseline && (
                    <span className="text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 font-medium border border-blue-200">
                      BASE
                    </span>
                  )}
                  {isWinner && (
                    <Crown className="h-3 w-3 text-yellow-500" />
                  )}
                  <ComplianceIcon className={`h-3.5 w-3.5 ${iconColor}`} />
                </div>
                <span className="text-sm font-bold text-slate-900">
                  {formatMoney(provider.price)}
                </span>
              </div>

              {/* Bar */}
              <div className="relative h-8 bg-slate-100 border border-slate-200">
                {/* ±4% Zone - only show on first row */}
                {index === 0 && (
                  <div
                    className="absolute top-0 bottom-0 bg-green-100/50 border-l-2 border-r-2 border-green-400 border-dashed"
                    style={{
                      left: `${lowerBoundPos}%`,
                      width: `${upperBoundPos - lowerBoundPos}%`
                    }}
                  >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-medium text-green-700 bg-white/80 px-2 py-0.5 whitespace-nowrap">
                      ±4%
                    </div>
                  </div>
                )}

                {/* Deel Baseline Marker - show on all rows */}
                {!isDeelBaseline && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-blue-500"
                    style={{ left: `${deelPos}%` }}
                  >
                    <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rotate-45"></div>
                    <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rotate-45"></div>
                  </div>
                )}

                {/* Provider Bar */}
                <div
                  className={`absolute top-0 bottom-0 left-0 ${barColor} flex items-center justify-end px-2 transition-all duration-500 shadow-sm ${
                    isWinner ? 'border border-yellow-400' : ''
                  }`}
                  style={{ width: `${barWidth}%` }}
                >
                  {barWidth > 18 && (
                    <span className="text-[11px] font-bold text-white">
                      {formatMoney(provider.price)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
  
  )
}
