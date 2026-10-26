-- ==============================================================================
-- LeakLens — Authorized Data Exposure Detection & Response
-- Relational Database DDL Schema (Microsoft SQL Server / Azure SQL Database)
-- Standard: Third Normal Form (3NF), UTC Timestamps, Explicit Constraints & Indexes
-- ==============================================================================

-- Create schema if not exists
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'leaklens')
BEGIN
    EXEC('CREATE SCHEMA leaklens');
END
GO

-- Set default search path / table creation in leaklens schema
-- ------------------------------------------------------------------------------
-- 1. USERS TABLE
-- Stores authenticated identities, role definitions, and access states.
-- Plaintext passwords are NEVER stored; only salted cryptographic hashes.
-- ------------------------------------------------------------------------------
IF OBJECT_ID('leaklens.users', 'U') IS NULL
BEGIN
    CREATE TABLE leaklens.users (
        user_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_users_user_id DEFAULT NEWSEQUENTIALID(),
        display_name NVARCHAR(100) NOT NULL,
        email NVARCHAR(256) NOT NULL,
        password_hash NVARCHAR(256) NOT NULL,
        role NVARCHAR(32) NOT NULL,
        is_active BIT NOT NULL CONSTRAINT DF_users_is_active DEFAULT 1,
        created_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_users_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_users PRIMARY KEY CLUSTERED (user_id),
        CONSTRAINT UQ_users_email UNIQUE NONCLUSTERED (email),
        CONSTRAINT CK_users_role CHECK (role IN ('ADMIN', 'ANALYST', 'COMPLIANCE_REVIEWER', 'admin', 'security_analyst', 'auditor', 'viewer')),
        CONSTRAINT CK_users_email_format CHECK (email LIKE '%_@__%.__%')
    );
END
GO

-- ------------------------------------------------------------------------------
-- 2. SCAN_JOBS TABLE
-- Tracks asynchronous file inspection jobs, lifecycle states, and timing metrics.
-- ------------------------------------------------------------------------------
IF OBJECT_ID('leaklens.scan_jobs', 'U') IS NULL
BEGIN
    CREATE TABLE leaklens.scan_jobs (
        scan_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_scan_jobs_scan_id DEFAULT NEWSEQUENTIALID(),
        created_by UNIQUEIDENTIFIER NOT NULL,
        status NVARCHAR(32) NOT NULL,
        started_at DATETIMEOFFSET NULL,
        completed_at DATETIMEOFFSET NULL,
        error_code NVARCHAR(64) NULL,
        created_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_scan_jobs_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_scan_jobs PRIMARY KEY CLUSTERED (scan_id),
        CONSTRAINT FK_scan_jobs_users FOREIGN KEY (created_by) 
            REFERENCES leaklens.users (user_id) ON DELETE NO ACTION,
        CONSTRAINT CK_scan_jobs_status CHECK (status IN ('pending', 'queued', 'in_progress', 'completed', 'failed', 'cancelled')),
        CONSTRAINT CK_scan_jobs_timing CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
    );
END
GO

-- ------------------------------------------------------------------------------
-- 3. FILES TABLE
-- Stores metadata, cryptographic hashes, and storage references for inspected files.
-- Raw file contents are NEVER persisted in this relational schema.
-- ------------------------------------------------------------------------------
IF OBJECT_ID('leaklens.files', 'U') IS NULL
BEGIN
    CREATE TABLE leaklens.files (
        file_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_files_file_id DEFAULT NEWSEQUENTIALID(),
        scan_id UNIQUEIDENTIFIER NOT NULL,
        original_filename NVARCHAR(260) NOT NULL,
        blob_path NVARCHAR(1024) NULL,
        content_hash CHAR(64) NOT NULL, -- SHA-256 hexadecimal digest
        file_size_bytes BIGINT NOT NULL,
        mime_type NVARCHAR(128) NOT NULL,
        created_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_files_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_files PRIMARY KEY CLUSTERED (file_id),
        CONSTRAINT FK_files_scan_jobs FOREIGN KEY (scan_id) 
            REFERENCES leaklens.scan_jobs (scan_id) ON DELETE CASCADE,
        CONSTRAINT CK_files_file_size CHECK (file_size_bytes >= 0),
        CONSTRAINT CK_files_content_hash_len CHECK (LEN(content_hash) = 64)
    );
