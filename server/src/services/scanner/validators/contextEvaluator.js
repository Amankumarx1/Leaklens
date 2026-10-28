/**
 * Context Evaluator
 * Evaluates contextual evidence in the vicinity of candidate pattern matches
 * to determine confidence level (high, medium, low) and suppress false positives.
 */

const POSITIVE_KEYWORDS = [
  'secret', 'password', 'passwd', 'pwd', 'token', 'api_key', 'apikey', 'credential',
  'auth', 'bearer', 'private', 'client_secret', 'access_key', 'authorization',
  'connectionstring', 'database', 'db_password', 'conn_str', 'aadhaar', 'pan_card',
  'pan_no', 'identity', 'card_number', 'credit_card', 'debit_card', 'cvv', 'ifsc', 'upi',
  'confidential', 'restricted', 'internal_only', 'top_secret', 'vault', 'sendgrid',
  'twilio', 'webhook', 'iban', 'sin', 'nino', 'license', 'passport'
];

const NEGATIVE_KEYWORDS = [
  'example', 'sample', 'dummy', 'placeholder', 'test', 'mock', 'fake', 'template',
  'demo', 'foobar', 'lorem', 'ipsum', 'change_me', 'your_key_here'
];

/**
 * Evaluates the confidence of a detection based on surrounding context.
 *
 * @param {string} fullText - Full line or content string
 * @param {number} matchIndex - Starting index of the match
 * @param {number} matchLength - Length of the matched token
 * @param {object} [options]
 * @param {string} [options.baseConfidence='medium']
 * @param {boolean} [options.validated=false]
 * @returns {'high' | 'medium' | 'low'}
 */
export function evaluateConfidence(fullText, matchIndex, matchLength, options = {}) {
  const { baseConfidence = 'medium', validated = false } = options;

  if (!fullText || typeof fullText !== 'string') {
    return validated ? 'high' : baseConfidence;
  }

  // Extract window of 80 characters before and after the match
  const start = Math.max(0, matchIndex - 80);
  const end = Math.min(fullText.length, matchIndex + matchLength + 80);
  const windowText = fullText.substring(start, end).toLowerCase();

  let hasPositiveContext = false;
  for (const kw of POSITIVE_KEYWORDS) {
    if (windowText.includes(kw)) {
      hasPositiveContext = true;
      break;
    }
  }

  let hasNegativeContext = false;
  for (const neg of NEGATIVE_KEYWORDS) {
    if (windowText.includes(neg)) {
      hasNegativeContext = true;
      break;
    }
  }

  if (hasNegativeContext && !validated) {
    return 'low';
  }

  if (validated) {
    return 'high';
  }

  if (hasPositiveContext) {
    return baseConfidence === 'low' ? 'medium' : 'high';
  }

  return baseConfidence;
}

export default {
  evaluateConfidence
};
