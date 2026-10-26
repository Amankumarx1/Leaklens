/**
 * Detection Rule Definitions & Signatures
 * Each rule defines a stable identifier, category, risk severity, pattern regex,
 * and documented limitations for security analysts.
 */

export const CANONICAL_RULES = [
  {
    rule_id: '11111111-1111-1111-1111-111111110001',
    rule_name: 'EMAIL_ADDRESS_RULE',
    category: 'EMAIL_ADDRESS',
    severity: 'low',
    is_enabled: true,
    description: 'Detects RFC-compliant email address patterns in plain text, CSV, and JSON content.',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    limitations: 'May match public contact emails or documentation samples. Severity rated LOW.'
  },
  {
    rule_id: '11111111-1111-1111-1111-111111110002',
    rule_name: 'API_KEY_CANDIDATE_RULE',
    category: 'API_KEY_CANDIDATE',
    severity: 'high',
    is_enabled: true,
    description: 'Detects candidate demonstration API keys and credential strings matching prefix patterns.',
    pattern: /\b(?:key_live_|key_test_|sk_live_|sk_test_|sk_demo_|api_key_|ghp_|gho_)[0-9a-zA-Z]{12,64}\b/g,
    limitations: 'Detects known credential prefixes with entropy bodies. Does not prove whether the key is active.'
  },
  {
    rule_id: '11111111-1111-1111-1111-111111110003',
    rule_name: 'PRIVATE_KEY_MARKER_RULE',
    category: 'PRIVATE_KEY_MARKER',
    severity: 'critical',
    is_enabled: true,
    description: 'Detects cryptographic private key PEM header markers. Never retains the private key body.',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    limitations: 'Matches header marker only. The sensitive private key body is never stored in persistent finding records.'
  },
  {
    rule_id: '11111111-1111-1111-1111-111111110004',
    rule_name: 'SENSITIVE_IDENTIFIER_RULE',
    category: 'SENSITIVE_IDENTIFIER',
    severity: 'medium',
    is_enabled: true,
    description: 'Detects structured internal sensitive identifiers matching pattern LL-ID-[A-Z0-9]{4}-[A-Z0-9]{4}.',
    pattern: /\bLL-ID-[A-Z0-9]{4}-[A-Z0-9]{4}\b/g,
    limitations: 'Targets synthetic corporate asset/identity tokens. Excludes generic numeric sequences.'
  }
];

export default CANONICAL_RULES;
