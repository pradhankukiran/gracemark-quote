import { memo } from "react";
import { Loader2 } from "lucide-react";
import { Provider } from "../hooks/useQuoteResults";
import { ProviderLogo } from "./ProviderLogo";

interface ProviderSelectorProps {
  currentProvider: Provider;
  onProviderChange: (provider: Provider) => void;
  loading?: { [K in Provider]: boolean };
  disabled?: boolean;
}

const providers: Provider[] = ['deel', 'remote', 'rivermate', 'oyster'];

export const ProviderSelector = memo(({
  currentProvider,
  onProviderChange,
  loading = { deel: false, remote: false, rivermate: false, oyster: false },
  disabled = false,
}: ProviderSelectorProps) => {
  const selectedIndex = providers.indexOf(currentProvider);

  return (
    <div className="flex flex-col items-center">
      {/* <h3 className="text-lg font-semibold text-slate-700 mb-3">Cost Provider</h3> */}
      <div className="relative flex items-center border-2 border-slate-200 rounded-lg p-1 bg-slate-100">
        <div
          className="absolute top-1 left-1 h-[calc(100%-0.5rem)] bg-white rounded-md shadow-md transition-transform duration-300 ease-in-out"
          style={{
            width: `calc(100% / ${providers.length})`,
            transform: `translateX(${selectedIndex * 100}%)`,
          }}
        />
        {providers.map((provider) => (
          <button
            key={provider}
            type="button"
            onClick={() => onProviderChange(provider)}
            disabled={disabled || loading[provider]}
            className={`
              flex-1 py-2 px-6 text-center text-sm font-semibold rounded-md transition-colors duration-200 cursor-pointer z-10
              flex items-center justify-center gap-2 h-12 min-h-[3rem]
              ${currentProvider === provider
                ? 'text-primary'
                : 'text-slate-600 hover:text-primary'
              }
            `}
          >
            {loading[provider] ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <ProviderLogo provider={provider} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
});

ProviderSelector.displayName = "ProviderSelector";
