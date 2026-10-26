-- ==============================================================================
-- LeakLens — Relational Stored Procedures
-- Microsoft SQL Server / Azure SQL Database
-- Stored Procedure: sp_resolve_incident
-- Purpose: Atomically validates incident state transitions, marks an incident resolved,
-- records the remediation action, updates associated findings, and logs an immutable audit event.
-- ==============================================================================

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

    -- --------------------------------------------------------------------------
    -- 1. PARAMETER & PREREQUISITE VALIDATION
    -- --------------------------------------------------------------------------
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
        @current_version = ISNULL(version, 1)
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

    -- Prevent invalid transition if incident is already resolved or closed
    IF @current_status IN ('RESOLVED', 'CLOSED', 'resolved', 'closed')
    BEGIN
        DECLARE @err_msg NVARCHAR(256) = CONCAT('Cannot resolve incident: current status is already "', @current_status, '".');
        THROW 50003, @err_msg, 1;
        RETURN;
    END

    -- Validate non-empty notes
    IF @notes IS NULL OR LEN(LTRIM(RTRIM(@notes))) = 0
    BEGIN
        THROW 50006, 'Resolution summary notes are mandatory for resolving an incident.', 1;
        RETURN;
    END

    -- --------------------------------------------------------------------------
    -- 2. ATOMIC STATE TRANSITION & AUDIT LOGGING
    -- --------------------------------------------------------------------------
    DECLARE @now DATETIMEOFFSET = SYSUTCDATETIME();
    DECLARE @new_action_id UNIQUEIDENTIFIER = NEWID();

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Step A: Update Incident Status and Concurrency Version
        UPDATE leaklens.incidents
        SET 
            status = 'RESOLVED',
            resolved_at = @now,
            resolution_summary = @notes,
            version = @current_version + 1,
            updated_at = @now
        WHERE incident_id = @incident_id;

        -- Step B: Insert Remediation Action
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

        -- Step C: Transition all linked findings to 'remediated'
        UPDATE f
        SET f.status = 'remediated'
        FROM leaklens.findings f
        INNER JOIN leaklens.incident_findings inf 
            ON f.finding_id = inf.finding_id
        WHERE inf.incident_id = @incident_id
          AND f.status <> 'remediated';

        -- Step D: Record Immutable Audit Event
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

        -- Return execution confirmation
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

        -- Re-throw original caught error
        THROW;
    END CATCH
END
GO
