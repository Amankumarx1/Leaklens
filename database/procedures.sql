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
    @action_type NVARCHAR(64),
    @notes NVARCHAR(1024)
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

    -- Verify incident exists
    DECLARE @current_status NVARCHAR(32);
    SELECT @current_status = status 
    FROM leaklens.incidents 
    WHERE incident_id = @incident_id;

    IF @current_status IS NULL
    BEGIN
        THROW 50002, 'Incident does not exist.', 1;
        RETURN;
    END

    -- Prevent invalid transition if incident is already resolved or closed
    IF @current_status IN ('resolved', 'closed')
    BEGIN
        DECLARE @err_msg NVARCHAR(256) = CONCAT('Cannot resolve incident: current status is already "', @current_status, '".');
        THROW 50003, @err_msg, 1;
        RETURN;
    END

    -- Validate action type enum
    IF @action_type NOT IN (
        'secret_revocation',
        'key_rotation',
        'access_revocation',
        'file_quarantine',
        'false_positive_acknowledgement',
        'policy_update',
        'custom'
    )
    BEGIN
        THROW 50004, 'Invalid action_type provided for remediation.', 1;
        RETURN;
    END

    -- --------------------------------------------------------------------------
    -- 2. ATOMIC STATE TRANSITION & AUDIT LOGGING
    -- --------------------------------------------------------------------------
    DECLARE @now DATETIMEOFFSET = SYSUTCDATETIME();
    DECLARE @new_action_id UNIQUEIDENTIFIER = NEWID();

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Step A: Update Incident Status
        UPDATE leaklens.incidents
        SET 
            status = 'resolved',
            resolved_at = @now,
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
                'resolved' AS previous_status_to_resolved,
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
            'incident_resolved',
            'incident',
            CAST(@incident_id AS NVARCHAR(64)),
            @audit_meta,
            @now
        );

        COMMIT TRANSACTION;

        -- Return execution confirmation
        SELECT 
            @incident_id AS incident_id,
            'resolved' AS status,
            @new_action_id AS remediation_action_id,
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
