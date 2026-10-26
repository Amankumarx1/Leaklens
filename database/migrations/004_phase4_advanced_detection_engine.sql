-- ==============================================================================
-- LEAKLENS DATABASE MIGRATION 004: ADVANCED MODULAR DETECTION ENGINE
-- Target Engine: Azure SQL Database / Microsoft SQL Server 2022
-- Purpose:
--   1. Adds confidence rating and structured field path columns to leaklens.findings
--   2. Adds salted HMAC secret fingerprint column for deduplication & tracking
--   3. Expands category CHECK constraint on leaklens.detection_rules
--   4. Seeds new detection rules across all 10 sensitive data categories
-- ==============================================================================

SET NOCOUNT ON;
GO

-- 1. ADD CONFIDENCE, FIELD_PATH, AND SECRET_FINGERPRINT TO FINDINGS
IF COL_LENGTH('leaklens.findings', 'confidence') IS NULL
BEGIN
    ALTER TABLE leaklens.findings
    ADD confidence NVARCHAR(16) NOT NULL 
        CONSTRAINT DF_findings_confidence DEFAULT 'high'
        CONSTRAINT CK_findings_confidence CHECK (confidence IN ('high', 'medium', 'low'));
END
GO

IF COL_LENGTH('leaklens.findings', 'field_path') IS NULL
BEGIN
    ALTER TABLE leaklens.findings
    ADD field_path NVARCHAR(256) NULL;
END
GO

IF COL_LENGTH('leaklens.findings', 'secret_fingerprint') IS NULL
BEGIN
    ALTER TABLE leaklens.findings
    ADD secret_fingerprint CHAR(64) NULL;
END
GO

-- 2. EXPAND DETECTION RULES CATEGORY CHECK CONSTRAINT
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_detection_rules_category')
BEGIN
    ALTER TABLE leaklens.detection_rules DROP CONSTRAINT CK_detection_rules_category;
END
GO

ALTER TABLE leaklens.detection_rules
ADD CONSTRAINT CK_detection_rules_category CHECK (
    category IN (
        'EMAIL_ADDRESS',
        'API_KEY_CANDIDATE',
        'PRIVATE_KEY_MARKER',
        'SENSITIVE_IDENTIFIER',
        'CLOUD_CREDENTIAL',
        'PASSWORD_CREDENTIAL',
        'JWT_BEARER_TOKEN',
        'DATABASE_CONNECTION_STRING',
        'TELEPHONE_NUMBER',
        'PERSONAL_IDENTIFIER',
        'FINANCIAL_IDENTIFIER',
        'CONFIDENTIAL_CONFIG',
        'HIGH_ENTROPY_SECRET',
        'api_key',
        'credentials',
        'pii',
        'financial',
        'secret_key',
        'infrastructure',
        'custom'
    )
);
GO

