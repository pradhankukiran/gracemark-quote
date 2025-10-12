import { CheckCircle, XCircle, TrendingUp, TrendingDown, Minus, Crown } from "lucide-react"
import { ProviderLogo } from "./ProviderLogo"
import { ProviderType } from "@/lib/types/enhancement"

interface ProviderComparisonCardProps {
  provider: string
  price: number
  variance: number
  isCompliant: boolean
  isDeelBaseline: boolean
  isWinner: boolean
  currency: string
}

export function ProviderComparisonCard({
  provider,
  price,
  variance,
  isCompliant,
  isDeelBaseline,
  isWinner,
  currency
}: ProviderComparisonCardProps) {
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatVariance = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  // Determine card styling
  const borderColor = isWinner
    ? "border-yellow-400 shadow-yellow-200 shadow-lg"
    : isDeelBaseline
    ? "border-blue-300 shadow-blue-100"
    : isCompliant
    ? "border-green-300 shadow-green-100"
    : "border-red-300 shadow-red-100"

  const bgColor = isWinner
    ? "bg-gradient-to-br from-yellow-50 via-white to-yellow-50"
    : isDeelBaseline
    ? "bg-gradient-to-br from-blue-50 via-white to-blue-50"
    : isCompliant
    ? "bg-white"
    : "bg-white"

  const statusColor = isCompliant ? "text-green-600" : "text-red-600"
  const StatusIcon = isCompliant ? CheckCircle : XCircle

  const VarianceIcon = variance > 0 ? TrendingUp : variance < 0 ? TrendingDown : Minus
  const varianceColor = variance > 0 ? "text-red-600" : variance < 0 ? "text-green-600" : "text-slate-600"

  return (
    <div
      className={`relative border-2 ${borderColor} ${bgColor} shadow-md hover:shadow-xl transition-all duration-300 p-5 group`}
    >
      {/* Winner Badge */}
      {isWinner && (
        <div className="absolute -top-3 -right-3 bg-yellow-400 text-yellow-900 px-3 py-1 shadow-lg flex items-center gap-1 text-xs font-bold border-2 border-yellow-500">
          <Crown className="h-3 w-3" />
          WINNER
        </div>
      )}

      {/* Baseline Badge */}
      {isDeelBaseline && (
        <div className="absolute -top-3 left-4 bg-blue-500 text-white px-3 py-1 shadow-md text-xs font-semibold">
          BASELINE
        </div>
      )}

      {/* Provider Logo & Name */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-14 h-14 flex items-center justify-center bg-white border-2 border-slate-200 shadow-sm p-2 group-hover:border-slate-300 transition-colors">
          <ProviderLogo provider={provider as ProviderType} maxWidth={48} maxHeight={48} />
        </div>
        <div>
          <h4 className="font-bold text-lg text-slate-900 capitalize">{provider}</h4>
          <p className="text-xs text-slate-500">EOR Provider</p>
        </div>
      </div>

      {/* Price */}
      <div className="mb-4">
        <p className="text-sm font-medium text-slate-600 mb-1">Monthly Quote</p>
        <p className="text-3xl font-bold text-slate-900">{formatMoney(price)}</p>
      </div>

      {/* Variance from Deel */}
      {!isDeelBaseline && (
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1">Variance from Deel</p>
              <div className="flex items-center gap-2">
                <VarianceIcon className={`h-5 w-5 ${varianceColor}`} />
                <p className={`text-xl font-bold ${varianceColor}`}>{formatVariance(variance)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Status */}
      <div className={`flex items-center gap-2 p-3 border-2 ${isCompliant ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <StatusIcon className={`h-5 w-5 ${statusColor}`} />
        <span className={`font-semibold ${statusColor}`}>
          {isCompliant ? 'Within ±4% Range' : 'Outside ±4% Range'}
        </span>
      </div>
    </div>
  )
}
