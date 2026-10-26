/**
 * False-Positive Allowlist & Exclusion Registry
 * Explicit, auditable definitions for suppressing non-sensitive template placeholders,
 * documentation fixtures, and RFC-reserved testing values.
 */

// Known placeholder token prefixes / literal patterns
const ALLOWLISTED_PLACEHOLDERS = [
  /^your[-_]?(api[-_]?key|secret|token|password|credential)/i,
  /^enter[-_]?(your[-_]?)?(key|secret|token|password)/i,
  /^change[-_]?me$/i,
  /^my[-_]?secret[-_]?password$/i,
  /^<insert[-_]?.*>$/i,
  /^\*+$/,
  /^x+$/i,
  /^0+$/,
  /^123456789+$/,
  /^(dummy|fake|sample|placeholder|test)[-_]?(secret|token|password|key)/i
];

// Explicitly dummy / placeholder email prefixes
const ALLOWLISTED_EMAIL_PREFIXES = [
  'dummy', 'placeholder', 'sample', 'fake', 'testuser1234'
];

/**
 * Checks whether a candidate match is an explicit allowlisted placeholder.
 *
 * @param {string} category - Finding category
 * @param {string} rawValue - Detected value
 * @param {string} [context=''] - Surrounding text
 * @returns {boolean} True if the match should be excluded as a false positive
 */
export function isAllowlisted(category, rawValue, context = '') {
  if (!rawValue || typeof rawValue !== 'string') return true;
  const trimmed = rawValue.trim();

  // 1. Generic placeholder patterns
  for (const pattern of ALLOWLISTED_PLACEHOLDERS) {
    if (pattern.test(trimmed)) return true;
  }

  // 2. Email placeholder check
  if (category === 'EMAIL_ADDRESS') {
    const atIndex = trimmed.indexOf('@');
    if (atIndex !== -1) {
      const user = trimmed.substring(0, atIndex).toLowerCase();
      if (ALLOWLISTED_EMAIL_PREFIXES.some(p => user.startsWith(p))) {
        return true;
      }
    }
  }

  // 3. Repeating character checks (e.g., '0000000000', 'XXXXXXXXXX')
  if (trimmed.length >= 8 && new Set(trimmed.split('')).size <= 2) {
    return true;
  }

  // 4. Dummy/Template context
  if (context && /(@example|mockData|testFixture|dummyPayload)/i.test(context)) {
    // Only allowlist if marked as test sample
    if (/sample|dummy|template/i.test(trimmed)) {
      return true;
    }
  }

  return false;
}

export default {
  isAllowlisted
};
