import { memo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Provider } from "../hooks/useQuoteResults";

interface ProviderSelectorProps {
  currentProvider: Provider;
  onProviderChange: (provider: Provider) => void;
  loading?: { [K in Provider]: boolean };
  disabled?: boolean;
}

const providerConfig = {
  deel: {
    label: "Deel",
    description: "All-in-one global HR platform",
    color: "text-emerald-600",
  },
  remote: {
    label: "Remote",
    description: "Global employment platform",
    color: "text-blue-600",
  },
} as const;

export const ProviderSelector = memo(({
  currentProvider,
  onProviderChange,
  loading = { deel: false, remote: false },
  disabled = false,
}: ProviderSelectorProps) => {
  return (
    <div className="flex flex-col items-end">
      <label className="text-xs text-slate-500 mb-1 font-medium">
        Cost Provider
      </label>
      <Select
        value={currentProvider}
        onValueChange={(value) => onProviderChange(value as Provider)}
        disabled={disabled}
      >
        <SelectTrigger className="w-40 bg-white/90 backdrop-blur-sm border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            {loading[currentProvider] && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(providerConfig).map(([key, config]) => (
            <SelectItem key={key} value={key}>
              <div className="flex items-center gap-2 py-1">
                <div className="flex flex-col">
                  <span className={`font-medium ${config.color}`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    {config.description}
                  </span>
                </div>
                {loading[key as Provider] && (
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
});

ProviderSelector.displayName = "ProviderSelector";