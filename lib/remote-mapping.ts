import remoteData from "./remote-slugs.json"

export const REMOTE_REGION_MAPPING: Record<string, string> = {}
export const REMOTE_CURRENCY_MAPPING: Record<string, string> = {}

remoteData.data.forEach((country) => {
  REMOTE_REGION_MAPPING[country.name] = country.region_slug
  REMOTE_CURRENCY_MAPPING[country.currency.code] = country.currency.slug
})

export function getRemoteRegionSlug(countryName: string): string | null {
  return REMOTE_REGION_MAPPING[countryName] || null
}

export function getRemoteCurrencySlug(currencyCode: string): string | null {
  return REMOTE_CURRENCY_MAPPING[currencyCode] || null
}

export function getRemoteAvailableCountries(): string[] {
  return remoteData.data
    .filter((country) => country.availability === "active")
    .map((country) => country.name)
    .sort()
}

export function getRemoteCountryStates(
  countryName: string,
): Array<{ code: string; name: string; slug: string }> | null {
  const country = remoteData.data.find((c) => c.name === countryName)
  return country?.child_regions && country.child_regions.length > 0 ? country.child_regions : null
}

export function getRemoteCountryCurrency(countryName: string): string | null {
  const country = remoteData.data.find((c) => c.name === countryName)
  return country?.currency?.code || null
}
