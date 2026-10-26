/**
 * Dedicated Sensitive-Data Masking Service
 * Ensures raw secrets never persist into database records, logs, or ordinary API responses.
 */

/**
 * Masks an email address by redacting the local-part while preserving the domain for operational recognition.
 * e.g., 'analyst.jane@example.com' -> 'a***e@example.com'
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '[MASKED EMAIL]';
  const parts = email.split('@');
  if (parts.length !== 2) return '[MASKED EMAIL]';

  const [localPart, domain] = parts;
  if (localPart.length <= 2) {
    return `${localPart[0] || '*'}***@${domain}`;
  }
  return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
}

/**
 * Masks an API-key-like candidate string.
 * Preserves initial prefix for identification, redacting the key entropy body and keeping a suffix.
 * e.g., 'key_live_839a8f27b9c104e' -> 'key_live_***_104e'
 */
export function maskApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return '[MASKED API KEY]';
  if (apiKey.length <= 8) {
    return '***[MASKED]***';
  }

  // Check prefix
  const prefixMatch = apiKey.match(/^([a-z0-9_-]+_)/i);
  const prefix = prefixMatch ? prefixMatch[1] : apiKey.substring(0, 4);
  const suffix = apiKey.substring(apiKey.length - 4);
  return `${prefix}***_${suffix}`;
}

/**
 * Masks a private key block by replacing it with a safe descriptive placeholder.
 * Never persists or retains the private key body.
 */
export function maskPrivateKey(_marker) {
  return '[MASKED PRIVATE KEY BLOCK]';
}

/**
 * Masks internal sensitive identifiers.
 * e.g., 'LL-ID-A9F2-4801' -> 'LL-ID-***-4801'
 */
export function maskSensitiveIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') return '[MASKED IDENTIFIER]';
  const parts = identifier.split('-');
  if (parts.length >= 3) {
    return `${parts[0]}-${parts[1]}-***-${parts[parts.length - 1]}`;
  }
  return 'LL-ID-***';
}

/**
 * Master masking function routing to category-specific formatters.
 */
export function maskSecret(category, rawValue) {
  switch (category) {
    case 'EMAIL_ADDRESS':
      return maskEmail(rawValue);
    case 'API_KEY_CANDIDATE':
      return maskApiKey(rawValue);
    case 'PRIVATE_KEY_MARKER':
      return maskPrivateKey(rawValue);
    case 'SENSITIVE_IDENTIFIER':
      return maskSensitiveIdentifier(rawValue);
    default:
      if (!rawValue || typeof rawValue !== 'string') return '[REDACTED]';
      if (rawValue.length <= 4) return '****';
      return `${rawValue.slice(0, 2)}***${rawValue.slice(-2)}`;
  }
}

export default {
  maskEmail,
  maskApiKey,
  maskPrivateKey,
  maskSensitiveIdentifier,
  maskSecret
};
