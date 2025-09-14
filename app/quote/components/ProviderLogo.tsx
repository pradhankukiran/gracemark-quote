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
    return <Image src="/deel_logo.png" alt="Deel Logo" width={size * 2} height={size} className="object-contain" priority />;
  }

  if (provider === 'remote') {
    return <Image src="/remote_logo.png" alt="Remote Logo" width={size * 3.5} height={size} className="object-contain" priority />;
  }

  if (provider === 'rivermate') {
    return <Image src="/rivermate-logo.png" alt="Rivermate Logo" width={size * 4} height={size} className="object-contain" priority />;
  }

  if (provider === 'oyster') {
    return <Image src="/oyster_logo.png" alt="Oyster Logo" width={size * 2.5} height={size} className="object-contain" priority />;
  }

  if (provider === 'rippling') {
    return <Image src="/rippling_logo.png" alt="Rippling Logo" width={size * 4} height={size} className="object-contain" priority />;
  }

  if (provider === 'skuad') {
    return <Image src="/skuad_logo.png" alt="Skuad Logo" width={size * 3} height={size} className="object-contain" priority />;
  }

  if (provider === 'velocity') {
    return <Image src="/pebl_logo.png" alt="Velocity Global Logo" width={size * 2} height={size} className="object-contain" priority />;
  }

  return null;
});

ProviderLogo.displayName = "ProviderLogo";