END
GO

-- ------------------------------------------------------------------------------
-- 4. DETECTION_RULES TABLE
-- Defines pattern signatures, categorizations, and severity classifications.
-- ------------------------------------------------------------------------------
IF OBJECT_ID('leaklens.detection_rules', 'U') IS NULL
BEGIN
    CREATE TABLE leaklens.detection_rules (
        rule_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_detection_rules_rule_id DEFAULT NEWSEQUENTIALID(),
        rule_name NVARCHAR(128) NOT NULL,
        category NVARCHAR(64) NOT NULL,
        description NVARCHAR(512) NOT NULL,
        severity NVARCHAR(16) NOT NULL,
        is_enabled BIT NOT NULL CONSTRAINT DF_detection_rules_is_enabled DEFAULT 1,
        created_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_detection_rules_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_detection_rules_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_detection_rules PRIMARY KEY CLUSTERED (rule_id),
        CONSTRAINT UQ_detection_rules_rule_name UNIQUE NONCLUSTERED (rule_name),
        CONSTRAINT CK_detection_rules_severity CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
        CONSTRAINT CK_detection_rules_category CHECK (category IN (
            'EMAIL_ADDRESS', 'API_KEY_CANDIDATE', 'PRIVATE_KEY_MARKER', 'SENSITIVE_IDENTIFIER',
            'CLOUD_CREDENTIAL', 'PASSWORD_CREDENTIAL', 'JWT_BEARER_TOKEN', 'DATABASE_CONNECTION_STRING',
            'TELEPHONE_NUMBER', 'PERSONAL_IDENTIFIER', 'FINANCIAL_IDENTIFIER', 'CONFIDENTIAL_CONFIG', 'HIGH_ENTROPY_SECRET',
            'api_key', 'credentials', 'pii', 'financial', 'secret_key', 'infrastructure', 'custom'
        ))
    );
END
GO

-- ------------------------------------------------------------------------------
-- 5. FINDINGS TABLE
-- Records detected exposure instances with strictly masked excerpts.
-- Raw API keys, passwords, and tokens are NEVER stored in plaintext.
-- ------------------------------------------------------------------------------
IF OBJECT_ID('leaklens.findings', 'U') IS NULL
BEGIN
    CREATE TABLE leaklens.findings (
        finding_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_findings_finding_id DEFAULT NEWSEQUENTIALID(),
        file_id UNIQUEIDENTIFIER NOT NULL,
        rule_id UNIQUEIDENTIFIER NOT NULL,
        location_reference NVARCHAR(256) NOT NULL,
        field_path NVARCHAR(256) NULL,
        masked_excerpt NVARCHAR(512) NOT NULL,
        secret_fingerprint CHAR(64) NULL,
        severity NVARCHAR(16) NOT NULL,
        confidence NVARCHAR(16) NOT NULL CONSTRAINT DF_findings_confidence DEFAULT 'high',
        status NVARCHAR(32) NOT NULL,
        detected_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_findings_detected_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_findings PRIMARY KEY CLUSTERED (finding_id),
        CONSTRAINT FK_findings_files FOREIGN KEY (file_id) 
            REFERENCES leaklens.files (file_id) ON DELETE CASCADE,
        CONSTRAINT FK_findings_detection_rules FOREIGN KEY (rule_id) 
            REFERENCES leaklens.detection_rules (rule_id) ON DELETE NO ACTION,
        CONSTRAINT CK_findings_severity CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
        CONSTRAINT CK_findings_confidence CHECK (confidence IN ('high', 'medium', 'low')),
        CONSTRAINT CK_findings_status CHECK (status IN ('detected', 'confirmed', 'false_positive', 'suppressed', 'remediated'))
    );
END
GO

