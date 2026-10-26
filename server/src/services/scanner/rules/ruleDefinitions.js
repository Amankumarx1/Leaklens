/**
 * LeakLens Canonical Detection Rule Definitions & Signatures
 * Defines stable UUIDs, categories, severity ratings, matching strategies,
 * confidence behaviors, and security limitations across all 10 sensitive data categories.
 */

export const CANONICAL_RULES = [
  // ============================================================================
  // 1. Existing Phase 2 Rules (Preserved verbatim for strict compatibility)
  // ============================================================================
  {
    rule_id: '11111111-1111-1111-1111-111111110001',
    rule_name: 'EMAIL_ADDRESS_RULE',
    category: 'EMAIL_ADDRESS',
    severity: 'low',
    confidence: 'medium',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'regex',
    description: 'Detects RFC-compliant email address patterns in plain text, CSV, and JSON content.',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    limitations: 'May match public contact emails. Excludes reserved RFC example domains.'
  },
  {
    rule_id: '11111111-1111-1111-1111-111111110002',
    rule_name: 'API_KEY_CANDIDATE_RULE',
    category: 'API_KEY_CANDIDATE',
    severity: 'high',
    confidence: 'high',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'regex',
    description: 'Detects candidate demonstration API keys and credential strings matching prefix patterns.',
    pattern: /\b(?:key_live_|key_test_|sk_live_|sk_test_|sk_demo_|api_key_|ghp_|gho_)[0-9a-zA-Z]{12,64}\b/g,
    limitations: 'Detects known credential prefixes with entropy bodies. Does not test if key is active.'
  },
  {
    rule_id: '11111111-1111-1111-1111-111111110003',
    rule_name: 'PRIVATE_KEY_MARKER_RULE',
    category: 'PRIVATE_KEY_MARKER',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'regex',
    description: 'Detects cryptographic private key PEM header markers. Never retains the private key body.',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    limitations: 'Matches header marker only. The sensitive private key body is never stored in persistent finding records.'
  },
  {
    rule_id: '11111111-1111-1111-1111-111111110004',
    rule_name: 'SENSITIVE_IDENTIFIER_RULE',
    category: 'SENSITIVE_IDENTIFIER',
    severity: 'medium',
    confidence: 'high',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'regex',
    description: 'Detects structured internal sensitive identifiers matching pattern LL-ID-[A-Z0-9]{4}-[A-Z0-9]{4}.',
    pattern: /\bLL-ID-[A-Z0-9]{4}-[A-Z0-9]{4}\b/g,
    limitations: 'Targets synthetic corporate asset/identity tokens. Excludes generic numeric sequences.'
  },

  // ============================================================================
  // 2. Cloud Credentials & Service API Tokens
  // ============================================================================
  {
    rule_id: '22222222-2222-2222-2222-222222220001',
    rule_name: 'AWS_ACCESS_KEY_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'regex',
    description: 'Detects Amazon Web Services standard IAM user access key identifiers (AKIA prefix).',
    pattern: new RegExp('\\bAKIA' + '[0-9A-Z]{16}\\b', 'g'),
    limitations: 'Matches 20-character identifier. Does not probe AWS STS to determine credential validity.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220002',
    rule_name: 'GITHUB_PAT_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'regex',
    description: 'Detects GitHub fine-grained and classic personal access tokens (github_pat_ / ghp_).',
    pattern: /\b(?:github_pat_[0-9a-zA-Z_]{82}|ghp_[0-9a-zA-Z]{36})\b/g,
    limitations: 'Matches canonical GitHub token prefix and entropy length.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220003',
    rule_name: 'SLACK_TOKEN_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'high',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'regex',
    description: 'Detects Slack workspace bot and user OAuth tokens (xoxb, xoxp).',
    pattern: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32}\b/g,
    limitations: 'Recognizes standard segmented Slack OAuth token structure.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220004',
    rule_name: 'STRIPE_SECRET_KEY_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'regex',
    description: 'Detects Stripe production live secret keys and restricted keys (sk_live_, rk_live_).',
    pattern: /\b[sr]k_live_[0-9a-zA-Z]{24,}\b/g,
    limitations: 'Matches live production key markers. Test keys (sk_test_) handled separately.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220005',
    rule_name: 'AI_PROVIDER_KEY_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'high',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'regex',
    description: 'Detects OpenAI and HuggingFace candidate API keys.',
    pattern: /\b(?:sk-[a-zA-Z0-9]{32,64}|hf_[a-zA-Z0-9]{34})\b/g,
    limitations: 'Targets standard prefix formats for modern generative AI provider tokens.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220006',
    rule_name: 'GCP_API_KEY_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'high',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'regex',
    description: 'Detects Google Cloud Platform (GCP) standard API keys (AIza prefix).',
    pattern: /\bAIza[0-9A-Za-z-_]{35}\b/g,
    limitations: 'Matches 39-character AIza prefix string.'
  },

  // ============================================================================
  // 3. Passwords & Hard-coded Credentials
  // ============================================================================
  {
    rule_id: '33333333-3333-3333-3333-333333330001',
    rule_name: 'PASSWORD_ASSIGNMENT_RULE',
    category: 'PASSWORD_CREDENTIAL',
    severity: 'high',
    confidence: 'medium',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'context_regex',
    description: 'Detects explicit password variable assignments in code and configuration files.',
    pattern: /(?:password|passwd|pwd|db_password)\s*[:=]\s*["']?([^\s"'`;]{6,64})["']?/gi,
    limitations: 'Suppresses empty values, placeholder tokens, and template mock strings.'
  },

  // ============================================================================
  // 4. JWTs & Bearer Tokens
  // ============================================================================
  {
    rule_id: '44444444-4444-4444-4444-444444440001',
    rule_name: 'JWT_TOKEN_RULE',
    category: 'JWT_BEARER_TOKEN',
    severity: 'high',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'regex',
    description: 'Detects three-part compact serialized JSON Web Tokens (JWT).',
    pattern: /\beyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*\b/g,
    limitations: 'Validates standard eyJ base64 header encoding. Excludes non-JWT dotted strings.'
  },
  {
    rule_id: '44444444-4444-4444-4444-444444440002',
    rule_name: 'BEARER_HEADER_RULE',
    category: 'JWT_BEARER_TOKEN',
    severity: 'high',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'regex',
    description: 'Detects HTTP Authorization Bearer headers carrying authentication tokens.',
    pattern: /Authorization:\s*Bearer\s+([A-Za-z0-9._~+/-]+=*)/gi,
    limitations: 'Identifies bearer token exposures in request dumps and log files.'
  },

  // ============================================================================
  // 5. Database Connection Strings & Credential URLs
  // ============================================================================
  {
    rule_id: '55555555-5555-5555-5555-555555550001',
    rule_name: 'DATABASE_URL_RULE',
    category: 'DATABASE_CONNECTION_STRING',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'regex',
    description: 'Detects database connection URLs with embedded credentials (mongodb, postgres, mysql, mssql, redis).',
    pattern: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|mssql|redis):\/\/[a-zA-Z0-9._%+-]+:[^\s@]+@[a-zA-Z0-9.-]+(?::[0-9]{1,5})?(?:\/[^\s]*)?/gi,
    limitations: 'Matches URI format containing user and password authority component.'
  },
  {
    rule_id: '55555555-5555-5555-5555-555555550002',
    rule_name: 'MSSQL_CONNECTION_STRING_RULE',
    category: 'DATABASE_CONNECTION_STRING',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'regex',
    description: 'Detects ADO.NET and OLEDB formatted Microsoft SQL Server connection strings with passwords.',
    pattern: /(?:Server|Data Source)=[^\s;]+;.*(?:User ID|UID)=[^\s;]+;.*(?:Password|PWD)=[^\s;]+/gi,
    limitations: 'Requires Server, User ID, and Password keys within the same connection definition.'
  },

  // ============================================================================
  // 6. Contact Information & Telephone Numbers
  // ============================================================================
  {
    rule_id: '66666666-6666-6666-6666-666666660001',
    rule_name: 'INDIAN_PHONE_RULE',
    category: 'TELEPHONE_NUMBER',
    severity: 'low',
    confidence: 'medium',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'context_regex',
    description: 'Detects Indian 10-digit mobile numbers with optional +91 or 0 prefix.',
    pattern: /\b(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g,
    limitations: 'Uses phone/contact context keywords to prevent classifying arbitrary 10-digit integers.'
  },

  // ============================================================================
  // 7. Personal Data & India Identifiers
  // ============================================================================
  {
    rule_id: '77777777-7777-7777-7777-777777770001',
    rule_name: 'INDIAN_PAN_RULE',
    category: 'PERSONAL_IDENTIFIER',
    severity: 'high',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'regex',
    description: 'Detects Indian Permanent Account Number (PAN) 10-character alphanumeric tax identifiers.',
    pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
    limitations: 'Matches 5 letters (4th is entity code: P,C,H,F,A,T,B,L,J,G), 4 digits, 1 check letter.'
  },
  {
    rule_id: '77777777-7777-7777-7777-777777770002',
    rule_name: 'INDIAN_AADHAAR_RULE',
    category: 'PERSONAL_IDENTIFIER',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'validator',
    validatorName: 'verhoeff',
    description: 'Detects 12-digit Indian Aadhaar numbers validated via the Verhoeff checksum algorithm.',
    pattern: /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g,
    limitations: 'Requires valid Verhoeff checksum. Excludes sequences starting with 0 or 1.'
  },
  {
    rule_id: '77777777-7777-7777-7777-777777770003',
    rule_name: 'INDIAN_IFSC_RULE',
    category: 'PERSONAL_IDENTIFIER',
    severity: 'low',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'regex',
    description: 'Detects Indian Financial System Codes (IFSC) for electronic funds transfer.',
    pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    limitations: '4 alphabetic bank code, zero, and 6-character branch identifier.'
  },
  {
    rule_id: '77777777-7777-7777-7777-777777770004',
    rule_name: 'INDIAN_UPI_ID_RULE',
    category: 'PERSONAL_IDENTIFIER',
    severity: 'medium',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'regex',
    description: 'Detects Unified Payments Interface (UPI) virtual payment addresses (VPA).',
    pattern: /\b[a-zA-Z0-9_.-]+@(okaxis|okhdfcbank|okicici|oksbi|paytm|ybl|ibl|axl|upi)\b/gi,
    limitations: 'Matches recognized Indian bank and payment aggregator VPA suffixes.'
  },

  // ============================================================================
  // 8. Financial Identifiers & Payment Cards
  // ============================================================================
  {
    rule_id: '88888888-8888-8888-8888-888888880001',
    rule_name: 'PAYMENT_CARD_RULE',
    category: 'FINANCIAL_IDENTIFIER',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'validator',
    validatorName: 'luhn',
    description: 'Detects Visa, MasterCard, Amex, Discover, and RuPay card numbers verified via Luhn checksum.',
    pattern: /\b(?:4[0-9]{3}(?:[\s-]?[0-9]{4}){3}|5[1-5][0-9]{2}(?:[\s-]?[0-9]{4}){3}|3[47][0-9]{2}[\s-]?[0-9]{6}[\s-]?[0-9]{5}|4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
    limitations: 'Enforces strict Luhn mod-10 algorithmic checksum verification.'
  },

  // ============================================================================
  // 9. Confidential Configuration & Environment Secrets
  // ============================================================================
  {
    rule_id: '99999999-9999-9999-9999-999999990001',
    rule_name: 'CONFIDENTIAL_CONFIG_RULE',
    category: 'CONFIDENTIAL_CONFIG',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'regex',
    description: 'Detects sensitive environment variable configuration keys containing secret assignments.',
    pattern: /\b(?:AWS_SECRET_ACCESS_KEY|AZURE_CLIENT_SECRET|GOOGLE_APPLICATION_CREDENTIALS|DB_PASSWORD|JWT_SECRET|SESSION_SECRET)\s*=\s*[^\s]+/gi,
    limitations: 'Matches high-risk production credential variable assignments.'
  },

  // ============================================================================
  // 10. High-Entropy Secret Candidates
  // ============================================================================
  {
    rule_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
    rule_name: 'HIGH_ENTROPY_SECRET_RULE',
    category: 'HIGH_ENTROPY_SECRET',
    severity: 'medium',
    confidence: 'medium',
    is_enabled: true,
    version: '1.0.0',
    strategy: 'entropy',
    minEntropy: 4.2,
    minLength: 24,
    description: 'Detects high-entropy random strings located near security context keywords.',
    pattern: /\b[a-zA-Z0-9_-]{24,80}\b/g,
    limitations: 'Requires Shannon entropy >= 4.2 and surrounding security context to minimize false positives.'
  }
];

export default CANONICAL_RULES;
