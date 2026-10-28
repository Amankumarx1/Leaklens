import crypto from 'crypto';
import { executeQuery, checkDatabaseHealth } from '../database/connection.js';
import memoryStore from './memoryStore.js';
import cacheService from '../services/cache/cacheService.js';

/**
 * Incident Repository
 * Manages SQL Server persistence and in-memory fallback for Incidents,
 * Finding associations, Remediation Actions, and Resolution transactions.
 */

export async function createIncident({
  title,
  description,
  priority = 'MEDIUM',
  findingIds = [],
  createdBy,
  correlationId = null
}) {
  const incidentId = crypto.randomUUID();
  const normalizedPriority = priority.toUpperCase();
  const now = new Date().toISOString();

  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    // Explicit parameterized transaction across incidents, junction, actions, and audit
    const query = `
      BEGIN TRANSACTION;
      BEGIN TRY
        -- 1. Insert Incident
        INSERT INTO leaklens.incidents (
          incident_id, title, description, status, priority, created_by, version, created_at, updated_at
        ) VALUES (
          @incidentId, @title, @description, 'OPEN', @priority, @createdBy, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
        );

        -- 2. Insert Remediation Action (Incident Creation)
        INSERT INTO leaklens.remediation_actions (
          action_id, incident_id, user_id, action_type, notes, created_at
        ) VALUES (
          NEWID(), @incidentId, @createdBy, 'STATUS_CHANGE', 'Incident created with findings associated', SYSUTCDATETIME()
        );

        -- 3. Insert Audit Log
        INSERT INTO leaklens.audit_logs (
          audit_id, user_id, event_type, entity_type, entity_id, metadata_json, created_at
        ) VALUES (
          NEWID(), @createdBy, 'INCIDENT_CREATED', 'incident', CAST(@incidentId AS NVARCHAR(64)),
          JSON_OBJECT('title': @title, 'priority': @priority, 'initial_findings_count': @findingsCount),
          SYSUTCDATETIME()
        );

        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
      END CATCH
    `;

    await executeQuery(query, {
      incidentId,
      title,
      description,
      priority: normalizedPriority,
      createdBy,
      findingsCount: findingIds.length
    });

    // Associate findings in transaction
    if (findingIds.length > 0) {
      for (const fId of findingIds) {
        await executeQuery(
          `BEGIN TRANSACTION;
           BEGIN TRY
             IF NOT EXISTS (SELECT 1 FROM leaklens.incident_findings WHERE incident_id = @incidentId AND finding_id = @findingId)
             BEGIN
               INSERT INTO leaklens.incident_findings (incident_id, finding_id, linked_at)
               VALUES (@incidentId, @findingId, SYSUTCDATETIME());

               UPDATE leaklens.findings 
               SET status = 'confirmed' 
               WHERE finding_id = @findingId;

               INSERT INTO leaklens.audit_logs (audit_id, user_id, event_type, entity_type, entity_id, metadata_json, created_at)
               VALUES (NEWID(), @createdBy, 'FINDING_ASSOCIATED', 'finding', CAST(@findingId AS NVARCHAR(64)),
                 JSON_OBJECT('incident_id': CAST(@incidentId AS NVARCHAR(64))), SYSUTCDATETIME());
             END
             COMMIT TRANSACTION;
           END TRY
           BEGIN CATCH
             IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
             THROW;
           END CATCH`,
          { incidentId, findingId: fId, createdBy }
        );
      }
    }

    cacheService.invalidatePattern('analytics:');
    return getIncidentById(incidentId);
  }

  // In-memory fallback
  const newIncident = {
    incident_id: incidentId,
    title,
    description,
    status: 'OPEN',
    priority: normalizedPriority,
    assigned_to: null,
    created_by: createdBy,
    version: 1,
    created_at: now,
    updated_at: now,
    resolved_at: null,
    closed_at: null,
    resolution_summary: null
  };

  memoryStore.incidents.push(newIncident);

  for (const fId of findingIds) {
    const finding = memoryStore.findings.find(f => f.finding_id === fId);
    if (finding) {
      finding.status = 'confirmed';
      memoryStore.incident_findings.push({
        incident_id: incidentId,
        finding_id: fId,
        linked_at: now
      });
      memoryStore.audit_logs.push({
        audit_id: crypto.randomUUID(),
        user_id: createdBy,
        event_type: 'FINDING_ASSOCIATED',
        entity_type: 'finding',
        entity_id: fId,
        metadata_json: JSON.stringify({ incident_id: incidentId }),
        created_at: now
      });
    }
  }

  // Initial creation action & audit log
  memoryStore.remediation_actions.push({
    action_id: crypto.randomUUID(),
    incident_id: incidentId,
    user_id: createdBy,
    action_type: 'STATUS_CHANGE',
    notes: 'Incident created with findings associated',
    created_at: now
  });

  memoryStore.audit_logs.push({
    audit_id: crypto.randomUUID(),
    user_id: createdBy,
    event_type: 'INCIDENT_CREATED',
    entity_type: 'incident',
    entity_id: incidentId,
    metadata_json: JSON.stringify({ title, priority: normalizedPriority, initial_findings_count: findingIds.length }),
    created_at: now
  });

  cacheService.invalidatePattern('analytics:');
  return getIncidentById(incidentId);
}