-- ------------------------------------------------------------------------------
-- 6. INCIDENTS TABLE
-- Manages security triage, containment, and analyst assignment.
-- ------------------------------------------------------------------------------
IF OBJECT_ID('leaklens.incidents', 'U') IS NULL
BEGIN
    CREATE TABLE leaklens.incidents (
        incident_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_incidents_incident_id DEFAULT NEWSEQUENTIALID(),
        title NVARCHAR(256) NOT NULL,
        description NVARCHAR(1024) NOT NULL,
        status NVARCHAR(32) NOT NULL,
        priority NVARCHAR(16) NOT NULL,
        assigned_to UNIQUEIDENTIFIER NULL,
        created_by UNIQUEIDENTIFIER NOT NULL,
        version INT NOT NULL CONSTRAINT DF_incidents_version DEFAULT 1,
        created_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_incidents_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_incidents_updated_at DEFAULT SYSUTCDATETIME(),
        resolved_at DATETIMEOFFSET NULL,
        closed_at DATETIMEOFFSET NULL,
        resolution_summary NVARCHAR(1024) NULL,
        CONSTRAINT PK_incidents PRIMARY KEY CLUSTERED (incident_id),
        CONSTRAINT FK_incidents_assigned_user FOREIGN KEY (assigned_to) 
            REFERENCES leaklens.users (user_id) ON DELETE SET NULL,
        CONSTRAINT FK_incidents_created_user FOREIGN KEY (created_by) 
            REFERENCES leaklens.users (user_id) ON DELETE NO ACTION,
        CONSTRAINT CK_incidents_status CHECK (status IN ('OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'RESOLVED', 'CLOSED', 'open', 'under_investigation', 'contained', 'resolved', 'closed')),
        CONSTRAINT CK_incidents_priority CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'critical', 'high', 'medium', 'low')),
        CONSTRAINT CK_incidents_resolution CHECK (resolved_at IS NULL OR status IN ('RESOLVED', 'CLOSED', 'resolved', 'closed'))
    );
END
GO

-- ------------------------------------------------------------------------------
-- 7. INCIDENT_FINDINGS JUNCTION TABLE
-- Models the many-to-many relationship between security incidents and findings.
-- Eliminates repeating groups and satisfies Third Normal Form (3NF).
-- ------------------------------------------------------------------------------
IF OBJECT_ID('leaklens.incident_findings', 'U') IS NULL
BEGIN
    CREATE TABLE leaklens.incident_findings (
        incident_id UNIQUEIDENTIFIER NOT NULL,
        finding_id UNIQUEIDENTIFIER NOT NULL,
        linked_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_incident_findings_linked_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_incident_findings PRIMARY KEY CLUSTERED (incident_id, finding_id),
        CONSTRAINT FK_incident_findings_incidents FOREIGN KEY (incident_id) 
            REFERENCES leaklens.incidents (incident_id) ON DELETE CASCADE,
        CONSTRAINT FK_incident_findings_findings FOREIGN KEY (finding_id) 
            REFERENCES leaklens.findings (finding_id) ON DELETE NO ACTION
    );
END
GO

-- ------------------------------------------------------------------------------
-- 8. REMEDIATION_ACTIONS TABLE
-- Records defensive containment, key rotation, and revocation actions taken.
-- ------------------------------------------------------------------------------
IF OBJECT_ID('leaklens.remediation_actions', 'U') IS NULL
BEGIN
    CREATE TABLE leaklens.remediation_actions (
        action_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_remediation_actions_action_id DEFAULT NEWSEQUENTIALID(),
        incident_id UNIQUEIDENTIFIER NOT NULL,
        user_id UNIQUEIDENTIFIER NOT NULL,
        action_type NVARCHAR(64) NOT NULL,
        notes NVARCHAR(1024) NOT NULL,
        created_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_remediation_actions_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_remediation_actions PRIMARY KEY CLUSTERED (action_id),
        CONSTRAINT FK_remediation_actions_incidents FOREIGN KEY (incident_id) 
            REFERENCES leaklens.incidents (incident_id) ON DELETE CASCADE,
        CONSTRAINT FK_remediation_actions_users FOREIGN KEY (user_id) 
            REFERENCES leaklens.users (user_id) ON DELETE NO ACTION,
        CONSTRAINT CK_remediation_actions_action_type CHECK (action_type IN (
            'INVESTIGATION',
            'ASSIGNMENT',
            'STATUS_CHANGE',
            'REMEDIATION',
            'VERIFICATION',
            'COMMENT',
            'RESOLUTION',
            'REOPENED',
            'secret_revocation',
            'key_rotation',
            'access_revocation',
            'file_quarantine',
            'false_positive_acknowledgement',
            'policy_update',
            'custom'
        ))
    );
