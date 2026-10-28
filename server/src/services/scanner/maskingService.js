import crypto from 'crypto';

/**
 * Dedicated Sensitive-Data Masking & Fingerprinting Service
 * Ensures raw secrets never persist into database records, logs, or API responses.
 * Implements salted HMAC-SHA256 fingerprinting for secure deduplication.
 */

const FINGERPRINT_SALT = process.env.SESSION_SECRET || process.env.HASH_SALT || 'leaklens_defense_salt_2026';

/**
 * Computes a secure HMAC-SHA256 fingerprint of a secret for deduplication without storing plaintext.
 * @param {string} rawValue 
 * @returns {string} Hexadecimal HMAC digest
 */
export function computeSecretFingerprint(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return '';
  return crypto.createHmac('sha256', FINGERPRINT_SALT).update(rawValue).digest('hex');
}

/**
 * Masks an email address by redacting local-part while preserving domain for operational triage.
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

  const prefixMatch = apiKey.match(/^([a-z0-9_-]+_)/i);
  const prefix = prefixMatch ? prefixMatch[1] : apiKey.substring(0, 4);
  const suffix = apiKey.substring(apiKey.length - 4);
  return `${prefix}***_${suffix}`;
}

/**
 * Masks a private key block by replacing it with a safe descriptive placeholder.
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
 * Masks a cloud credential token (AWS, GitHub, Slack, Stripe).
 * e.g., 'AKIA...' -> 'AKIA***MPLE'
 */
