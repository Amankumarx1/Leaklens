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
  },

  // ============================================================================
  // 11. Azure Cloud Infrastructure Secrets
  // ============================================================================
  {
    rule_id: '22222222-2222-2222-2222-222222220007',
    rule_name: 'AZURE_STORAGE_KEY_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.1.0',
    strategy: 'regex',
    description: 'Detects Microsoft Azure Storage Account master access keys (512-bit Base64).',
    pattern: /(?:AccountKey\s*[:=]\s*["']?|AccountKey=)([a-zA-Z0-9+/]{86}==)/gi,
    limitations: 'Matches 512-bit Base64 keys tied to Azure Storage Account connection strings.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220008',
    rule_name: 'AZURE_SAS_TOKEN_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.1.0',
    strategy: 'regex',
    description: 'Detects Azure Storage Shared Access Signature (SAS) delegation tokens with sig parameter.',
    pattern: /(?:[\?&]sv=\d{4}-\d{2}-\d{2}[^\s"'<>]+sig=[a-zA-Z0-9%+/=]{43,88}|se=\d{4}-\d{2}-\d{2}[^\s"'<>]+sig=[a-zA-Z0-9%+/=]{43,88})/gi,
    limitations: 'Identifies signed SAS query strings granting time-bound access to Azure Blobs.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220009',
    rule_name: 'AZURE_COSMOS_KEY_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.1.0',
    strategy: 'regex',
    description: 'Detects Azure Cosmos DB primary/secondary master access keys.',
    pattern: /(?:AccountEndpoint=[^;]+;\s*AccountKey=([a-zA-Z0-9+/=]{86,88})|cosmos(?:db)?(?:_key|_secret|_master_key)?\s*[:=]\s*["']?([a-zA-Z0-9+/=]{86,88})["']?)/gi,
    limitations: 'Requires Cosmos DB endpoint context or cosmos variable assignment.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220010',
    rule_name: 'AZURE_CLIENT_SECRET_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.1.0',
    strategy: 'regex',
    description: 'Detects Microsoft Entra ID / Azure AD Service Principal client secrets.',
    pattern: /(?:AZURE_CLIENT_SECRET|client_secret|azure_secret)\s*[:=]\s*["']?([a-zA-Z0-9~_.-]{34,44})["']?/gi,
    limitations: 'Matches explicit Entra ID client secret assignment tokens.'
  },

  // ============================================================================
  // 12. Modern DevOps, CI/CD, & Registry Tokens
  // ============================================================================
  {
    rule_id: '22222222-2222-2222-2222-222222220011',
    rule_name: 'GITLAB_PAT_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.1.0',
    strategy: 'regex',
    description: 'Detects GitLab Personal, Project, and Group Access Tokens (glpat- prefix).',
    pattern: /\bglpat-[0-9a-zA-Z_\-]{20,32}\b/g,
    limitations: 'Matches standard GitLab PAT token prefix and entropy length.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220012',
    rule_name: 'NPM_ACCESS_TOKEN_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.1.0',
    strategy: 'regex',
    description: 'Detects npm registry automation and publish access tokens (npm_ prefix).',
    pattern: /\bnpm_[a-zA-Z0-9]{36}\b/g,
    limitations: 'Matches canonical npm granular and automation token structure.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220013',
    rule_name: 'PYPI_UPLOAD_TOKEN_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.1.0',
    strategy: 'regex',
    description: 'Detects Python Package Index (PyPI) upload API tokens (pypi-AgEI prefix).',
    pattern: /\bpypi-(?:AgEIcHlwaS5vcmc|AgEI)[A-Za-z0-9\-_]{20,180}\b/g,
    limitations: 'Matches standard PyPI token prefix and base64 metadata header.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220014',
    rule_name: 'DOCKER_PAT_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.1.0',
    strategy: 'regex',
    description: 'Detects Docker Hub personal access tokens (dckr_pat_ prefix).',
    pattern: /\bdckr_pat_[a-zA-Z0-9_\-]{20,60}\b/g,
    limitations: 'Matches Docker Hub personal access token prefix and length.'
  },

  // ============================================================================
  // 13. Additional Cryptographic Key Headers
  // ============================================================================
  {
    rule_id: '11111111-1111-1111-1111-111111110005',
    rule_name: 'OPENSSH_PRIVATE_KEY_RULE',
    category: 'PRIVATE_KEY_MARKER',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.1.0',
    strategy: 'regex',
    description: 'Detects OpenSSH and PKCS#8 encrypted private key PEM headers.',
    pattern: /-----BEGIN (?:OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,
    limitations: 'Matches header marker only. Private key content is never retained.'
  },
  {
    rule_id: '11111111-1111-1111-1111-111111110006',
    rule_name: 'PGP_PRIVATE_KEY_RULE',
    category: 'PRIVATE_KEY_MARKER',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.1.0',
    strategy: 'regex',
    description: 'Detects OpenPGP / GPG private key block headers.',
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g,
    limitations: 'Matches PGP private block marker without retaining key payload.'
  },

  // ============================================================================
  // 14. Global PII & Financial Identifiers
  // ============================================================================
  {
    rule_id: '77777777-7777-7777-7777-777777770005',
    rule_name: 'US_SSN_RULE',
    category: 'PERSONAL_IDENTIFIER',
    severity: 'high',
    confidence: 'medium',
    is_enabled: true,
    version: '1.1.0',
    strategy: 'regex',
    description: 'Detects US Social Security Numbers (SSN) with valid area, group, and serial number rules.',
    pattern: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
    limitations: 'Enforces SSA restrictions: excludes area 000/666/900-999, group 00, serial 0000.'
  },
  {
    rule_id: '88888888-8888-8888-8888-888888880002',
    rule_name: 'IBAN_RULE',
    category: 'FINANCIAL_IDENTIFIER',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.1.0',
    strategy: 'validator',
    validatorName: 'iban',
    description: 'Detects International Bank Account Numbers (IBAN) validated via ISO 7064 Mod-97 checksum.',
    pattern: /\b[A-Z]{2}[0-9]{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g,
    limitations: 'Requires ISO country code match, country-specific length verification, and Mod-97 check.'
  },

  // ============================================================================
  // 15. Additional SaaS & Cloud Service Provider Secrets
  // ============================================================================
  {
    rule_id: '22222222-2222-2222-2222-222222220015',
    rule_name: 'GCP_SERVICE_ACCOUNT_KEY_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'regex',
    description: 'Detects Google Cloud Platform (GCP) Service Account private key JSON credential documents.',
    pattern: /"type"\s*:\s*"service_account"[\s\S]{1,250}?"private_key"/gi,
    limitations: 'Matches GCP service_account credential file blocks. Key content is strictly masked.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220016',
    rule_name: 'HASHICORP_VAULT_TOKEN_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'regex',
    description: 'Detects HashiCorp Vault root tokens (s. prefix) and service tokens (hvs. prefix).',
    pattern: /\b(?:s\.[a-zA-Z0-9]{24}|hvs\.[a-zA-Z0-9_\-]{24,36})\b/g,
    limitations: 'Matches standard Vault token prefix and length.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220017',
    rule_name: 'SENDGRID_API_KEY_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'regex',
    description: 'Detects SendGrid mail delivery production and restricted API keys (SG. prefix).',
    pattern: /\bSG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}\b/g,
    limitations: 'Requires SG. prefix followed by 22-char key id and 43-char secret part.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220018',
    rule_name: 'TWILIO_CREDENTIAL_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'high',
    confidence: 'high',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'regex',
    description: 'Detects Twilio Account SIDs (AC prefix) and API Signing Keys (SK prefix).',
    pattern: /\b(?:AC[0-9a-fA-F]{32}|SK[0-9a-fA-F]{32})\b/g,
    limitations: 'Matches 34-character hexadecimal Twilio resource identifiers.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220019',
    rule_name: 'SLACK_WEBHOOK_URL_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'high',
    confidence: 'high',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'regex',
    description: 'Detects incoming Slack Webhook URLs containing workspace and channel routing tokens.',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]{8,11}\/B[0-9A-Z]{8,11}\/[0-9a-zA-Z]{24}/g,
    limitations: 'Identifies live webhook endpoints capable of posting unauthenticated messages.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220020',
    rule_name: 'DISCORD_WEBHOOK_URL_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'high',
    confidence: 'high',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'regex',
    description: 'Detects Discord incoming webhook URLs with exposed channel routing tokens.',
    pattern: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]{17,21}\/[a-zA-Z0-9_\-]{60,68}/g,
    limitations: 'Matches Discord webhook URLs with snowflake ID and token.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220021',
    rule_name: 'SQUARE_ACCESS_TOKEN_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'regex',
    description: 'Detects Square payment platform access tokens and client secrets.',
    pattern: /\b(?:sq0atp-[0-9A-Za-z\-_]{22}|sq0csp-[0-9A-Za-z\-_]{43})\b/g,
    limitations: 'Matches Square OAuth production access token prefix.'
  },
  {
    rule_id: '22222222-2222-2222-2222-222222220022',
    rule_name: 'MAILGUN_API_KEY_RULE',
    category: 'CLOUD_CREDENTIAL',
    severity: 'high',
    confidence: 'high',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'regex',
    description: 'Detects Mailgun transactional email sending API keys.',
    pattern: /\bkey-[0-9a-zA-Z]{32}\b/g,
    limitations: 'Matches key- prefix with 32 hexadecimal character body.'
  },

  // ============================================================================
  // 16. Expanded Global Identity & National PII Documents
  // ============================================================================
  {
    rule_id: '77777777-7777-7777-7777-777777770006',
    rule_name: 'UK_NINO_RULE',
    category: 'PERSONAL_IDENTIFIER',
    severity: 'high',
    confidence: 'high',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'regex',
    description: 'Detects UK National Insurance Numbers (NINO) with letter suffix and prefix structure.',
    pattern: /\b[A-Z]{2}\s?[0-9]{2}\s?[0-9]{2}\s?[0-9]{2}\s?[A-D]\b/gi,
    limitations: 'Matches standard 9-character UK NINO format (two letters, six digits, one letter suffix).'
  },
  {
    rule_id: '77777777-7777-7777-7777-777777770007',
    rule_name: 'CANADIAN_SIN_RULE',
    category: 'PERSONAL_IDENTIFIER',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'validator',
    validatorName: 'luhn',
    description: 'Detects Canadian Social Insurance Numbers (SIN) verified via Luhn mod-10 algorithm.',
    pattern: /\b[0-9]{3}[ -][0-9]{3}[ -][0-9]{3}\b/g,
    limitations: 'Requires valid Luhn mod-10 checksum check.'
  },
  {
    rule_id: '77777777-7777-7777-7777-777777770008',
    rule_name: 'INDIAN_PASSPORT_RULE',
    category: 'PERSONAL_IDENTIFIER',
    severity: 'critical',
    confidence: 'high',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'regex',
    description: 'Detects Indian Passport Numbers matching official MEA 8-character format.',
    pattern: /\b[A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]\b/g,
    limitations: '1st char is valid letter series, 2nd non-zero digit, followed by 5 digits and 1 check digit.'
  },
  {
    rule_id: '77777777-7777-7777-7777-777777770009',
    rule_name: 'INDIAN_DRIVING_LICENSE_RULE',
    category: 'PERSONAL_IDENTIFIER',
    severity: 'high',
    confidence: 'high',
    is_enabled: true,
    version: '1.2.0',
    strategy: 'regex',
    description: 'Detects Indian Driving License numbers (state code + RTO + serial).',
    pattern: /\b[A-Z]{2}[0-9]{2}[ -]?[0-9]{11}\b/g,
    limitations: 'Requires 2-letter state code followed by 2-digit RTO and 11-digit license number.'
  }
];

export default CANONICAL_RULES;
