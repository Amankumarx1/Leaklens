-- ==============================================================================
-- Migration 003: Phase 3 Incident Response, Remediation & Concurrency Support
-- Target: Microsoft SQL Server 2022+ / Azure SQL Database
-- Idempotent: Can be rerun safely without data corruption
-- ==============================================================================

SET NOCOUNT ON;
GO

-- 1. Extend leaklens.incidents with closed_at, resolution_summary, and version
IF OBJECT_ID('leaklens.incidents', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('leaklens.incidents') AND name = 'closed_at')
    BEGIN
        ALTER TABLE leaklens.incidents ADD closed_at DATETIMEOFFSET NULL;
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('leaklens.incidents') AND name = 'resolution_summary')
    BEGIN
        ALTER TABLE leaklens.incidents ADD resolution_summary NVARCHAR(1024) NULL;
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('leaklens.incidents') AND name = 'version')
    BEGIN
        ALTER TABLE leaklens.incidents ADD version INT NOT NULL CONSTRAINT DF_incidents_version DEFAULT 1;
    END
END
GO

-- 2. Update CK_incidents_status check constraint to support Phase 3 statuses
IF OBJECT_ID('leaklens.incidents', 'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_incidents_status' AND parent_object_id = OBJECT_ID('leaklens.incidents'))
    BEGIN
        ALTER TABLE leaklens.incidents DROP CONSTRAINT CK_incidents_status;
    END

    ALTER TABLE leaklens.incidents ADD CONSTRAINT CK_incidents_status CHECK (
        status IN (
            'OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'RESOLVED', 'CLOSED',
            'open', 'under_investigation', 'contained', 'resolved', 'closed'
        )
    );
END
GO

-- 3. Update CK_incidents_priority check constraint to support Phase 3 priorities
IF OBJECT_ID('leaklens.incidents', 'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_incidents_priority' AND parent_object_id = OBJECT_ID('leaklens.incidents'))
    BEGIN
        ALTER TABLE leaklens.incidents DROP CONSTRAINT CK_incidents_priority;
    END

    ALTER TABLE leaklens.incidents ADD CONSTRAINT CK_incidents_priority CHECK (
        priority IN (
            'CRITICAL', 'HIGH', 'MEDIUM', 'LOW',
            'critical', 'high', 'medium', 'low'
        )
    );
END
GO

-- 4. Update CK_remediation_actions_action_type check constraint
IF OBJECT_ID('leaklens.remediation_actions', 'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_remediation_actions_action_type' AND parent_object_id = OBJECT_ID('leaklens.remediation_actions'))
    BEGIN
        ALTER TABLE leaklens.remediation_actions DROP CONSTRAINT CK_remediation_actions_action_type;
    END

    ALTER TABLE leaklens.remediation_actions ADD CONSTRAINT CK_remediation_actions_action_type CHECK (
        action_type IN (
            'INVESTIGATION', 'ASSIGNMENT', 'STATUS_CHANGE', 'REMEDIATION', 
            'VERIFICATION', 'COMMENT', 'RESOLUTION', 'REOPENED',
            'secret_revocation', 'key_rotation', 'access_revocation', 
            'file_quarantine', 'false_positive_acknowledgement', 
            'policy_update', 'custom'
        )
    );
END
GO

-- 5. Stored Procedure: leaklens.sp_resolve_incident
IF OBJECT_ID('leaklens.sp_resolve_incident', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE leaklens.sp_resolve_incident;
END
GO

CREATE PROCEDURE leaklens.sp_resolve_incident
    @incident_id UNIQUEIDENTIFIER,
    @user_id UNIQUEIDENTIFIER,
    @action_type NVARCHAR(64) = 'RESOLUTION',
    @notes NVARCHAR(1024),
    @verification_outcome NVARCHAR(32) = 'PASSED',
    @expected_version INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Verify user exists and is active
    IF NOT EXISTS (SELECT 1 FROM leaklens.users WHERE user_id = @user_id AND is_active = 1)
    BEGIN
        THROW 50001, 'Invalid user_id or user account is currently deactivated.', 1;
        RETURN;
    END

    -- Retrieve and lock the target incident record
    DECLARE @current_status NVARCHAR(32);
    DECLARE @current_version INT;

    SELECT 
        @current_status = status,
        @current_version = version
    FROM leaklens.incidents WITH (UPDLOCK, ROWLOCK)
    WHERE incident_id = @incident_id;

    IF @current_status IS NULL
    BEGIN
        THROW 50002, 'Incident does not exist.', 1;
        RETURN;
    END

    -- Concurrency check: verify version matches if supplied
    IF @expected_version IS NOT NULL AND @expected_version <> @current_version
    BEGIN
        THROW 50005, 'Concurrency conflict: incident was modified by another user.', 1;
        RETURN;
    END

    -- Verify current status permits resolution
    IF @current_status NOT IN ('IN_PROGRESS', 'PENDING_VERIFICATION', 'under_investigation', 'contained')
    BEGIN
        DECLARE @err_msg NVARCHAR(256) = CONCAT('Cannot resolve incident in status: ', @current_status);
        THROW 50003, @err_msg, 1;
        RETURN;
    END

    -- Verify non-empty resolution summary
    IF @notes IS NULL OR LEN(LTRIM(RTRIM(@notes))) = 0
    BEGIN
        THROW 50006, 'Resolution summary notes are mandatory for resolving an incident.', 1;
        RETURN;
    END

    DECLARE @now DATETIMEOFFSET = SYSUTCDATETIME();
    DECLARE @new_action_id UNIQUEIDENTIFIER = NEWID();

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Step 1: Update Incident record
        UPDATE leaklens.incidents
        SET 
            status = 'RESOLVED',
            resolved_at = @now,
            resolution_summary = @notes,
            version = @current_version + 1,
            updated_at = @now
        WHERE incident_id = @incident_id;

        -- Step 2: Insert remediation action
        INSERT INTO leaklens.remediation_actions (
            action_id,
            incident_id,
            user_id,
            action_type,
            notes,
            created_at
        ) VALUES (
            @new_action_id,
            @incident_id,
            @user_id,
            @action_type,
            @notes,
            @now
        );

        -- Step 3: Transition associated findings to 'remediated'
        UPDATE f
        SET f.status = 'remediated'
        FROM leaklens.findings f
        INNER JOIN leaklens.incident_findings inf 
            ON f.finding_id = inf.finding_id
        WHERE inf.incident_id = @incident_id;

        -- Step 4: Record audit trail
        DECLARE @audit_meta NVARCHAR(MAX) = (
            SELECT 
                CAST(@incident_id AS NVARCHAR(64)) AS incident_id,
                @action_type AS action_type,
                @current_status AS previous_status,
                'RESOLVED' AS new_status,
                @verification_outcome AS verification_outcome,
                @now AS resolved_timestamp
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );

        INSERT INTO leaklens.audit_logs (
            audit_id,
            user_id,
            event_type,
            entity_type,
            entity_id,
            metadata_json,
            created_at
        ) VALUES (
            NEWID(),
            @user_id,
            'INCIDENT_RESOLVED',
            'incident',
            CAST(@incident_id AS NVARCHAR(64)),
            @audit_meta,
            @now
        );

        COMMIT TRANSACTION;

        -- Return output row
        SELECT 
            @incident_id AS incident_id,
            'RESOLVED' AS status,
            @new_action_id AS remediation_action_id,
            @current_version + 1 AS version,
            @now AS resolved_at;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
        BEGIN
            ROLLBACK TRANSACTION;
        END
        THROW;
    END CATCH
END
GO
