// Logo Conversion Utility - Handles provider logo conversion for PDF documents

import { ProviderType } from "@/lib/types/enhancement";

export interface ProviderLogoData {
  name: string;
  imagePath: string;
  width: number;
  height: number;
  base64?: string;
}

// Provider logo configuration mapping
export const PROVIDER_LOGOS: Record<ProviderType, ProviderLogoData> = {
  deel: {
    name: 'Deel',
    imagePath: '/deel_logo.png',
    width: 48,
    height: 24
  },
  remote: {
    name: 'Remote',
    imagePath: '/remote_logo.png',
    width: 72,
    height: 24
  },
  rivermate: {
    name: 'Rivermate',
    imagePath: '/rivermate-logo.png',
    width: 96,
    height: 24
  },
  oyster: {
    name: 'Oyster',
    imagePath: '/oyster_logo.png',
    width: 30,
    height: 20
  },
  rippling: {
    name: 'Rippling',
    imagePath: '/rippling_logo.png',
    width: 96,
    height: 24
  },
  skuad: {
    name: 'Skuad',
    imagePath: '/skuad_logo.png',
    width: 40,
    height: 24
  },
  velocity: {
    name: 'Pebl',
    imagePath: '/pebl_logo.png',
    width: 40,
    height: 24
  },
  playroll: {
    name: 'Playroll',
    imagePath: '/playroll_logo.png',
    width: 60,
    height: 24
  },
  omnipresent: {
    name: 'Omnipresent',
    imagePath: '/omnipresent_logo.png',
    width: 70,
    height: 24
  }
};

/**
 * Convert image URL to base64 for PDF embedding
 */
export async function imageToBase64(imagePath: string): Promise<string | null> {
  try {
    // For client-side execution
    if (typeof window !== 'undefined') {
      return await clientSideImageToBase64(imagePath);
    }
    
    // For server-side execution (if needed)
    return await serverSideImageToBase64(imagePath);
  } catch (error) {
    console.error(`Failed to convert image to base64: ${imagePath}`, error);
    return null;
  }
}

/**
 * Client-side image to base64 conversion
 */
async function clientSideImageToBase64(imagePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        ctx.drawImage(img, 0, 0);
        
        const base64 = canvas.toDataURL('image/png');
        resolve(base64);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${imagePath}`));
    };
    
    // Handle relative paths
    const fullPath = imagePath.startsWith('/') 
      ? `${window.location.origin}${imagePath}` 
      : imagePath;
    
    img.src = fullPath;
  });
}

/**
 * Server-side image to base64 conversion (fallback)
 */
async function serverSideImageToBase64(imagePath: string): Promise<string> {
  // For server-side rendering, we'll return a placeholder or handle differently
  // This would require fs operations in a Node.js environment
  throw new Error('Server-side image conversion not implemented. Use client-side conversion.');
}

/**
 * Get provider logo with base64 conversion
 */
export async function getProviderLogoWithBase64(provider: ProviderType): Promise<ProviderLogoData> {
  const logoData = { ...PROVIDER_LOGOS[provider] };
  
  try {
    const base64 = await imageToBase64(logoData.imagePath);
    if (base64) {
      logoData.base64 = base64;
    }
  } catch (error) {
    console.warn(`Failed to convert logo for ${provider}:`, error);
    // Logo will be used without base64, fallback to provider name
  }
  
  return logoData;
}

/**
 * Get all provider logos with base64 conversion
 */
export async function getAllProviderLogosWithBase64(
  providers: ProviderType[]
): Promise<Record<ProviderType, ProviderLogoData>> {
  const logoPromises = providers.map(async (provider) => {
    const logoData = await getProviderLogoWithBase64(provider);
    return [provider, logoData] as const;
  });
  
  const logoResults = await Promise.allSettled(logoPromises);
  const logos: Partial<Record<ProviderType, ProviderLogoData>> = {};
  
  logoResults.forEach((result, index) => {
    const provider = providers[index];
    if (result.status === 'fulfilled') {
      logos[provider] = result.value[1];
    } else {
      // Fallback to logo data without base64
      console.warn(`Failed to process logo for ${provider}:`, result.reason);
      logos[provider] = { ...PROVIDER_LOGOS[provider] };
    }
  });
  
  return logos as Record<ProviderType, ProviderLogoData>;
}

/**
 * Create a fallback logo element for providers without images
 */
export function createFallbackLogo(provider: ProviderType): ProviderLogoData {
  return {
    name: PROVIDER_LOGOS[provider]?.name || provider.charAt(0).toUpperCase() + provider.slice(1),
    imagePath: '',
    width: 120,
    height: 24,
    base64: undefined
  };
}

/**
 * Validate if a base64 string is a valid image
 */
export function isValidBase64Image(base64: string): boolean {
  try {
    // Check if it's a valid data URL format
    if (!base64.startsWith('data:image/')) {
      return false;
    }
    
    // Basic validation of base64 structure
    const base64Data = base64.split(',')[1];
    if (!base64Data || base64Data.length === 0) {
      return false;
    }
    
    // Try to decode base64 to validate
    atob(base64Data);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get logo dimensions for PDF layout
 */
export function getLogoDisplayDimensions(
  provider: ProviderType,
  maxWidth: number = 80,
  maxHeight: number = 30
): { width: number; height: number } {
  const logoData = PROVIDER_LOGOS[provider];
  if (!logoData) {
    return { width: maxWidth, height: maxHeight };
  }
  
  const aspectRatio = logoData.width / logoData.height;
  
  // Calculate dimensions maintaining aspect ratio
  let width = maxWidth;
  let height = width / aspectRatio;
  
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }
  
  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * Preload all provider logos (useful for performance)
 */
export async function preloadProviderLogos(providers: ProviderType[]): Promise<void> {
  const preloadPromises = providers.map(provider => {
    const logoData = PROVIDER_LOGOS[provider];
    if (!logoData || !logoData.imagePath) return Promise.resolve();
    
    return new Promise<void>((resolve) => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }
      
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve(); // Continue even if image fails to load
      img.src = logoData.imagePath.startsWith('/') 
        ? `${window.location.origin}${logoData.imagePath}` 
        : logoData.imagePath;
    });
  });
  
  await Promise.allSettled(preloadPromises);
}
