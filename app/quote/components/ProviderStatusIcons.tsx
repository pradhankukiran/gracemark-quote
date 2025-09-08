import { memo } from "react";
import { Loader2, AlertCircle, Brain, AlertTriangle, CheckCircle, X } from "lucide-react";
import { ProviderState } from "../hooks/useQuoteResults";

interface ProviderStatusIconProps {
  status: ProviderState;
  className?: string;
}

export const BrainErrorIcon = memo(({ className = "h-4 w-4" }: { className?: string }) => (
  <div className="relative inline-block">
    <Brain className={`${className} text-red-500`} />
    <X className="h-2 w-2 absolute -top-1 -right-1 text-red-600 bg-white rounded-full" strokeWidth={3} />
  </div>
));
BrainErrorIcon.displayName = "BrainErrorIcon";

export const WarningBadge = memo(({ className = "h-3 w-3" }: { className?: string }) => (
  <div className="relative">
    <AlertTriangle className={`${className} text-amber-500`} fill="currentColor" />
  </div>
));
WarningBadge.displayName = "WarningBadge";

export const ProviderStatusIcon = memo(({ status, className = "h-4 w-4" }: ProviderStatusIconProps) => {
  switch (status) {
    case 'loading-base':
      return <Loader2 className={`${className} animate-spin text-blue-500`} />;
    
    case 'loading-enhanced':
      return <Brain className={`${className} animate-pulse text-purple-500`} />;
    
    case 'enhancement-failed':
      return <BrainErrorIcon className={className} />;
    
    case 'failed':
      return <AlertCircle className={`${className} text-red-500`} />;
    
    case 'active':
      return <CheckCircle className={`${className} text-green-500`} />;
    
    case 'inactive':
    default:
      return null;
  }
});
ProviderStatusIcon.displayName = "ProviderStatusIcon";

export const getProviderStatusColor = (status: ProviderState): string => {
  switch (status) {
    case 'loading-base':
      return 'border-blue-200 bg-blue-50';
    
    case 'loading-enhanced':
      return 'border-purple-200 bg-purple-50';
    
    case 'enhancement-failed':
      return 'border-amber-200 bg-amber-50';
    
    case 'failed':
      return 'border-red-200 bg-red-50';
    
    case 'active':
      return 'border-green-200 bg-green-50';
    
    case 'inactive':
    default:
      return 'border-slate-200 bg-slate-50';
  }
};

export const getProviderStatusMessage = (
  providerName: string, 
  status: ProviderState, 
  error?: string,
  enhancementError?: string
): string => {
  const capitalizedProvider = providerName.charAt(0).toUpperCase() + providerName.slice(1);
  
  switch (status) {
    case 'loading-base':
      return `Loading ${capitalizedProvider} quote...`;
    
    case 'loading-enhanced':
      return `Enhancing ${capitalizedProvider} quote with AI...`;
    
    case 'enhancement-failed':
      return `${capitalizedProvider} base quote ready, but AI enhancement failed${enhancementError ? `: ${enhancementError}` : ''}. • ✓ Base quote available - you can still view cost breakdown • ❌ AI enhancement unavailable - missing legal requirement analysis • 🔄 Click to view base quote or scroll down to retry enhancement • Tip: Enhancement adds statutory requirements like 13th salary, termination costs, and mandatory allowances.`;
    
    case 'failed':
      return `Failed to load ${capitalizedProvider}${error ? `: ${error}` : ''}`;
    
    case 'active':
      return `View ${capitalizedProvider} quote (base + AI enhanced)`;
    
    case 'inactive':
      return `${capitalizedProvider} will load automatically`;
    
    default:
      return `${capitalizedProvider} status: ${status}`;
  }
};