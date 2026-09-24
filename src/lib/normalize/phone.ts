import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Normalize any readable phone number to E.164 (+12025550143). Returns null when the number
 * cannot be parsed for the given default country — the caller decides whether that is a review item.
 */
export function normalizePhone(input: string | null | undefined, defaultCountry: string = "US"): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry.toUpperCase() as CountryCode);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}
