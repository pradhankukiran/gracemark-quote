import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MapPin } from "lucide-react"
import { EORFormData } from "../types"

interface ClientInfoFormProps {
  formData: EORFormData
  countries: string[]
  onFormUpdate: (updates: Partial<EORFormData>) => void
}

export const ClientInfoForm = ({ formData, countries, onFormUpdate }: ClientInfoFormProps) => {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary/10">
          <MapPin className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900">Client Information</h3>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label
            htmlFor="clientCountry"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Client Country
          </Label>
          <Select
            value={formData.clientCountry}
            onValueChange={(value) => onFormUpdate({ clientCountry: value })}
          >
            <SelectTrigger className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
              <SelectValue placeholder="Select client country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country} value={country}>
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="clientCurrency"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Client Currency
          </Label>
          <div className="h-12 border-2 border-slate-200 px-3 py-2 bg-slate-50 flex items-center">
            <span className="text-slate-700 font-medium">{formData.clientCurrency}</span>
          </div>
        </div>
      </div>
    </div>
  )
}