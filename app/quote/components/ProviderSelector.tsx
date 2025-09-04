import { memo } from "react";
import { Loader2, AlertCircle, Brain } from "lucide-react";
import { Provider, ProviderStatus } from "../hooks/useQuoteResults";
import { ProviderLogo } from "./ProviderLogo";

interface ProviderSelectorProps {
  currentProvider: Provider;
  onProviderChange: (provider: Provider) => void;
  loading?: { [K in Provider]: boolean };
  disabled?: boolean;
  providerStates: { [K in Provider]: ProviderStatus };
}

const providers: Provider[] = ['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity'];

export const ProviderSelector = memo(({
  currentProvider,
  onProviderChange,
  loading = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false },
  disabled = false,
  providerStates,
}: ProviderSelectorProps) => {
  const selectedIndex = providers.indexOf(currentProvider);
  const anyEnhancing = Object.values(providerStates || {}).some(state => state?.status === 'loading-enhanced');
  const anyBaseLoading = Object.values(providerStates || {}).some(state => state?.status === 'loading-base');

  return (
    <div className="flex flex-col items-center">
      {/* <h3 className="text-lg font-semibold text-slate-700 mb-3">Cost Provider</h3> */}
      <div className="relative flex items-center border-2 border-slate-200 rounded-lg p-1 bg-slate-100">
        {/* Show loading progress indicator */}
        {(anyBaseLoading || anyEnhancing) && (
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
            <div className="text-xs text-slate-500 bg-white px-2 py-1 rounded shadow-sm border flex items-center gap-1">
              {anyEnhancing ? (
                <Brain className="h-3 w-3 animate-pulse text-purple-500" />
              ) : (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {anyEnhancing 
                ? (anyBaseLoading ? 'Loading providers + Enhancing...' : 'Enhancing quotes...') 
                : 'Loading providers...'}
            </div>
          </div>
        )}
        <div
          className="absolute top-1 left-1 h-[calc(100%-0.5rem)] bg-white rounded-md shadow-md transition-transform duration-300 ease-in-out"
          style={{
            width: `calc(100% / ${providers.length})`,
            transform: `translateX(${selectedIndex * 100}%)`,
          }}
        />
        {providers.map((provider) => {
          const providerState = providerStates[provider];
          const isInactive = providerState?.status === 'inactive';
          const isLoadingBase = providerState?.status === 'loading-base' || loading[provider];
          const isLoadingEnhanced = providerState?.status === 'loading-enhanced';
          const isActive = providerState?.status === 'active';
          const isFailed = providerState?.status === 'failed';
          // Allow switching when active or enhancement in-progress
          const isClickable = (isActive || isLoadingEnhanced) && !disabled;
          
          // Fallback for missing provider state
          const displayStatus = providerState?.status || (provider === 'deel' ? 'active' : 'inactive');
          
          return (
            <button
              key={provider}
              type="button"
              onClick={() => isClickable ? onProviderChange(provider) : undefined}
              disabled={disabled || (!isActive && !isLoadingEnhanced)}
              className={`
                flex-1 py-2 px-6 text-center text-sm font-semibold rounded-md transition-all duration-200 z-10
                flex items-center justify-center gap-2 h-12 min-h-[3rem]
                ${currentProvider === provider && isActive
                  ? 'text-primary'
                  : isActive
                    ? 'text-slate-600 hover:text-primary cursor-pointer'
                    : isInactive
                      ? 'text-slate-400 cursor-not-allowed opacity-40'
                      : isFailed
                        ? 'text-red-500 cursor-not-allowed opacity-60'
                        : 'text-slate-600'
                }
                ${isInactive ? 'pointer-events-none' : ''}
              `}
              title={
                isInactive ? `${provider.charAt(0).toUpperCase() + provider.slice(1)} will load automatically` :
                isLoadingBase ? `Loading ${provider.charAt(0).toUpperCase() + provider.slice(1)} quote...` :
                isLoadingEnhanced ? `Enhancing ${provider.charAt(0).toUpperCase() + provider.slice(1)} quote with AI...` :
                isFailed ? `Failed to load ${provider.charAt(0).toUpperCase() + provider.slice(1)}: ${providerState?.error || 'Unknown error'}` :
                isActive ? `View ${provider.charAt(0).toUpperCase() + provider.slice(1)} quote` :
                `${provider.charAt(0).toUpperCase() + provider.slice(1)} status: ${displayStatus}`
              }
            >
              <div className="flex items-center justify-center gap-2">
                <div className={`${isInactive ? 'opacity-40' : ''}`}>
                  <ProviderLogo provider={provider} />
                </div>
                {isLoadingBase && (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                )}
                {isLoadingEnhanced && (
                  <Brain className="h-4 w-4 animate-pulse text-purple-500" />
                )}
                {isFailed && (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

ProviderSelector.displayName = "ProviderSelector";