export function maskCloudCredential(token) {
  if (!token || typeof token !== 'string') return '[MASKED CLOUD CREDENTIAL]';
  if (token.includes('AccountKey=')) {
    return token.replace(/(AccountKey\s*=\s*)[^;"']+/gi, '$1***[MASKED_AZURE_KEY]***');
  }
  if (token.includes('sig=')) {
    return token.replace(/sig=[^&"'\s]+/gi, 'sig=***[MASKED_SAS]***');
  }
  if (token.includes('"type"') && token.includes('service_account')) {
    return '[MASKED GCP SERVICE ACCOUNT KEY]';
  }
  if (token.startsWith('AKIA')) {
    return `AKIA***${token.slice(-4)}`;
  }
  if (token.startsWith('ghp_') || token.startsWith('gho_')) {
    return `ghp_***${token.slice(-4)}`;
  }
  if (token.startsWith('github_pat_')) {
    return `github_pat_***${token.slice(-4)}`;
  }
  if (token.startsWith('glpat-')) {
    return `glpat-***${token.slice(-4)}`;
  }
  if (token.startsWith('npm_')) {
    return `npm_***${token.slice(-4)}`;
  }
  if (token.startsWith('pypi-')) {
    return `pypi-***${token.slice(-6)}`;
  }
  if (token.startsWith('dckr_pat_')) {
    return `dckr_pat_***${token.slice(-4)}`;
  }
  if (token.startsWith('SG.')) {
    return `SG.***${token.slice(-4)}`;
  }
  if (token.startsWith('s.')) {
    return `s.***${token.slice(-4)}`;
  }
  if (token.startsWith('hvs.')) {
    return `hvs.***${token.slice(-4)}`;
  }
  if (token.startsWith('AC') || token.startsWith('SK')) {
    return `${token.slice(0, 2)}***${token.slice(-4)}`;
  }
  if (token.startsWith('sq0atp-') || token.startsWith('sq0csp-')) {
    return `sq0***${token.slice(-4)}`;
  }
  if (token.startsWith('key-') && token.length >= 24) {
    return `key-***${token.slice(-4)}`;
  }
  if (token.includes('hooks.slack.com') || token.includes('discord.com/api/webhooks')) {
    return token.replace(/(\/services\/|\/webhooks\/)[^\s]+/i, '$1***[MASKED_WEBHOOK]***');
  }
  if (token.startsWith('sk_live_') || token.startsWith('rk_live_')) {
    return `sk_live_***${token.slice(-4)}`;
  }
  return maskApiKey(token);
}

/**
 * Masks a database connection string by redacting embedded passwords.
 * e.g., 'mongodb://user:supersecret@cluster.mongodb.net/prod' -> 'mongodb://user:***@cluster.mongodb.net/prod'
 */
export function maskConnectionString(connStr) {
  if (!connStr || typeof connStr !== 'string') return '[MASKED CONNECTION STRING]';

  // URI format e.g. proto://user:password@host
  if (connStr.includes('://')) {
    return connStr.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***$2');
  }

  // Key-value format e.g. Password=secret;
  return connStr.replace(/(Password|PWD)\s*=\s*[^;]+/gi, '$1=***');
}

/**
 * Masks payment card numbers and IBAN identifiers.
 * e.g., '4111222233334444' -> '4111-****-****-4444'
 * e.g., 'GB82WEST12345698765432' -> 'GB82 **** **** **** **5432'
 */
export function maskPaymentCard(cardNumber) {
  if (!cardNumber || typeof cardNumber !== 'string') return '[MASKED FINANCIAL IDENTIFIER]';
  const clean = cardNumber.replace(/\s+/g, '').toUpperCase();

  // IBAN: 2 letters, 2 digits + alphanumeric body
  if (/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(clean)) {
    return `${clean.slice(0, 4)} **** **** **** **${clean.slice(-4)}`;
  }

  const digits = cardNumber.replace(/[\s-]/g, '');
  if (digits.length < 12) return '****-****-****';
  const first4 = digits.slice(0, 4);
  const last4 = digits.slice(-4);
  return `${first4}-****-****-${last4}`;
}

/**
 * Masks personal identifiers including Indian PAN, Aadhaar, IFSC, US SSN, UK NINO, Canadian SIN, and Passports.
 */
export function maskPersonalIdentifier(idStr) {
  if (!idStr || typeof idStr !== 'string') return '[MASKED ID]';
  const clean = idStr.trim();

  // US SSN: 3 digits, 2 digits, 4 digits -> ***-**-1234
  if (/^\d{3}-\d{2}-\d{4}$/.test(clean)) {
    return `***-**-${clean.slice(-4)}`;
  }

  // Canadian SIN: 3 digits, 3 digits, 3 digits -> ***-***-123
  if (/^\d{3}[ -]\d{3}[ -]\d{3}$/.test(clean)) {
    return `***-***-${clean.replace(/[\s-]/g, '').slice(-3)}`;
  }

  // UK NINO: 2 letters, 6 digits, 1 letter -> AB***12C
  if (/^[A-Z]{2}\s?[0-9]{2}\s?[0-9]{2}\s?[0-9]{2}\s?[A-D]$/i.test(clean)) {
    const compact = clean.replace(/\s/g, '');
    return `${compact.slice(0, 2)}***${compact.slice(-3)}`;
  }

  // PAN: 5 letters, 4 digits, 1 letter -> e.g. ABCDE***F
  if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean)) {
    return `${clean.slice(0, 4)}***${clean.slice(-2)}`;
  }

  // Indian Passport: 1 letter, 7 digits -> A1***567
  if (/^[A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]$/.test(clean)) {
    return `${clean.slice(0, 2)}***${clean.slice(-3)}`;
  }

  // Indian Driving License: 2 letters, 2 digits, 11 digits -> DL04***1234
  if (/^[A-Z]{2}[0-9]{2}[ -]?[0-9]{11}$/.test(clean)) {
    return `${clean.slice(0, 4)}***${clean.slice(-4)}`;
  }

  // Aadhaar: 12 digits -> e.g. **** **** 1234
  const digits = clean.replace(/[\s-]/g, '');
  if (/^\d{12}$/.test(digits)) {
    return `**** **** ${digits.slice(-4)}`;
  }

  // IFSC: 4 letters, 0, 6 chars -> e.g. SBIN0***123
  if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(clean)) {
    return `${clean.slice(0, 5)}***${clean.slice(-3)}`;
  }

  // UPI ID: username@bank -> u***r@bank
  if (clean.includes('@')) {
    return maskEmail(clean);
  }

  return maskSensitiveIdentifier(clean);
}

/**
 * Masks a JWT or Bearer token.
 */
export function maskJwtOrBearer(token) {
  if (!token || typeof token !== 'string') return '[MASKED TOKEN]';
  if (token.startsWith('eyJh') || token.startsWith('eyJb')) {
    return `eyJ***...[MASKED_JWT]`;
  }
  if (token.toLowerCase().startsWith('authorization:')) {
    return 'Authorization: Bearer ***[MASKED]***';
  }
  return `${token.slice(0, 6)}***[MASKED_TOKEN]`;
}

/**
 * Masks passwords and secret assignments.
 */
export function maskPassword(pwdStr) {
  if (!pwdStr || typeof pwdStr !== 'string') return '[MASKED PASSWORD]';
  if (pwdStr.includes('=')) {
    const [key] = pwdStr.split('=');
    return `${key.trim()}=[CONFIDENTIAL_PASSWORD]`;
  }
  if (pwdStr.includes(':')) {
    const [key] = pwdStr.split(':');
    return `${key.trim()}: [CONFIDENTIAL_PASSWORD]`;
  }
  return '[CONFIDENTIAL_PASSWORD]';
}

/**
 * Masks phone numbers by redacting middle digits.
 */
export function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '[MASKED PHONE]';
  const clean = phone.trim();
  if (clean.length >= 10) {
    return `${clean.slice(0, 3)}****${clean.slice(-3)}`;
  }
  return '***-***-****';
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
    case 'CLOUD_CREDENTIAL':
      return maskCloudCredential(rawValue);
    case 'PRIVATE_KEY_MARKER':
      return maskPrivateKey(rawValue);
    case 'SENSITIVE_IDENTIFIER':
      return maskSensitiveIdentifier(rawValue);
    case 'PASSWORD_CREDENTIAL':
      return maskPassword(rawValue);
    case 'JWT_BEARER_TOKEN':
      return maskJwtOrBearer(rawValue);
    case 'DATABASE_CONNECTION_STRING':
      return maskConnectionString(rawValue);
    case 'TELEPHONE_NUMBER':
      return maskPhoneNumber(rawValue);
    case 'PERSONAL_IDENTIFIER':
      return maskPersonalIdentifier(rawValue);
    case 'FINANCIAL_IDENTIFIER':
      return maskPaymentCard(rawValue);
    case 'CONFIDENTIAL_CONFIG':
      return maskPassword(rawValue);
    case 'HIGH_ENTROPY_SECRET':
      if (!rawValue || rawValue.length <= 8) return '***[MASKED]***';
      return `${rawValue.slice(0, 3)}***${rawValue.slice(-3)}`;
    default:
      if (!rawValue || typeof rawValue !== 'string') return '[REDACTED]';
      if (rawValue.length <= 4) return '****';
      return `${rawValue.slice(0, 2)}***${rawValue.slice(-2)}`;
  }
}

export default {
  computeSecretFingerprint,
  maskEmail,
  maskApiKey,
  maskPrivateKey,
  maskSensitiveIdentifier,
  maskCloudCredential,
  maskConnectionString,
  maskPaymentCard,
  maskPersonalIdentifier,
  maskJwtOrBearer,
  maskPassword,
  maskPhoneNumber,
  maskSecret
};