export async function listIncidents({
  status,
  priority,
  assignedTo,
  limit = 50,
  offset = 0
} = {}) {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const whereClauses = [];
    const params = { limit, offset };

    if (status) {
      whereClauses.push('inc.status = @status');
      params.status = status;
    }
    if (priority) {
      whereClauses.push('inc.priority = @priority');
      params.priority = priority.toUpperCase();
    }
    if (assignedTo) {
      whereClauses.push('inc.assigned_to = @assignedTo');
      params.assignedTo = assignedTo;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT 
        inc.incident_id,
        inc.title,
        inc.description,
        inc.status,
        inc.priority,
        inc.assigned_to,
        inc.created_by,
        inc.version,
        inc.created_at,
        inc.updated_at,
        inc.resolved_at,
        inc.closed_at,
        inc.resolution_summary,
        u_assign.display_name AS assigned_user_name,
        u_assign.email AS assigned_user_email,
        u_create.display_name AS created_user_name,
        COUNT(inf.finding_id) AS total_findings
      FROM leaklens.incidents inc
      LEFT JOIN leaklens.users u_assign ON inc.assigned_to = u_assign.user_id
      LEFT JOIN leaklens.users u_create ON inc.created_by = u_create.user_id
      LEFT JOIN leaklens.incident_findings inf ON inc.incident_id = inf.incident_id
      ${whereSql}
      GROUP BY 
        inc.incident_id, inc.title, inc.description, inc.status, inc.priority,
        inc.assigned_to, inc.created_by, inc.version, inc.created_at, inc.updated_at,
        inc.resolved_at, inc.closed_at, inc.resolution_summary,
        u_assign.display_name, u_assign.email, u_create.display_name
      ORDER BY 
        CASE inc.priority
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
          ELSE 5
        END ASC,
        inc.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM leaklens.incidents inc
      ${whereSql}
    `;

    const [itemsResult, countResult] = await Promise.all([
      executeQuery(query, params),
      executeQuery(countQuery, params)
    ]);

    return {
      incidents: itemsResult.recordset || [],
      total: countResult.recordset?.[0]?.total || 0,
      limit,
      offset
    };
  }

  // Memory fallback
  let filtered = memoryStore.incidents.slice();

  if (status) {
    filtered = filtered.filter(i => i.status.toUpperCase() === status.toUpperCase());
  }
  if (priority) {
    filtered = filtered.filter(i => i.priority.toUpperCase() === priority.toUpperCase());
  }
  if (assignedTo) {
    filtered = filtered.filter(i => i.assigned_to === assignedTo);
  }

  const total = filtered.length;
  const paginated = filtered
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(offset, offset + limit)
    .map(i => {
      const assignedUser = memoryStore.users.find(u => u.user_id === i.assigned_to);
      const createdUser = memoryStore.users.find(u => u.user_id === i.created_by);
      const linkedCount = memoryStore.incident_findings.filter(inf => inf.incident_id === i.incident_id).length;

      return {
        ...i,
        assigned_user_name: assignedUser?.display_name || null,
        assigned_user_email: assignedUser?.email || null,
        created_user_name: createdUser?.display_name || 'System',
        total_findings: linkedCount
      };
    });

  return {
    incidents: paginated,
    total,
    limit,
    offset
  };
}

export async function getIncidentById(incidentId) {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const incResult = await executeQuery(
      `SELECT 
        inc.incident_id,
        inc.title,
        inc.description,
        inc.status,
        inc.priority,
        inc.assigned_to,
        inc.created_by,
        inc.version,
        inc.created_at,
        inc.updated_at,
        inc.resolved_at,
        inc.closed_at,
        inc.resolution_summary,
        u_assign.display_name AS assigned_user_name,
        u_assign.email AS assigned_user_email,
        u_create.display_name AS created_user_name,
        u_create.email AS created_user_email
      FROM leaklens.incidents inc
      LEFT JOIN leaklens.users u_assign ON inc.assigned_to = u_assign.user_id
      LEFT JOIN leaklens.users u_create ON inc.created_by = u_create.user_id
      WHERE inc.incident_id = @incidentId`,
      { incidentId }
    );

    const incident = incResult.recordset?.[0];
    if (!incident) return null;

    // Fetch associated findings
    const findingsResult = await executeQuery(
      `SELECT 
        f.finding_id,
        f.file_id,
        f.rule_id,
        dr.rule_name,
        dr.category,
        f.location_reference,
        f.masked_excerpt,
        f.severity,
        f.status,
        f.detected_at,
        fl.original_filename,
        fl.content_hash,
        fl.scan_id,
        inf.linked_at
      FROM leaklens.incident_findings inf
      INNER JOIN leaklens.findings f ON inf.finding_id = f.finding_id
      INNER JOIN leaklens.files fl ON f.file_id = fl.file_id
      INNER JOIN leaklens.detection_rules dr ON f.rule_id = dr.rule_id
      WHERE inf.incident_id = @incidentId
      ORDER BY f.detected_at DESC`,
      { incidentId }
    );

    return {
      ...incident,
      findings: findingsResult.recordset || []
    };
  }

  // Memory fallback
  const inc = memoryStore.incidents.find(i => i.incident_id === incidentId);
  if (!inc) return null;

  const assignedUser = memoryStore.users.find(u => u.user_id === inc.assigned_to);
  const createdUser = memoryStore.users.find(u => u.user_id === inc.created_by);

  const linkedFindingIds = memoryStore.incident_findings
    .filter(inf => inf.incident_id === incidentId)
    .map(inf => inf.finding_id);

  const findings = memoryStore.findings
    .filter(f => linkedFindingIds.includes(f.finding_id))
    .map(f => {
      const file = memoryStore.files.find(fl => fl.file_id === f.file_id);
      const rule = memoryStore.detection_rules.find(r => r.rule_id === f.rule_id);
      return {
        ...f,
        original_filename: file?.original_filename || 'unknown',
        content_hash: file?.content_hash || '',
        scan_id: file?.scan_id || '',
        rule_name: rule?.rule_name || f.rule_name || 'RULE',
        category: rule?.category || f.category || 'EXPOSURE'
      };
    });

  return {
    ...inc,
    assigned_user_name: assignedUser?.display_name || null,
    assigned_user_email: assignedUser?.email || null,
    created_user_name: createdUser?.display_name || 'System',
    created_user_email: createdUser?.email || null,
    findings
  };
}

export async function updateIncidentDetails(incidentId, { title, description }) {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    await executeQuery(
      `UPDATE leaklens.incidents
       SET title = ISNULL(@title, title),
           description = ISNULL(@description, description),
           updated_at = SYSUTCDATETIME()
       WHERE incident_id = @incidentId`,
      { incidentId, title, description }
    );
    return getIncidentById(incidentId);
  }

  const inc = memoryStore.incidents.find(i => i.incident_id === incidentId);
  if (!inc) return null;
  if (title) inc.title = title;
  if (description) inc.description = description;
  inc.updated_at = new Date().toISOString();
  return getIncidentById(incidentId);
}

export async function updateIncidentAssignment(incidentId, { assignedTo, actingUserId }) {
  const now = new Date().toISOString();
  const dbHealth = await checkDatabaseHealth();

  if (dbHealth.isHealthy) {
    const query = `
      BEGIN TRANSACTION;
      BEGIN TRY
        DECLARE @prev_assignee UNIQUEIDENTIFIER;
        SELECT @prev_assignee = assigned_to FROM leaklens.incidents WITH (UPDLOCK) WHERE incident_id = @incidentId;

        UPDATE leaklens.incidents
        SET 
          assigned_to = @assignedTo,
          version = version + 1,
          updated_at = SYSUTCDATETIME()
        WHERE incident_id = @incidentId;

        INSERT INTO leaklens.remediation_actions (
          action_id, incident_id, user_id, action_type, notes, created_at
        ) VALUES (
          NEWID(), @incidentId, @actingUserId, 'ASSIGNMENT',
          CONCAT('Assigned incident to user: ', CAST(@assignedTo AS NVARCHAR(64))),
          SYSUTCDATETIME()
        );

        INSERT INTO leaklens.audit_logs (
          audit_id, user_id, event_type, entity_type, entity_id, metadata_json, created_at
        ) VALUES (
          NEWID(), @actingUserId, 'INCIDENT_ASSIGNED', 'incident', CAST(@incidentId AS NVARCHAR(64)),
          JSON_OBJECT('previous_assignee': CAST(@prev_assignee AS NVARCHAR(64)), 'new_assignee': CAST(@assignedTo AS NVARCHAR(64))),
          SYSUTCDATETIME()
        );

        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
      END CATCH
    `;

    await executeQuery(query, { incidentId, assignedTo, actingUserId });
    return getIncidentById(incidentId);
  }

  // Memory fallback
  const inc = memoryStore.incidents.find(i => i.incident_id === incidentId);
  if (!inc) return null;

  const prevAssignee = inc.assigned_to;
  inc.assigned_to = assignedTo;
  inc.version = (inc.version || 1) + 1;
  inc.updated_at = now;

  memoryStore.remediation_actions.push({
    action_id: crypto.randomUUID(),
    incident_id: incidentId,
    user_id: actingUserId,
    action_type: 'ASSIGNMENT',
    notes: `Assigned incident to user: ${assignedTo}`,
    created_at: now
  });

  memoryStore.audit_logs.push({
    audit_id: crypto.randomUUID(),
    user_id: actingUserId,
    event_type: 'INCIDENT_ASSIGNED',
    entity_type: 'incident',
    entity_id: incidentId,
    metadata_json: JSON.stringify({ previous_assignee: prevAssignee, new_assignee: assignedTo }),
    created_at: now
  });

  return getIncidentById(incidentId);
}

export async function updateIncidentStatus(incidentId, { newStatus, actingUserId, reason = '', expectedVersion = null }) {
  const normalizedStatus = newStatus.toUpperCase();
  const now = new Date().toISOString();
  const dbHealth = await checkDatabaseHealth();

  if (dbHealth.isHealthy) {
    const query = `
      BEGIN TRANSACTION;
      BEGIN TRY
        DECLARE @current_status NVARCHAR(32);
        DECLARE @current_version INT;

        SELECT @current_status = status, @current_version = version 
        FROM leaklens.incidents WITH (UPDLOCK) 
        WHERE incident_id = @incidentId;

        IF @current_status IS NULL
        BEGIN
          THROW 50002, 'Incident does not exist.', 1;
        END

        IF @expectedVersion IS NOT NULL AND @expectedVersion <> @current_version
        BEGIN
          THROW 50005, 'Concurrency conflict: incident was modified by another user.', 1;
        END

        UPDATE leaklens.incidents
        SET 
          status = @newStatus,
          closed_at = CASE WHEN @newStatus = 'CLOSED' THEN SYSUTCDATETIME() ELSE closed_at END,
          version = version + 1,
          updated_at = SYSUTCDATETIME()
        WHERE incident_id = @incidentId;

        INSERT INTO leaklens.remediation_actions (
          action_id, incident_id, user_id, action_type, notes, created_at
        ) VALUES (
          NEWID(), @incidentId, @actingUserId, 'STATUS_CHANGE',
          CONCAT('Status changed from ', @current_status, ' to ', @newStatus, '. Reason: ', @reason),
          SYSUTCDATETIME()
        );

        INSERT INTO leaklens.audit_logs (
          audit_id, user_id, event_type, entity_type, entity_id, metadata_json, created_at
        ) VALUES (
          NEWID(), @actingUserId, 'INCIDENT_STATUS_CHANGED', 'incident', CAST(@incidentId AS NVARCHAR(64)),
          JSON_OBJECT('previous_status': @current_status, 'new_status': @newStatus, 'reason': @reason),
          SYSUTCDATETIME()
        );

        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
      END CATCH
    `;

    await executeQuery(query, {
      incidentId,
      newStatus: normalizedStatus,
      actingUserId,
      reason,
      expectedVersion
    });

    return getIncidentById(incidentId);
  }

  // Memory fallback
  const inc = memoryStore.incidents.find(i => i.incident_id === incidentId);
  if (!inc) throw new Error('Incident does not exist.');

  if (expectedVersion !== null && expectedVersion !== undefined && inc.version !== expectedVersion) {
    const conflictErr = new Error('Concurrency conflict: incident was modified by another user.');
    conflictErr.code = 'CONCURRENCY_CONFLICT';
    throw conflictErr;
  }

  const prevStatus = inc.status;
  inc.status = normalizedStatus;
  inc.version = (inc.version || 1) + 1;
  inc.updated_at = now;
  if (normalizedStatus === 'CLOSED') {
    inc.closed_at = now;
  }

  memoryStore.remediation_actions.push({
    action_id: crypto.randomUUID(),
    incident_id: incidentId,
    user_id: actingUserId,
    action_type: 'STATUS_CHANGE',
    notes: `Status changed from ${prevStatus} to ${normalizedStatus}. Reason: ${reason}`,
    created_at: now
  });

  memoryStore.audit_logs.push({
    audit_id: crypto.randomUUID(),
    user_id: actingUserId,
    event_type: 'INCIDENT_STATUS_CHANGED',
    entity_type: 'incident',
    entity_id: incidentId,
    metadata_json: JSON.stringify({ previous_status: prevStatus, new_status: normalizedStatus, reason }),
    created_at: now
  });

  return getIncidentById(incidentId);
}

export async function addRemediationAction(incidentId, {
  actionType,
  notes,
  actingUserId
}) {
  const normalizedAction = actionType.toUpperCase();
  const now = new Date().toISOString();
  const actionId = crypto.randomUUID();

  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const query = `
      BEGIN TRANSACTION;
      BEGIN TRY
        INSERT INTO leaklens.remediation_actions (
          action_id, incident_id, user_id, action_type, notes, created_at
        ) VALUES (
          @actionId, @incidentId, @actingUserId, @actionType, @notes, SYSUTCDATETIME()
        );

        UPDATE leaklens.incidents
        SET updated_at = SYSUTCDATETIME()
        WHERE incident_id = @incidentId;

        INSERT INTO leaklens.audit_logs (
          audit_id, user_id, event_type, entity_type, entity_id, metadata_json, created_at
        ) VALUES (
          NEWID(), @actingUserId, 'REMEDIATION_RECORDED', 'incident', CAST(@incidentId AS NVARCHAR(64)),
          JSON_OBJECT('action_type': @actionType, 'notes': @notes),
          SYSUTCDATETIME()
        );

        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
      END CATCH
    `;

    await executeQuery(query, {
      actionId,
      incidentId,
      actingUserId,
      actionType: normalizedAction,
      notes
    });

    return { action_id: actionId, incident_id: incidentId, user_id: actingUserId, action_type: normalizedAction, notes, created_at: now };
  }

  // Memory fallback
  const newAction = {
    action_id: actionId,
    incident_id: incidentId,
    user_id: actingUserId,
    action_type: normalizedAction,
    notes,
    created_at: now
  };

  memoryStore.remediation_actions.push(newAction);

  const inc = memoryStore.incidents.find(i => i.incident_id === incidentId);
  if (inc) inc.updated_at = now;

  memoryStore.audit_logs.push({
    audit_id: crypto.randomUUID(),
    user_id: actingUserId,
    event_type: 'REMEDIATION_RECORDED',
    entity_type: 'incident',
    entity_id: incidentId,
    metadata_json: JSON.stringify({ action_type: normalizedAction, notes }),
    created_at: now
  });

  return newAction;
}

export async function getRemediationActions(incidentId) {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const result = await executeQuery(
      `SELECT 
        ra.action_id,
        ra.incident_id,
        ra.user_id,
        ra.action_type,
        ra.notes,
        ra.created_at,
        u.display_name AS user_name,
        u.role AS user_role
      FROM leaklens.remediation_actions ra
      INNER JOIN leaklens.users u ON ra.user_id = u.user_id
      WHERE ra.incident_id = @incidentId
      ORDER BY ra.created_at ASC`,
      { incidentId }
    );
    return result.recordset || [];
  }

  // Memory fallback
  return memoryStore.remediation_actions
    .filter(ra => ra.incident_id === incidentId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(ra => {
      const user = memoryStore.users.find(u => u.user_id === ra.user_id);
      return {
        ...ra,
        user_name: user?.display_name || 'System Analyst',
        user_role: user?.role || 'ANALYST'
      };
    });
}

export async function resolveIncidentTransactional(incidentId, {
  actingUserId,
  resolutionSummary,
  verificationOutcome = 'PASSED',
  expectedVersion = null
}) {
  const now = new Date().toISOString();
  const dbHealth = await checkDatabaseHealth();

  if (dbHealth.isHealthy) {
    // Call the stored procedure sp_resolve_incident
    const result = await executeQuery(
      `EXEC leaklens.sp_resolve_incident 
        @incident_id = @incidentId,
        @user_id = @actingUserId,
        @action_type = 'RESOLUTION',
        @notes = @resolutionSummary,
        @verification_outcome = @verificationOutcome,
        @expected_version = @expectedVersion`,
      {
        incidentId,
        actingUserId,
        resolutionSummary,
        verificationOutcome,
        expectedVersion
      }
    );

    return getIncidentById(incidentId);
  }

  // Memory fallback simulating atomic sp_resolve_incident behavior
  const inc = memoryStore.incidents.find(i => i.incident_id === incidentId);
  if (!inc) {
    const err = new Error('Incident does not exist.');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (expectedVersion !== null && expectedVersion !== undefined && inc.version !== expectedVersion) {
    const conflictErr = new Error('Concurrency conflict: incident was modified by another user.');
    conflictErr.code = 'CONCURRENCY_CONFLICT';
    throw conflictErr;
  }

  if (['RESOLVED', 'CLOSED'].includes(inc.status.toUpperCase())) {
    const err = new Error(`Cannot resolve incident in status: ${inc.status}`);
    err.code = 'INVALID_TRANSITION';
    throw err;
  }

  if (!resolutionSummary || !resolutionSummary.trim()) {
    const err = new Error('Resolution summary notes are mandatory for resolving an incident.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const prevStatus = inc.status;
  inc.status = 'RESOLVED';
  inc.resolved_at = now;
  inc.resolution_summary = resolutionSummary;
  inc.version = (inc.version || 1) + 1;
  inc.updated_at = now;

  // Transition associated findings to 'remediated'
  const linkedFindingIds = memoryStore.incident_findings
    .filter(inf => inf.incident_id === incidentId)
    .map(inf => inf.finding_id);

  memoryStore.findings.forEach(f => {
    if (linkedFindingIds.includes(f.finding_id)) {
      f.status = 'remediated';
    }
  });

  // Record resolution remediation action
  memoryStore.remediation_actions.push({
    action_id: crypto.randomUUID(),
    incident_id: incidentId,
    user_id: actingUserId,
    action_type: 'RESOLUTION',
    notes: resolutionSummary,
    created_at: now
  });

  // Record resolution audit log
  memoryStore.audit_logs.push({
    audit_id: crypto.randomUUID(),
    user_id: actingUserId,
    event_type: 'INCIDENT_RESOLVED',
    entity_type: 'incident',
    entity_id: incidentId,
    metadata_json: JSON.stringify({
      previous_status: prevStatus,
      new_status: 'RESOLVED',
      verification_outcome: verificationOutcome,
      resolution_summary: resolutionSummary
    }),
    created_at: now
  });

  return getIncidentById(incidentId);
}

export async function reopenIncident(incidentId, { actingUserId, justification, expectedVersion = null }) {
  const now = new Date().toISOString();
  const dbHealth = await checkDatabaseHealth();

  if (dbHealth.isHealthy) {
    const query = `
      BEGIN TRANSACTION;
      BEGIN TRY
        DECLARE @current_status NVARCHAR(32);
        DECLARE @current_version INT;

        SELECT @current_status = status, @current_version = version 
        FROM leaklens.incidents WITH (UPDLOCK) 
        WHERE incident_id = @incidentId;

        IF @current_status IS NULL
        BEGIN
          THROW 50002, 'Incident does not exist.', 1;
        END

        IF @expectedVersion IS NOT NULL AND @expectedVersion <> @current_version
        BEGIN
          THROW 50005, 'Concurrency conflict: incident was modified by another user.', 1;
        END

        IF @current_status NOT IN ('RESOLVED', 'CLOSED', 'resolved', 'closed')
        BEGIN
          THROW 50003, 'Only resolved or closed incidents may be reopened.', 1;
        END

        UPDATE leaklens.incidents
        SET 
          status = 'IN_PROGRESS',
          resolved_at = NULL,
          version = version + 1,
          updated_at = SYSUTCDATETIME()
        WHERE incident_id = @incidentId;

        INSERT INTO leaklens.remediation_actions (
          action_id, incident_id, user_id, action_type, notes, created_at
        ) VALUES (
          NEWID(), @incidentId, @actingUserId, 'REOPENED',
          CONCAT('Incident reopened. Justification: ', @justification),
          SYSUTCDATETIME()
        );

        INSERT INTO leaklens.audit_logs (
          audit_id, user_id, event_type, entity_type, entity_id, metadata_json, created_at
        ) VALUES (
          NEWID(), @actingUserId, 'INCIDENT_REOPENED', 'incident', CAST(@incidentId AS NVARCHAR(64)),
          JSON_OBJECT('previous_status': @current_status, 'justification': @justification),
          SYSUTCDATETIME()
        );

        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
      END CATCH
    `;

    await executeQuery(query, { incidentId, actingUserId, justification, expectedVersion });
    return getIncidentById(incidentId);
  }

  // Memory fallback
  const inc = memoryStore.incidents.find(i => i.incident_id === incidentId);
  if (!inc) throw new Error('Incident does not exist.');

  if (expectedVersion !== null && expectedVersion !== undefined && inc.version !== expectedVersion) {
    const conflictErr = new Error('Concurrency conflict: incident was modified by another user.');
    conflictErr.code = 'CONCURRENCY_CONFLICT';
    throw conflictErr;
  }

  const prevStatus = inc.status;
  inc.status = 'IN_PROGRESS';
  inc.resolved_at = null;
  inc.version = (inc.version || 1) + 1;
  inc.updated_at = now;

  memoryStore.remediation_actions.push({
    action_id: crypto.randomUUID(),
    incident_id: incidentId,
    user_id: actingUserId,
    action_type: 'REOPENED',
    notes: `Incident reopened. Justification: ${justification}`,
    created_at: now
  });

  memoryStore.audit_logs.push({
    audit_id: crypto.randomUUID(),
    user_id: actingUserId,
    event_type: 'INCIDENT_REOPENED',
    entity_type: 'incident',
    entity_id: incidentId,
    metadata_json: JSON.stringify({ previous_status: prevStatus, justification }),
    created_at: now
  });

  return getIncidentById(incidentId);
}

export async function addFindingToIncident(incidentId, findingId, actingUserId) {
  const now = new Date().toISOString();
  const dbHealth = await checkDatabaseHealth();

  if (dbHealth.isHealthy) {
    const query = `
      BEGIN TRANSACTION;
      BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM leaklens.incident_findings WHERE incident_id = @incidentId AND finding_id = @findingId)
        BEGIN
          INSERT INTO leaklens.incident_findings (incident_id, finding_id, linked_at)
          VALUES (@incidentId, @findingId, SYSUTCDATETIME());

          UPDATE leaklens.findings SET status = 'confirmed' WHERE finding_id = @findingId;

          UPDATE leaklens.incidents SET updated_at = SYSUTCDATETIME() WHERE incident_id = @incidentId;

          INSERT INTO leaklens.remediation_actions (
            action_id, incident_id, user_id, action_type, notes, created_at
          ) VALUES (
            NEWID(), @incidentId, @actingUserId, 'COMMENT',
            CONCAT('Associated finding ', CAST(@findingId AS NVARCHAR(64))),
            SYSUTCDATETIME()
          );

          INSERT INTO leaklens.audit_logs (
            audit_id, user_id, event_type, entity_type, entity_id, metadata_json, created_at
          ) VALUES (
            NEWID(), @actingUserId, 'FINDING_ASSOCIATED', 'finding', CAST(@findingId AS NVARCHAR(64)),
            JSON_OBJECT('incident_id': CAST(@incidentId AS NVARCHAR(64))),
            SYSUTCDATETIME()
          );
        END
        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
      END CATCH
    `;

    await executeQuery(query, { incidentId, findingId, actingUserId });
    return getIncidentById(incidentId);
  }

  // Memory fallback
  const existing = memoryStore.incident_findings.find(
    inf => inf.incident_id === incidentId && inf.finding_id === findingId
  );
  if (!existing) {
    memoryStore.incident_findings.push({ incident_id: incidentId, finding_id: findingId, linked_at: now });
    const finding = memoryStore.findings.find(f => f.finding_id === findingId);
    if (finding) finding.status = 'confirmed';

    const inc = memoryStore.incidents.find(i => i.incident_id === incidentId);
    if (inc) inc.updated_at = now;

    memoryStore.remediation_actions.push({
      action_id: crypto.randomUUID(),
      incident_id: incidentId,
      user_id: actingUserId,
      action_type: 'COMMENT',
      notes: `Associated finding ${findingId}`,
      created_at: now
    });

    memoryStore.audit_logs.push({
      audit_id: crypto.randomUUID(),
      user_id: actingUserId,
      event_type: 'FINDING_ASSOCIATED',
      entity_type: 'finding',
      entity_id: findingId,
      metadata_json: JSON.stringify({ incident_id: incidentId }),
      created_at: now
    });
  }

  return getIncidentById(incidentId);
}

export async function removeFindingFromIncident(incidentId, findingId, actingUserId, reason = '') {
  const now = new Date().toISOString();
  const dbHealth = await checkDatabaseHealth();

  if (dbHealth.isHealthy) {
    const query = `
      BEGIN TRANSACTION;
      BEGIN TRY
        DELETE FROM leaklens.incident_findings 
        WHERE incident_id = @incidentId AND finding_id = @findingId;

        UPDATE leaklens.incidents SET updated_at = SYSUTCDATETIME() WHERE incident_id = @incidentId;

        INSERT INTO leaklens.remediation_actions (
          action_id, incident_id, user_id, action_type, notes, created_at
        ) VALUES (
          NEWID(), @incidentId, @actingUserId, 'COMMENT',
          CONCAT('Disassociated finding ', CAST(@findingId AS NVARCHAR(64)), '. Reason: ', @reason),
          SYSUTCDATETIME()
        );

        INSERT INTO leaklens.audit_logs (
          audit_id, user_id, event_type, entity_type, entity_id, metadata_json, created_at
        ) VALUES (
          NEWID(), @actingUserId, 'FINDING_DISASSOCIATED', 'finding', CAST(@findingId AS NVARCHAR(64)),
          JSON_OBJECT('incident_id': CAST(@incidentId AS NVARCHAR(64)), 'reason': @reason),
          SYSUTCDATETIME()
        );

        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
      END CATCH
    `;

    await executeQuery(query, { incidentId, findingId, actingUserId, reason });
    return getIncidentById(incidentId);
  }

  // Memory fallback
  const idx = memoryStore.incident_findings.findIndex(
    inf => inf.incident_id === incidentId && inf.finding_id === findingId
  );
  if (idx !== -1) {
    memoryStore.incident_findings.splice(idx, 1);
    const inc = memoryStore.incidents.find(i => i.incident_id === incidentId);
    if (inc) inc.updated_at = now;

    memoryStore.remediation_actions.push({
      action_id: crypto.randomUUID(),
      incident_id: incidentId,
      user_id: actingUserId,
      action_type: 'COMMENT',
      notes: `Disassociated finding ${findingId}. Reason: ${reason}`,
      created_at: now
    });

    memoryStore.audit_logs.push({
      audit_id: crypto.randomUUID(),
      user_id: actingUserId,
      event_type: 'FINDING_DISASSOCIATED',
      entity_type: 'finding',
      entity_id: findingId,
      metadata_json: JSON.stringify({ incident_id: incidentId, reason }),
      created_at: now
    });
  }

  return getIncidentById(incidentId);
}

export async function getIncidentMetrics() {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_incidents,
        SUM(CASE WHEN status IN ('OPEN', 'open') THEN 1 ELSE 0 END) AS open_incidents,
        SUM(CASE WHEN status IN ('IN_PROGRESS', 'in_progress', 'under_investigation') THEN 1 ELSE 0 END) AS in_progress_incidents,
        SUM(CASE WHEN status IN ('PENDING_VERIFICATION', 'pending_verification') THEN 1 ELSE 0 END) AS pending_verification_incidents,
        SUM(CASE WHEN status IN ('RESOLVED', 'resolved') THEN 1 ELSE 0 END) AS resolved_incidents,
        SUM(CASE WHEN status IN ('CLOSED', 'closed') THEN 1 ELSE 0 END) AS closed_incidents,
        SUM(CASE WHEN priority IN ('CRITICAL', 'critical') THEN 1 ELSE 0 END) AS critical_priority,
        SUM(CASE WHEN priority IN ('HIGH', 'high') THEN 1 ELSE 0 END) AS high_priority,
        SUM(CASE WHEN assigned_to IS NULL THEN 1 ELSE 0 END) AS unassigned_count
      FROM leaklens.incidents
    `);

    const row = result.recordset?.[0] || {};
    return {
      totalIncidents: row.total_incidents || 0,
      openIncidents: row.open_incidents || 0,
      inProgressIncidents: row.in_progress_incidents || 0,
      pendingVerificationIncidents: row.pending_verification_incidents || 0,
      resolvedIncidents: row.resolved_incidents || 0,
      closedIncidents: row.closed_incidents || 0,
      criticalPriority: row.critical_priority || 0,
      highPriority: row.high_priority || 0,
      unassignedCount: row.unassigned_count || 0
    };
  }

  // Memory fallback
  const totalIncidents = memoryStore.incidents.length;
  let openIncidents = 0;
  let inProgressIncidents = 0;
  let pendingVerificationIncidents = 0;
  let resolvedIncidents = 0;
  let closedIncidents = 0;
  let criticalPriority = 0;
  let highPriority = 0;
  let unassignedCount = 0;

  memoryStore.incidents.forEach(inc => {
    const s = (inc.status || '').toUpperCase();
    const p = (inc.priority || '').toUpperCase();

    if (s === 'OPEN') openIncidents++;
    else if (s === 'IN_PROGRESS' || s === 'UNDER_INVESTIGATION') inProgressIncidents++;
    else if (s === 'PENDING_VERIFICATION') pendingVerificationIncidents++;
    else if (s === 'RESOLVED') resolvedIncidents++;
    else if (s === 'CLOSED') closedIncidents++;

    if (p === 'CRITICAL') criticalPriority++;
    else if (p === 'HIGH') highPriority++;

    if (!inc.assigned_to) unassignedCount++;
  });

  return {
    totalIncidents,
    openIncidents,
    inProgressIncidents,
    pendingVerificationIncidents,
    resolvedIncidents,
    closedIncidents,
    criticalPriority,
    highPriority,
    unassignedCount
  };
}

