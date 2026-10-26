import incidentRepository from '../../repositories/incidentRepository.js';
import userRepository from '../../repositories/userRepository.js';
import findingRepository from '../../repositories/findingRepository.js';

export const INCIDENT_STATUSES = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
};

export const INCIDENT_PRIORITIES = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

export const ACTION_TYPES = {
  INVESTIGATION: 'INVESTIGATION',
  ASSIGNMENT: 'ASSIGNMENT',
  STATUS_CHANGE: 'STATUS_CHANGE',
  REMEDIATION: 'REMEDIATION',
  VERIFICATION: 'VERIFICATION',
  COMMENT: 'COMMENT',
  RESOLUTION: 'RESOLUTION',
  REOPENED: 'REOPENED'
};

export const VERIFICATION_OUTCOMES = {
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  NEEDS_MORE_WORK: 'NEEDS_MORE_WORK'
};

// Allowed lifecycle transitions
export const ALLOWED_TRANSITIONS = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['PENDING_VERIFICATION', 'RESOLVED'],
  PENDING_VERIFICATION: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['IN_PROGRESS']
};

export class IncidentService {
  /**
   * Create an incident from one or more selected findings
   */
  async createIncident({ title, description, priority, findingIds, actor }) {
    if (!actor || !actor.user_id) {
      const err = new Error('Authentication required to create incident.');
      err.status = 401;
      throw err;
    }

    if (actor.role === 'COMPLIANCE_REVIEWER') {
      const err = new Error('Compliance reviewers are restricted from creating incidents.');
      err.status = 403;
      throw err;
    }

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      const err = new Error('Incident title is required (minimum 3 characters).');
      err.status = 400;
      throw err;
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      const err = new Error('Safe incident description is required.');
      err.status = 400;
      throw err;
    }

    const PEM_REGEX = /-----\s*BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY\s*-----/i;
    if (PEM_REGEX.test(description)) {
      const err = new Error('Incident descriptions must not contain raw private key blocks.');
      err.status = 400;
      throw err;
    }

    const normalizedPriority = (priority || 'MEDIUM').toUpperCase();
    if (!INCIDENT_PRIORITIES[normalizedPriority]) {
      const err = new Error(`Invalid incident priority: ${priority}. Allowed: CRITICAL, HIGH, MEDIUM, LOW`);
      err.status = 400;
      throw err;
    }

    if (!Array.isArray(findingIds) || findingIds.length === 0) {
      const err = new Error('At least one finding must be associated with the incident.');
      err.status = 400;
      throw err;
    }

    // Verify findings exist
    for (const fId of findingIds) {
      const finding = await findingRepository.getFindingById(fId);
      if (!finding) {
        const err = new Error(`Finding not found: ${fId}`);
        err.status = 404;
        throw err;
      }
    }

