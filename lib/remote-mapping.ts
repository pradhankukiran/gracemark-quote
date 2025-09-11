import remoteData from "./remote-slugs.json"
import { iso2ToIso3 } from "./iso-country-codes"

export const REMOTE_REGION_MAPPING: Record<string, string> = {}
export const REMOTE_CURRENCY_MAPPING: Record<string, string> = {}

// Country name normalization map for Remote provider compatibility
export const REMOTE_COUNTRY_NAME_MAP: Record<string, string> = {
  "United States of America": "United States",
  "United Kingdom": "United Kingdom (UK)",
  "Russian Federation": "Russia", 
  "Republic of Korea": "South Korea",
  "Democratic People's Republic of Korea": "North Korea",
  "Czech Republic": "Czech Republic", // This one matches, keeping for clarity
  "Dominican Republic": "Dominican Republic", // This one matches, keeping for clarity
}

remoteData.data.forEach((country) => {
  REMOTE_REGION_MAPPING[country.name] = country.region_slug
  REMOTE_CURRENCY_MAPPING[country.currency.code] = country.currency.slug
})

export function getRemoteRegionSlug(countryInput: string): string | null {
  if (!countryInput) return null;

  console.log('🔍 Remote Region Slug Lookup:', { input: countryInput });

  // Normalize country name for Remote provider compatibility
  const normalizedCountry = REMOTE_COUNTRY_NAME_MAP[countryInput] || countryInput;
  if (normalizedCountry !== countryInput) {
    console.log('🔄 Remote Region Slug - Country name normalized:', { 
      original: countryInput, 
      normalized: normalizedCountry 
    });
  }

  // Try direct name lookup first (exact match)
  const directLookup = REMOTE_REGION_MAPPING[normalizedCountry];
  if (directLookup) {
    console.log('✅ Remote Region Slug - Direct name match:', { input: countryInput, normalized: normalizedCountry, slug: directLookup });
    return directLookup;
  }

  // Try country code lookup: US → USA → find by ISO3 code
  const inputUpper = countryInput.trim().toUpperCase();
  
  // Handle ISO2 → ISO3 conversion (e.g., "US" → "USA")
  let targetCode = inputUpper;
  if (inputUpper.length === 2) {
    const iso3Code = iso2ToIso3(inputUpper);
    if (iso3Code) {
      targetCode = iso3Code;
      console.log('🔄 Remote Region Slug - ISO2→ISO3 conversion:', { iso2: inputUpper, iso3: targetCode });
    }
  }

  // Find Remote country by ISO3 code
  const remoteCountry = remoteData.data.find(country => country.code === targetCode);
  if (remoteCountry) {
    console.log('✅ Remote Region Slug - Found by ISO3 code:', { 
      input: countryInput, 
      iso3: targetCode, 
      countryName: remoteCountry.name, 
      slug: remoteCountry.region_slug 
    });
    return remoteCountry.region_slug;
  }

  // Case-insensitive name search as fallback
  const inputLower = countryInput.toLowerCase();
  const caseInsensitiveMatch = remoteData.data.find(country => 
    country.name.toLowerCase() === inputLower
  );
  if (caseInsensitiveMatch) {
    console.log('✅ Remote Region Slug - Case insensitive name match:', { 
      input: countryInput, 
      countryName: caseInsensitiveMatch.name, 
      slug: caseInsensitiveMatch.region_slug 
    });
    return caseInsensitiveMatch.region_slug;
  }

  console.log('❌ Remote Region Slug - No match found:', { input: countryInput });
  return null;
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
  if (!countryName) return null;

  console.log('🔍 Remote Country States Lookup:', { input: countryName });

  // Normalize country name for Remote provider compatibility
  const normalizedCountry = REMOTE_COUNTRY_NAME_MAP[countryName] || countryName;
  if (normalizedCountry !== countryName) {
    console.log('🔄 Remote Country States - Country name normalized:', { 
      original: countryName, 
      normalized: normalizedCountry 
    });
  }

  // Try direct name lookup first (exact match)
  const directLookup = remoteData.data.find((c) => c.name === normalizedCountry);
  if (directLookup) {
    const states = directLookup?.child_regions && directLookup.child_regions.length > 0 ? directLookup.child_regions : null;
    console.log('✅ Remote Country States - Direct name match:', { input: countryName, normalized: normalizedCountry, states: states?.length || 0 });
    return states;
  }

  // Try country code lookup: US → USA → find by ISO3 code
  const inputUpper = countryName.trim().toUpperCase();
  
  // Handle ISO2 → ISO3 conversion (e.g., "US" → "USA")
  let targetCode = inputUpper;
  if (inputUpper.length === 2) {
    const iso3Code = iso2ToIso3(inputUpper);
    if (iso3Code) {
      targetCode = iso3Code;
      console.log('🔄 Remote Country States - ISO2→ISO3 conversion:', { iso2: inputUpper, iso3: targetCode });
    }
  }

  // Find Remote country by ISO3 code
  const remoteCountry = remoteData.data.find(country => country.code === targetCode);
  if (remoteCountry) {
    const states = remoteCountry?.child_regions && remoteCountry.child_regions.length > 0 ? remoteCountry.child_regions : null;
    console.log('✅ Remote Country States - Found by ISO3 code:', { 
      input: countryName, 
      iso3: targetCode, 
      countryName: remoteCountry.name, 
      states: states?.length || 0 
    });
    return states;
  }

  // Case-insensitive name search as fallback
  const inputLower = countryName.toLowerCase();
  const caseInsensitiveMatch = remoteData.data.find(country => 
    country.name.toLowerCase() === inputLower
  );
  if (caseInsensitiveMatch) {
    const states = caseInsensitiveMatch?.child_regions && caseInsensitiveMatch.child_regions.length > 0 ? caseInsensitiveMatch.child_regions : null;
    console.log('✅ Remote Country States - Case insensitive name match:', { 
      input: countryName, 
      countryName: caseInsensitiveMatch.name, 
      states: states?.length || 0 
    });
    return states;
  }

  console.log('❌ Remote Country States - No match found:', { input: countryName });
  return null;
}

