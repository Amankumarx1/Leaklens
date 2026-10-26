-- ==============================================================================
-- Migration 002: Master Prompt 2 — RBAC Roles & Detection Rules Alignment
-- Database: Microsoft SQL Server / Azure SQL Database
-- Purpose: Aligns user roles with ('ADMIN', 'ANALYST', 'COMPLIANCE_REVIEWER')
--          and seeds detection rules for email, API keys, private keys, and identifiers.
-- ==============================================================================

-- 1. Update CK_users_role to include Phase 2 canonical roles
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_users_role' AND parent_object_id = OBJECT_ID('leaklens.users'))
BEGIN
    ALTER TABLE leaklens.users DROP CONSTRAINT CK_users_role;
END
GO

ALTER TABLE leaklens.users ADD CONSTRAINT CK_users_role 
CHECK (role IN ('ADMIN', 'ANALYST', 'COMPLIANCE_REVIEWER', 'admin', 'security_analyst', 'auditor', 'viewer'));
GO

-- 2. Update CK_detection_rules_category to include Phase 2 categories
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_detection_rules_category' AND parent_object_id = OBJECT_ID('leaklens.detection_rules'))
BEGIN
    ALTER TABLE leaklens.detection_rules DROP CONSTRAINT CK_detection_rules_category;
END
GO

ALTER TABLE leaklens.detection_rules ADD CONSTRAINT CK_detection_rules_category 
CHECK (category IN (
    'EMAIL_ADDRESS', 
    'API_KEY_CANDIDATE', 
    'PRIVATE_KEY_MARKER', 
    'SENSITIVE_IDENTIFIER',
    'api_key', 
    'credentials', 
    'pii', 
    'financial', 
    'secret_key', 
    'infrastructure', 
    'custom'
));
GO

-- 3. Seed Canonical Detection Rules (Idempotent INSERT)
IF NOT EXISTS (SELECT 1 FROM leaklens.detection_rules WHERE rule_name = 'EMAIL_ADDRESS_RULE')
BEGIN
    INSERT INTO leaklens.detection_rules (
        rule_id, 
        rule_name, 
        category, 
        description, 
        severity, 
        is_enabled
    ) VALUES (
        '11111111-1111-1111-1111-111111110001',
        'EMAIL_ADDRESS_RULE',
        'EMAIL_ADDRESS',
        'Detects RFC-compliant email address patterns in plain text, CSV, and JSON content.',
        'low',
        1
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM leaklens.detection_rules WHERE rule_name = 'API_KEY_CANDIDATE_RULE')
BEGIN
    INSERT INTO leaklens.detection_rules (
        rule_id, 
        rule_name, 
        category, 
        description, 
        severity, 
        is_enabled
    ) VALUES (
        '11111111-1111-1111-1111-111111110002',
        'API_KEY_CANDIDATE_RULE',
        'API_KEY_CANDIDATE',
        'Detects candidate demonstration API keys and credential strings matching prefix patterns (e.g. key_live_, key_test_, sk_demo_).',
        'high',
        1
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM leaklens.detection_rules WHERE rule_name = 'PRIVATE_KEY_MARKER_RULE')
BEGIN
    INSERT INTO leaklens.detection_rules (
        rule_id, 
        rule_name, 
        category, 
        description, 
        severity, 
        is_enabled
    ) VALUES (
        '11111111-1111-1111-1111-111111110003',
        'PRIVATE_KEY_MARKER_RULE',
        'PRIVATE_KEY_MARKER',
        'Detects cryptographic private key PEM header markers (e.g. standard PEM private key headers). Never persists the private key body.',
        'critical',
        1
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM leaklens.detection_rules WHERE rule_name = 'SENSITIVE_IDENTIFIER_RULE')
BEGIN
    INSERT INTO leaklens.detection_rules (
        rule_id, 
        rule_name, 
        category, 
        description, 
        severity, 
        is_enabled
    ) VALUES (
        '11111111-1111-1111-1111-111111110004',
        'SENSITIVE_IDENTIFIER_RULE',
        'SENSITIVE_IDENTIFIER',
        'Detects structured internal sensitive identifiers matching pattern LL-ID-[A-Z0-9]{4}-[A-Z0-9]{4}.',
        'medium',
        1
    );
END
GO