export async function getUnassociatedFindings() {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const result = await executeQuery(`
      SELECT 
        f.finding_id,
        f.file_id,
        f.rule_id,
        dr.rule_name,
        dr.category,
        f.location_reference,
        f.masked_excerpt,
        f.severity,
        f.status,
        f.detected_at,
        fl.original_filename
      FROM leaklens.findings f
      INNER JOIN leaklens.files fl ON f.file_id = fl.file_id
      INNER JOIN leaklens.detection_rules dr ON f.rule_id = dr.rule_id
      LEFT JOIN leaklens.incident_findings inf ON f.finding_id = inf.finding_id
      WHERE inf.incident_id IS NULL AND f.status <> 'remediated'
      ORDER BY 
        CASE f.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END ASC,
        f.detected_at DESC
    `);
    return result.recordset || [];
  }

  // Memory fallback
  const associatedFindingIds = new Set(memoryStore.incident_findings.map(inf => inf.finding_id));

  return memoryStore.findings
    .filter(f => !associatedFindingIds.has(f.finding_id) && f.status !== 'remediated')
    .map(f => {
      const file = memoryStore.files.find(fl => fl.file_id === f.file_id);
      const rule = memoryStore.detection_rules.find(r => r.rule_id === f.rule_id);
      return {
        ...f,
        original_filename: file?.original_filename || 'unknown_file',
        rule_name: rule?.rule_name || f.rule_name || 'RULE',
        category: rule?.category || f.category || 'EXPOSURE'
      };
    });
}

export default {
  createIncident,
  listIncidents,
  getIncidentById,
  updateIncidentDetails,
  updateIncidentAssignment,
  updateIncidentStatus,
  addRemediationAction,
  getRemediationActions,
  resolveIncidentTransactional,
  reopenIncident,
  addFindingToIncident,
  removeFindingFromIncident,
  getIncidentMetrics,
  getUnassociatedFindings
};