export function getRemoteCountryCurrency(countryName: string): string | null {
  if (!countryName) return null;

  console.log('🔍 Remote Country Currency Lookup:', { input: countryName });

  // Normalize country name for Remote provider compatibility
  const normalizedCountry = REMOTE_COUNTRY_NAME_MAP[countryName] || countryName;
  if (normalizedCountry !== countryName) {
    console.log('🔄 Remote Country Currency - Country name normalized:', { 
      original: countryName, 
      normalized: normalizedCountry 
    });
  }

  // Try direct name lookup first (exact match)
  const directLookup = remoteData.data.find((c) => c.name === normalizedCountry);
  if (directLookup) {
    const currency = directLookup?.currency?.code || null;
    console.log('✅ Remote Country Currency - Direct name match:', { input: countryName, normalized: normalizedCountry, currency });
    return currency;
  }

  // Try country code lookup: US → USA → find by ISO3 code
  const inputUpper = countryName.trim().toUpperCase();
  
  // Handle ISO2 → ISO3 conversion (e.g., "US" → "USA")
  let targetCode = inputUpper;
  if (inputUpper.length === 2) {
    const iso3Code = iso2ToIso3(inputUpper);
    if (iso3Code) {
      targetCode = iso3Code;
      console.log('🔄 Remote Country Currency - ISO2→ISO3 conversion:', { iso2: inputUpper, iso3: targetCode });
    }
  }

  // Find Remote country by ISO3 code
  const remoteCountry = remoteData.data.find(country => country.code === targetCode);
  if (remoteCountry) {
    const currency = remoteCountry?.currency?.code || null;
    console.log('✅ Remote Country Currency - Found by ISO3 code:', { 
      input: countryName, 
      iso3: targetCode, 
      countryName: remoteCountry.name, 
      currency 
    });
    return currency;
  }

  // Case-insensitive name search as fallback
  const inputLower = countryName.toLowerCase();
  const caseInsensitiveMatch = remoteData.data.find(country => 
    country.name.toLowerCase() === inputLower
  );
  if (caseInsensitiveMatch) {
    const currency = caseInsensitiveMatch?.currency?.code || null;
    console.log('✅ Remote Country Currency - Case insensitive name match:', { 
      input: countryName, 
      countryName: caseInsensitiveMatch.name, 
      currency 
    });
    return currency;
  }

  console.log('❌ Remote Country Currency - No match found:', { input: countryName });
  return null;
}
