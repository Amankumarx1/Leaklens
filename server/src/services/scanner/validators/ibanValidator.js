/**
 * International Bank Account Number (IBAN) ISO 7064 Mod-97 Checksum Validator
 * Enforces ISO 13616 structure, country-specific length constraints,
 * and Mod-97-10 algorithmic checksum verification.
 */

// Canonical country IBAN length specifications
const IBAN_COUNTRY_LENGTHS = {
  AL: 28, AD: 24, AT: 20, BE: 16, BA: 20, BG: 22, HR: 21, CY: 28, CZ: 24,
  DK: 18, EE: 20, FO: 18, FI: 18, FR: 27, DE: 22, GI: 23, GR: 27, HU: 28,
  IS: 26, IE: 22, IL: 23, IT: 27, LV: 21, LB: 28, LI: 21, LT: 20, LU: 20,
  MT: 31, MU: 30, MC: 27, ME: 22, NL: 18, NO: 15, PL: 28, PT: 25, RO: 24,
  SM: 27, SA: 24, RS: 22, SK: 24, SI: 19, ES: 24, SE: 24, CH: 21, TN: 24,
  TR: 26, AE: 23, GB: 22
};

/**
 * Validates an IBAN candidate string against ISO 7064 Mod-97.
 * @param {string} ibanCandidate - Raw IBAN string (with or without spaces)
 * @returns {boolean} True if checksum and format are valid
 */
export function isValidIban(ibanCandidate) {
  if (!ibanCandidate || typeof ibanCandidate !== 'string') return false;

  // 1. Remove spaces, hyphens, and convert to uppercase
  const clean = ibanCandidate.replace(/[\s-]/g, '').toUpperCase();

  // 2. Format check: 2 letters, 2 digits, followed by alphanumeric chars (15 to 34 chars)
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(clean)) {
    return false;
  }

  // 3. Country-specific length verification
  const countryCode = clean.slice(0, 2);
  const expectedLength = IBAN_COUNTRY_LENGTHS[countryCode];
  if (expectedLength && clean.length !== expectedLength) {
    return false;
  }

  // 4. Rearrange: Move initial 4 characters (country + check digits) to the end
  const rearranged = clean.slice(4) + clean.slice(0, 4);

  // 5. Replace each letter with two digits (A=10, B=11, ..., Z=35)
  // and compute piece-wise mod 97 to avoid integer overflow
  let remainder = 0;
  for (let i = 0; i < rearranged.length; i++) {
    const code = rearranged.charCodeAt(i);
    if (code >= 48 && code <= 57) {
      // Digit '0'-'9'
      remainder = (remainder * 10 + (code - 48)) % 97;
    } else if (code >= 65 && code <= 90) {
      // Letter 'A'-'Z' -> 10-35 (two digits)
      const num = code - 55;
      const tens = Math.floor(num / 10);
      const units = num % 10;
      remainder = (remainder * 10 + tens) % 97;
      remainder = (remainder * 10 + units) % 97;
    } else {
      return false;
    }
  }

  // Valid IBAN must yield remainder 1
  return remainder === 1;
}

export default {
  isValidIban
};
