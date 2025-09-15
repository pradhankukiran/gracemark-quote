import { memo } from "react";
import { Loader2, Brain } from "lucide-react";
import { Provider, ProviderStatus } from "../hooks/useQuoteResults";
import { ProviderLogo } from "./ProviderLogo";
import { ProviderStatusIcon, WarningBadge, getProviderStatusMessage } from "./ProviderStatusIcons";

interface ProviderSelectorProps {
  currentProvider: Provider;
  onProviderChange: (provider: Provider) => void;
  disabled?: boolean;
  providerStates: { [K in Provider]: ProviderStatus };
}

const providers: Provider[] = ['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity'];

export const ProviderSelector = memo(({
  currentProvider,
  onProviderChange,
  disabled = false,
  providerStates,
}: ProviderSelectorProps) => {
  const selectedIndex = providers.indexOf(currentProvider);
  const anyEnhancing = Object.values(providerStates || {}).some(state => state?.status === 'loading-enhanced');
  const anyBaseLoading = Object.values(providerStates || {}).some(state => state?.status === 'loading-base');

  return (
    <div className="flex flex-col items-center w-full">
      {/* <h3 className="text-lg font-semibold text-slate-700 mb-3">Cost Provider</h3> */}
      <div className="relative flex items-center w-full max-w-7xl border-2 border-slate-200 rounded-lg p-1 bg-slate-100 overflow-hidden">
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
          className="absolute top-1 left-1 h-[calc(100%-0.5rem)] bg-white rounded-md shadow-md transition-transform duration-300 ease-in-out z-0"
          style={{
            width: `calc(100% / ${providers.length})`,
            transform: `translateX(${selectedIndex * 100}%)`,
          }}
        />
        {providers.map((provider) => {
          const providerState = providerStates[provider];
          const status = providerState?.status || (provider === 'deel' ? 'active' : 'inactive');
          const isInactive = status === 'inactive';
          const isLoadingEnhanced = status === 'loading-enhanced';
          const isActive = status === 'active';
          const isFailed = status === 'failed';
          const isEnhancementFailed = status === 'enhancement-failed';
          
          // Debug: Log provider states to help diagnose missing failure indicators
          if (isFailed || isEnhancementFailed) {
            // console.log(`[ProviderSelector] ${provider} status: ${status}`, { providerState, isFailed, isEnhancementFailed });
          }
          
          // Allow switching when active, enhancement in-progress, or enhancement failed (base quote available)
          const isClickable = (isActive || isLoadingEnhanced || isEnhancementFailed) && !disabled;
          
          const hasWarning = isEnhancementFailed;
          
          return (
            <button
              key={provider}
              type="button"
              onClick={() => isClickable ? onProviderChange(provider) : undefined}
              disabled={disabled || (!isActive && !isLoadingEnhanced && !isEnhancementFailed)}
              className={`
                flex-1 min-w-0 py-2 px-6 text-center text-sm font-semibold rounded-md transition-all duration-200 z-10
                flex items-center justify-center gap-2 h-12 min-h-[3rem] relative
                ${currentProvider === provider && (isActive || isEnhancementFailed)
                  ? 'text-primary'
                  : (isActive || isEnhancementFailed)
                    ? 'text-slate-600 hover:text-primary cursor-pointer'
                    : isInactive
                      ? 'text-slate-400 cursor-not-allowed opacity-40'
                      : isFailed
                        ? 'text-red-500 cursor-not-allowed opacity-60'
                        : 'text-slate-600'
                }
                ${isInactive ? 'pointer-events-none' : ''}
                ${isEnhancementFailed ? 'border border-amber-300 bg-amber-50/20' : ''}
              `}
              title={getProviderStatusMessage(
                provider, 
                status, 
                providerState?.error, 
                providerState?.enhancementError
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <div className={`${isInactive ? 'opacity-40' : ''} relative shrink-0 flex items-center justify-center px-2`}>
                  <ProviderLogo provider={provider} maxWidth={120} maxHeight={24} />
                  {hasWarning && (
                    <div className="absolute -top-1 -right-1">
                      <WarningBadge className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <ProviderStatusIcon status={status} className="h-4 w-4" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

ProviderSelector.displayName = "ProviderSelector";