END
GO

-- ------------------------------------------------------------------------------
-- 9. AUDIT_LOGS TABLE
-- Maintains an immutable trail of system actions, scans, and administrative events.
-- ------------------------------------------------------------------------------
IF OBJECT_ID('leaklens.audit_logs', 'U') IS NULL
BEGIN
    CREATE TABLE leaklens.audit_logs (
        audit_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_audit_logs_audit_id DEFAULT NEWSEQUENTIALID(),
        user_id UNIQUEIDENTIFIER NULL,
        event_type NVARCHAR(64) NOT NULL,
        entity_type NVARCHAR(64) NOT NULL,
        entity_id NVARCHAR(64) NOT NULL,
        metadata_json NVARCHAR(MAX) NULL,
        created_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_audit_logs_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_audit_logs PRIMARY KEY CLUSTERED (audit_id),
        CONSTRAINT FK_audit_logs_users FOREIGN KEY (user_id) 
            REFERENCES leaklens.users (user_id) ON DELETE SET NULL,
        CONSTRAINT CK_audit_logs_metadata_isjson CHECK (metadata_json IS NULL OR ISJSON(metadata_json) = 1)
    );
END
GO

-- ==============================================================================
-- INDEXES FOR QUERY OPTIMIZATION & WORKLOAD PERFORMANCE
-- ==============================================================================

-- Index scan jobs by status and creation time
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_scan_jobs_status_created' AND object_id = OBJECT_ID('leaklens.scan_jobs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_scan_jobs_status_created
    ON leaklens.scan_jobs (status, created_at DESC)
    INCLUDE (created_by, started_at, completed_at);
END
GO

-- Index files by scan job foreign key
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_files_scan_id' AND object_id = OBJECT_ID('leaklens.files'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_files_scan_id
    ON leaklens.files (scan_id)
    INCLUDE (content_hash, file_size_bytes);
END
GO

-- Index files by content hash for rapid deduplication
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_files_content_hash' AND object_id = OBJECT_ID('leaklens.files'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_files_content_hash
    ON leaklens.files (content_hash);
END
GO

-- Index findings by file, rule, severity, and status for triage dashboards
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_findings_file_id' AND object_id = OBJECT_ID('leaklens.findings'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_findings_file_id
    ON leaklens.findings (file_id);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_findings_rule_id' AND object_id = OBJECT_ID('leaklens.findings'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_findings_rule_id
    ON leaklens.findings (rule_id);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_findings_severity_status' AND object_id = OBJECT_ID('leaklens.findings'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_findings_severity_status
    ON leaklens.findings (severity, status, detected_at DESC)
    INCLUDE (location_reference, masked_excerpt);
END
GO

-- Index incidents by status, priority, and analyst assignment
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_incidents_status_priority' AND object_id = OBJECT_ID('leaklens.incidents'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_incidents_status_priority
    ON leaklens.incidents (status, priority, created_at DESC)
    INCLUDE (assigned_to, created_by, title);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_incidents_assigned_to' AND object_id = OBJECT_ID('leaklens.incidents'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_incidents_assigned_to
    ON leaklens.incidents (assigned_to)
    WHERE assigned_to IS NOT NULL;
END
GO

-- Index incident_findings reverse lookup
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_incident_findings_finding_id' AND object_id = OBJECT_ID('leaklens.incident_findings'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_incident_findings_finding_id
    ON leaklens.incident_findings (finding_id);
END
GO

-- Index remediation actions by incident
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_remediation_actions_incident_id' AND object_id = OBJECT_ID('leaklens.remediation_actions'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_remediation_actions_incident_id
    ON leaklens.remediation_actions (incident_id, created_at DESC)
    INCLUDE (action_type, user_id);
END
GO

-- Index audit logs by event, entity, and timestamp for forensics
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_audit_logs_event_entity' AND object_id = OBJECT_ID('leaklens.audit_logs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_audit_logs_event_entity
    ON leaklens.audit_logs (event_type, entity_type, created_at DESC);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_audit_logs_user_id' AND object_id = OBJECT_ID('leaklens.audit_logs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_audit_logs_user_id
    ON leaklens.audit_logs (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;
END
GO
