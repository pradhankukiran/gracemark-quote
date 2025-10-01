import { memo } from "react";
import Image from "next/image";
import { Provider } from "../hooks/useQuoteResults";

interface ProviderLogoProps {
  provider: Provider;
  maxWidth?: number;   // max width cap in px
  maxHeight?: number;  // max height cap in px
}

const LOGO_MAP: Record<Provider, { src: string; alt: string }> = {
  deel: { src: "/deel_logo.png", alt: "Deel Logo" },
  remote: { src: "/remote_logo.png", alt: "Remote Logo" },
  rivermate: { src: "/rivermate-logo.png", alt: "Rivermate Logo" },
  oyster: { src: "/oyster_logo.png", alt: "Oyster Logo" },
  rippling: { src: "/rippling_logo.png", alt: "Rippling Logo" },
  skuad: { src: "/skuad_logo.png", alt: "Skuad Logo" },
  velocity: { src: "/pebl_logo.png", alt: "Velocity Global Logo" },
  playroll: { src: "/playroll_logo.png", alt: "Playroll Logo" },
  omnipresent: { src: "/omnipresent_logo.png", alt: "Omnipresent Logo" },
}

export const ProviderLogo = memo(({ provider, maxWidth = 120, maxHeight = 24 }: ProviderLogoProps) => {
  const logo = LOGO_MAP[provider]
  if (!logo) return null

  // Provide intrinsic dimensions for layout stability, but let CSS cap size without forcing exact height
  const intrinsicWidth = Math.max(maxWidth, 120)
  const intrinsicHeight = Math.max(maxHeight, 24)

  return (
    <Image
      src={logo.src}
      alt={logo.alt}
      width={intrinsicWidth}
      height={intrinsicHeight}
      priority
      sizes={`${maxWidth}px`}
      className="object-contain"
      style={{ maxWidth, maxHeight, width: 'auto', height: 'auto' }}
    />
  )
})

ProviderLogo.displayName = "ProviderLogo";