-- 3. SEED ADVANCED DETECTION RULES (IF NOT ALREADY PRESENT)
MERGE leaklens.detection_rules AS target
USING (
    VALUES
    (CAST('22222222-2222-2222-2222-222222220001' AS UNIQUEIDENTIFIER), 'AWS_ACCESS_KEY_RULE', 'CLOUD_CREDENTIAL', 'Detects AWS IAM user access key identifiers (AKIA prefix).', 'critical', 1),
    (CAST('22222222-2222-2222-2222-222222220002' AS UNIQUEIDENTIFIER), 'GITHUB_PAT_RULE', 'CLOUD_CREDENTIAL', 'Detects GitHub fine-grained and classic personal access tokens.', 'critical', 1),
    (CAST('22222222-2222-2222-2222-222222220003' AS UNIQUEIDENTIFIER), 'SLACK_TOKEN_RULE', 'CLOUD_CREDENTIAL', 'Detects Slack workspace bot and user OAuth tokens.', 'high', 1),
    (CAST('22222222-2222-2222-2222-222222220004' AS UNIQUEIDENTIFIER), 'STRIPE_SECRET_KEY_RULE', 'CLOUD_CREDENTIAL', 'Detects Stripe production live secret keys (sk_live_, rk_live_).', 'critical', 1),
    (CAST('22222222-2222-2222-2222-222222220005' AS UNIQUEIDENTIFIER), 'AI_PROVIDER_KEY_RULE', 'CLOUD_CREDENTIAL', 'Detects OpenAI and HuggingFace candidate API keys.', 'high', 1),
    (CAST('22222222-2222-2222-2222-222222220006' AS UNIQUEIDENTIFIER), 'GCP_API_KEY_RULE', 'CLOUD_CREDENTIAL', 'Detects Google Cloud Platform API keys (AIza prefix).', 'high', 1),
    (CAST('33333333-3333-3333-3333-333333330001' AS UNIQUEIDENTIFIER), 'PASSWORD_ASSIGNMENT_RULE', 'PASSWORD_CREDENTIAL', 'Detects password variable assignments in code and configuration.', 'high', 1),
    (CAST('44444444-4444-4444-4444-444444440001' AS UNIQUEIDENTIFIER), 'JWT_TOKEN_RULE', 'JWT_BEARER_TOKEN', 'Detects serialized JSON Web Tokens (JWT).', 'high', 1),
    (CAST('44444444-4444-4444-4444-444444440002' AS UNIQUEIDENTIFIER), 'BEARER_HEADER_RULE', 'JWT_BEARER_TOKEN', 'Detects Authorization Bearer headers carrying authentication tokens.', 'high', 1),
    (CAST('55555555-5555-5555-5555-555555550001' AS UNIQUEIDENTIFIER), 'DATABASE_URL_RULE', 'DATABASE_CONNECTION_STRING', 'Detects database connection URLs with embedded credentials.', 'critical', 1),
    (CAST('55555555-5555-5555-5555-555555550002' AS UNIQUEIDENTIFIER), 'MSSQL_CONNECTION_STRING_RULE', 'DATABASE_CONNECTION_STRING', 'Detects ADO.NET SQL Server connection strings with passwords.', 'critical', 1),
    (CAST('66666666-6666-6666-6666-666666660001' AS UNIQUEIDENTIFIER), 'INDIAN_PHONE_RULE', 'TELEPHONE_NUMBER', 'Detects Indian 10-digit mobile numbers with optional +91 prefix.', 'low', 1),
    (CAST('77777777-7777-7777-7777-777777770001' AS UNIQUEIDENTIFIER), 'INDIAN_PAN_RULE', 'PERSONAL_IDENTIFIER', 'Detects Indian Permanent Account Number (PAN) tax identifiers.', 'high', 1),
    (CAST('77777777-7777-7777-7777-777777770002' AS UNIQUEIDENTIFIER), 'INDIAN_AADHAAR_RULE', 'PERSONAL_IDENTIFIER', 'Detects 12-digit Indian Aadhaar numbers validated via Verhoeff checksum.', 'critical', 1),
    (CAST('77777777-7777-7777-7777-777777770003' AS UNIQUEIDENTIFIER), 'INDIAN_IFSC_RULE', 'PERSONAL_IDENTIFIER', 'Detects Indian Financial System Codes (IFSC) for bank transfers.', 'low', 1),
    (CAST('77777777-7777-7777-7777-777777770004' AS UNIQUEIDENTIFIER), 'INDIAN_UPI_ID_RULE', 'PERSONAL_IDENTIFIER', 'Detects Unified Payments Interface (UPI) virtual payment addresses.', 'medium', 1),
    (CAST('88888888-8888-8888-8888-888888880001' AS UNIQUEIDENTIFIER), 'PAYMENT_CARD_RULE', 'FINANCIAL_IDENTIFIER', 'Detects credit/debit card numbers verified via Luhn mod-10 algorithm.', 'critical', 1),
    (CAST('99999999-9999-9999-9999-999999990001' AS UNIQUEIDENTIFIER), 'CONFIDENTIAL_CONFIG_RULE', 'CONFIDENTIAL_CONFIG', 'Detects sensitive environment variable configuration keys.', 'critical', 1),
    (CAST('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001' AS UNIQUEIDENTIFIER), 'HIGH_ENTROPY_SECRET_RULE', 'HIGH_ENTROPY_SECRET', 'Detects high-entropy random strings located near security keywords.', 'medium', 1)
) AS source (rule_id, rule_name, category, description, severity, is_enabled)
ON target.rule_name = source.rule_name
WHEN NOT MATCHED THEN
    INSERT (rule_id, rule_name, category, description, severity, is_enabled)
    VALUES (source.rule_id, source.rule_name, source.category, source.description, source.severity, source.is_enabled);
GO