    return incidentRepository.createIncident({
      title: title.trim(),
      description: description.trim(),
      priority: normalizedPriority,
      findingIds,
      createdBy: actor.user_id
    });
  }

  /**
   * List incidents with filters and pagination
   */
  async listIncidents({ status, priority, assignedTo, limit, offset, actor }) {
    if (!actor) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    return incidentRepository.listIncidents({
      status: status ? status.toUpperCase() : undefined,
      priority: priority ? priority.toUpperCase() : undefined,
      assignedTo,
      limit: parsedLimit,
      offset: parsedOffset
    });
  }

  /**
   * Get single incident details with associated findings
   */
  async getIncident(incidentId, actor) {
    if (!actor) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    const incident = await incidentRepository.getIncidentById(incidentId);
    if (!incident) {
      const err = new Error(`Incident not found: ${incidentId}`);
      err.status = 404;
      throw err;
    }

    return incident;
  }

  /**
   * Assign or reassign incident
   */
  async assignIncident(incidentId, { assignedTo, actor }) {
    if (!actor) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    if (actor.role === 'COMPLIANCE_REVIEWER') {
      const err = new Error('Compliance reviewers cannot assign or reassign incidents.');
      err.status = 403;
      throw err;
    }

    const incident = await incidentRepository.getIncidentById(incidentId);
    if (!incident) {
      const err = new Error(`Incident not found: ${incidentId}`);
      err.status = 404;
      throw err;
    }

    // Verify target assignee exists, is active, and has eligible role
    const targetUser = await userRepository.findById(assignedTo);
    if (!targetUser) {
      const err = new Error(`Target user not found: ${assignedTo}`);
      err.status = 404;
      throw err;
    }

    if (!targetUser.is_active) {
      const err = new Error('Target user account is inactive.');
      err.status = 400;
      throw err;
    }

    if (!['ADMIN', 'ANALYST'].includes(targetUser.role)) {
      const err = new Error(`User with role ${targetUser.role} is not eligible for incident assignment.`);
      err.status = 400;
      throw err;
    }

    return incidentRepository.updateIncidentAssignment(incidentId, {
      assignedTo,
      actingUserId: actor.user_id
    });
  }

  /**
   * Transition incident status according to finite-state machine
   */
  async transitionStatus(incidentId, { newStatus, reason = '', expectedVersion = null, actor }) {
    if (!actor) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    if (actor.role === 'COMPLIANCE_REVIEWER') {
      const err = new Error('Compliance reviewers cannot alter incident lifecycle status.');
      err.status = 403;
      throw err;
    }

    const incident = await incidentRepository.getIncidentById(incidentId);
    if (!incident) {
      const err = new Error(`Incident not found: ${incidentId}`);
      err.status = 404;
      throw err;
    }

    const currentStatus = incident.status.toUpperCase();
    const targetStatus = (newStatus || '').toUpperCase();

    if (!INCIDENT_STATUSES[targetStatus]) {
      const err = new Error(`Invalid status: ${newStatus}`);
      err.status = 400;
      throw err;
    }

    if (currentStatus === targetStatus) {
      return incident; // No-op if already in target state
    }

    // Verify allowed transition
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      const err = new Error(`Status transition from ${currentStatus} to ${targetStatus} is not permitted by lifecycle rules.`);
      err.status = 409;
      throw err;
    }

    // Specific role rules
    if (currentStatus === 'OPEN' && targetStatus === 'CLOSED' && actor.role !== 'ADMIN') {
      const err = new Error('Only administrators may close an incident directly from OPEN status.');
      err.status = 403;
      throw err;
    }

    if (currentStatus === 'CLOSED' && targetStatus === 'IN_PROGRESS' && actor.role !== 'ADMIN') {
      const err = new Error('Only administrators may reopen a closed incident.');
      err.status = 403;
      throw err;
    }

    if (currentStatus === 'IN_PROGRESS' && targetStatus === 'RESOLVED' && actor.role !== 'ADMIN') {
      const err = new Error('Direct resolution from IN_PROGRESS without formal verification is restricted to administrators.');
      err.status = 403;
      throw err;
    }

    if (targetStatus === 'RESOLVED') {
      // Must use dedicated resolution workflow
      const err = new Error('To resolve an incident, execute the formal resolution workflow with resolution summary.');
      err.status = 400;
      throw err;
    }

    return incidentRepository.updateIncidentStatus(incidentId, {
      newStatus: targetStatus,
      actingUserId: actor.user_id,
      reason,
      expectedVersion
    });
  }

  /**
   * Record remediation or investigation action
   */
  async recordAction(incidentId, { actionType, notes, actor }) {
    if (!actor) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    if (actor.role === 'COMPLIANCE_REVIEWER') {
      const err = new Error('Compliance reviewers cannot record remediation actions.');
      err.status = 403;
      throw err;
    }

    const incident = await incidentRepository.getIncidentById(incidentId);
    if (!incident) {
      const err = new Error(`Incident not found: ${incidentId}`);
      err.status = 404;
      throw err;
    }

    if (['RESOLVED', 'CLOSED'].includes(incident.status.toUpperCase())) {
      const err = new Error(`Cannot add remediation actions to an incident in ${incident.status} status.`);
      err.status = 409;
      throw err;
    }

    const normalizedAction = (actionType || 'COMMENT').toUpperCase();
    if (!ACTION_TYPES[normalizedAction]) {
      const err = new Error(`Invalid action type: ${actionType}`);
      err.status = 400;
      throw err;
    }

    if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
      const err = new Error('Notes or summary is required.');
      err.status = 400;
      throw err;
    }

    const PEM_REGEX = /-----\s*BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY\s*-----/i;
    if (PEM_REGEX.test(notes)) {
      const err = new Error('Remediation notes must not contain raw private key blocks.');
      err.status = 400;
      throw err;
    }

    return incidentRepository.addRemediationAction(incidentId, {
      actionType: normalizedAction,
      notes: notes.trim(),
      actingUserId: actor.user_id
    });
  }

  /**
   * Get chronological remediation actions
   */
  async getActions(incidentId, actor) {
    if (!actor) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    const incident = await incidentRepository.getIncidentById(incidentId);
    if (!incident) {
      const err = new Error(`Incident not found: ${incidentId}`);
      err.status = 404;
      throw err;
    }

    return incidentRepository.getRemediationActions(incidentId);
  }

  /**
   * Record Verification Result
   */
  async recordVerification(incidentId, { outcome, summary, actor }) {
    if (!actor) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    if (actor.role === 'COMPLIANCE_REVIEWER') {
      const err = new Error('Compliance reviewers cannot perform incident verification.');
      err.status = 403;
      throw err;
    }

    const incident = await incidentRepository.getIncidentById(incidentId);
    if (!incident) {
      const err = new Error(`Incident not found: ${incidentId}`);
      err.status = 404;
      throw err;
    }

    const normalizedOutcome = (outcome || '').toUpperCase();
    if (!VERIFICATION_OUTCOMES[normalizedOutcome]) {
      const err = new Error(`Invalid verification outcome: ${outcome}. Allowed: PASSED, FAILED, NEEDS_MORE_WORK`);
      err.status = 400;
      throw err;
    }

    if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
      const err = new Error('Verification summary is mandatory.');
      err.status = 400;
      throw err;
    }

    // Record action
    await incidentRepository.addRemediationAction(incidentId, {
      actionType: 'VERIFICATION',
      notes: `Verification [${normalizedOutcome}]: ${summary.trim()}`,
      actingUserId: actor.user_id
    });

    // If verification failed or needs more work, ensure status transitions back to IN_PROGRESS
    if (normalizedOutcome === 'FAILED' || normalizedOutcome === 'NEEDS_MORE_WORK') {
      if (incident.status.toUpperCase() === 'PENDING_VERIFICATION') {
        await incidentRepository.updateIncidentStatus(incidentId, {
          newStatus: 'IN_PROGRESS',
          actingUserId: actor.user_id,
          reason: `Verification outcome was ${normalizedOutcome}: ${summary.trim()}`
        });
      }
    }

    return incidentRepository.getIncidentById(incidentId);
  }

  /**
   * Transactional Incident Resolution
   */
  async resolveIncident(incidentId, { resolutionSummary, verificationOutcome = 'PASSED', expectedVersion = null, actor }) {
    if (!actor) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    if (actor.role === 'COMPLIANCE_REVIEWER') {
      const err = new Error('Compliance reviewers cannot resolve incidents.');
      err.status = 403;
      throw err;
    }

    const incident = await incidentRepository.getIncidentById(incidentId);
    if (!incident) {
      const err = new Error(`Incident not found: ${incidentId}`);
      err.status = 404;
      throw err;
    }

    const currentStatus = incident.status.toUpperCase();
    if (!['IN_PROGRESS', 'PENDING_VERIFICATION'].includes(currentStatus)) {
      const err = new Error(`Cannot resolve incident in status: ${currentStatus}. Must be IN_PROGRESS or PENDING_VERIFICATION.`);
      err.status = 409;
      throw err;
    }

    if (!resolutionSummary || typeof resolutionSummary !== 'string' || resolutionSummary.trim().length < 5) {
      const err = new Error('Resolution summary is required (minimum 5 characters).');
      err.status = 400;
      throw err;
    }

    try {
      return await incidentRepository.resolveIncidentTransactional(incidentId, {
        actingUserId: actor.user_id,
        resolutionSummary: resolutionSummary.trim(),
        verificationOutcome,
        expectedVersion
      });
    } catch (err) {
      if (err.code === 'CONCURRENCY_CONFLICT' || err.message?.includes('Concurrency conflict')) {
        const conflictErr = new Error('Concurrency conflict: incident was updated by another user. Please refresh and review.');
        conflictErr.status = 409;
        throw conflictErr;
      }
      throw err;
    }
  }

  /**
   * Reopen Incident
   */
  async reopenIncident(incidentId, { justification, expectedVersion = null, actor }) {
    if (!actor) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    if (actor.role === 'COMPLIANCE_REVIEWER') {
      const err = new Error('Compliance reviewers cannot reopen incidents.');
      err.status = 403;
      throw err;
    }

    const incident = await incidentRepository.getIncidentById(incidentId);
    if (!incident) {
      const err = new Error(`Incident not found: ${incidentId}`);
      err.status = 404;
      throw err;
    }

    const currentStatus = incident.status.toUpperCase();
    if (!['RESOLVED', 'CLOSED'].includes(currentStatus)) {
      const err = new Error(`Only RESOLVED or CLOSED incidents may be reopened. Current status: ${currentStatus}`);
      err.status = 409;
      throw err;
    }

    if (currentStatus === 'CLOSED' && actor.role !== 'ADMIN') {
      const err = new Error('Only administrators may reopen a closed incident.');
      err.status = 403;
      throw err;
    }

    if (!justification || typeof justification !== 'string' || justification.trim().length < 5) {
      const err = new Error('Reopening justification is mandatory (minimum 5 characters).');
      err.status = 400;
      throw err;
    }

    return incidentRepository.reopenIncident(incidentId, {
      actingUserId: actor.user_id,
      justification: justification.trim(),
      expectedVersion
    });
  }

  /**
   * Associate additional finding to incident
   */
  async associateFinding(incidentId, { findingId, actor }) {
    if (!actor) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    if (actor.role === 'COMPLIANCE_REVIEWER') {
      const err = new Error('Compliance reviewers cannot modify incident finding associations.');
      err.status = 403;
      throw err;
    }

    const incident = await incidentRepository.getIncidentById(incidentId);
    if (!incident) {
      const err = new Error(`Incident not found: ${incidentId}`);
      err.status = 404;
      throw err;
    }

    const finding = await findingRepository.getFindingById(findingId);
    if (!finding) {
      const err = new Error(`Finding not found: ${findingId}`);
      err.status = 404;
      throw err;
    }

    return incidentRepository.addFindingToIncident(incidentId, findingId, actor.user_id);
  }

  /**
   * Disassociate finding from incident
   */
  async disassociateFinding(incidentId, findingId, { reason = '', actor }) {
    if (!actor) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    if (actor.role === 'COMPLIANCE_REVIEWER') {
      const err = new Error('Compliance reviewers cannot modify incident finding associations.');
      err.status = 403;
      throw err;
    }

    const incident = await incidentRepository.getIncidentById(incidentId);
    if (!incident) {
      const err = new Error(`Incident not found: ${incidentId}`);
      err.status = 404;
      throw err;
    }

    return incidentRepository.removeFindingFromIncident(incidentId, findingId, actor.user_id, reason);
  }

  /**
   * Get incident metrics for analytics
   */
  async getMetrics(actor) {
    if (!actor) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    return incidentRepository.getIncidentMetrics();
  }

  /**
   * Get unassociated findings available for incident creation
   */
  async getUnassociatedFindings(actor) {
    if (!actor) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    return incidentRepository.getUnassociatedFindings();
  }
}

export const incidentService = new IncidentService();
export default incidentService;
