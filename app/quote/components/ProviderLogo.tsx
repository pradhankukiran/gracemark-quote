import { memo } from "react";
import Image from "next/image";
import { Provider } from "../hooks/useQuoteResults";

interface ProviderLogoProps {
  provider: Provider;
  size?: number;
}

export const ProviderLogo = memo(({
  provider,
  size = 24,
}: ProviderLogoProps) => {
  if (provider === 'deel') {
    return <Image src="/deel_logo.png" alt="Deel Logo" width={size * 3} height={size} className="object-contain" priority />;
  }

  if (provider === 'remote') {
    return <Image src="/remote_logo.png" alt="Remote Logo" width={size * 3} height={size} className="object-contain" priority />;
  }

  return null;
});

ProviderLogo.displayName = "ProviderLogo";