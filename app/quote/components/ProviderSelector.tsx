import { memo, useMemo } from "react";
import { Loader2, Brain } from "lucide-react";
import { Provider, ProviderStatus } from "../hooks/useQuoteResults";
import { ProviderLogo } from "./ProviderLogo";
import { ProviderStatusIcon, getProviderStatusMessage } from "./ProviderStatusIcons";

interface ProviderSelectorProps {
  currentProvider: Provider;
  onProviderChange: (provider: Provider) => void;
  disabled?: boolean;
  providerStates: { [K in Provider]: ProviderStatus };
}

const providers: Provider[] = ['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity', 'playroll', 'omnipresent'];

export const ProviderSelector = memo(({
  currentProvider,
  onProviderChange,
  disabled = false,
  providerStates,
}: ProviderSelectorProps) => {
  const selectedIndex = providers.indexOf(currentProvider);
  const highlightOffset = selectedIndex >= 0 ? selectedIndex : 0;
  const highlightWidthPercent = providers.length > 0 ? 100 / providers.length : 0;

  const anyEnhancing = useMemo(
    () => Object.values(providerStates || {}).some(state => state?.status === 'loading-enhanced'),
    [providerStates]
  );

  const anyBaseLoading = useMemo(
    () => Object.values(providerStates || {}).some(state => state?.status === 'loading-base'),
    [providerStates]
  );

  return (
    <div className="w-full">
      {(anyBaseLoading || anyEnhancing) && (
        <div className="flex justify-center mb-4">
          <div className="flex items-center gap-2 bg-white border-2 border-slate-200 shadow-sm px-4 py-2 text-sm text-slate-700">
            {anyEnhancing ? (
              <Brain className="h-4 w-4 animate-pulse text-purple-600" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
            )}
            <span className="font-semibold">
              {anyEnhancing
                ? (anyBaseLoading ? "Loading providers & enhancing..." : "Enhancing quotes...")
                : "Loading providers..."}
            </span>
          </div>
        </div>
      )}

      <div className="relative w-full bg-slate-50 border border-slate-200 shadow-sm p-1">
        <div className="flex gap-1">
          {providers.map((provider) => {
            const providerState = providerStates[provider];
            const status = providerState?.status || (provider === 'deel' ? 'active' : 'inactive');
            const isLoadingEnhanced = status === 'loading-enhanced';
            const isActive = status === 'active';
            const isFailed = status === 'failed';
            const isEnhancementFailed = status === 'enhancement-failed';
            const isFailureState = isFailed || isEnhancementFailed;
            const isSelected = currentProvider === provider;

            const isClickable = (isActive || isLoadingEnhanced || isEnhancementFailed) && !disabled;

            const classTokens = [
              "flex",
              "items-center",
              "justify-center",
              "gap-2",
              "px-3",
              "py-3",
              "transition-all",
              "duration-300",
              "flex-1",
              "relative",
              isSelected && !isFailureState
                ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-400 shadow-md scale-105"
                : isFailureState
                  ? "bg-slate-100 border border-slate-200 opacity-50"
                  : "bg-white border border-slate-200 hover:shadow-sm hover:border-slate-300",
              isFailureState ? "" : "",
              isClickable && !isFailureState ? "cursor-pointer" : "cursor-default",
            ].filter(Boolean).join(" ");

            return (
              <button
                key={provider}
                type="button"
                onClick={() => (isClickable ? onProviderChange(provider) : undefined)}
                disabled={disabled || (!isActive && !isLoadingEnhanced && !isEnhancementFailed)}
                className={classTokens}
                title={getProviderStatusMessage(
                  provider,
                  status,
                  providerState?.error,
                  providerState?.enhancementError
                )}
              >
                <div className={`flex items-center justify-center gap-2 ${isFailureState ? "opacity-70 grayscale" : ""}`}>
                  <ProviderLogo provider={provider} maxWidth={90} maxHeight={20} />
                  <ProviderStatusIcon status={status} className="h-4 w-4 flex-shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

ProviderSelector.displayName = "ProviderSelector";
