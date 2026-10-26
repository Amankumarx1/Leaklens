import incidentService from '../services/incidents/incidentService.js';
import userRepository from '../repositories/userRepository.js';
import { successResponse } from '../utils/apiResponse.js';

export async function listIncidents(req, res, next) {
  try {
    const { status, priority, assignedTo, limit, offset } = req.query;
    const data = await incidentService.listIncidents({
      status,
      priority,
      assignedTo,
      limit,
      offset,
      actor: req.user
    });
    return successResponse(res, data, 'Incidents retrieved successfully.');
  } catch (err) {
    next(err);
  }
}

export async function createIncident(req, res, next) {
  try {
    const { title, description, priority, findingIds } = req.body;
    const incident = await incidentService.createIncident({
      title,
      description,
      priority,
      findingIds,
      actor: req.user
    });
    return successResponse(res, { incident }, 'Incident created successfully.', 201);
  } catch (err) {
    next(err);
  }
}

export async function getIncident(req, res, next) {
  try {
    const { id } = req.params;
    const incident = await incidentService.getIncident(id, req.user);
    return successResponse(res, { incident }, 'Incident details retrieved.');
  } catch (err) {
    next(err);
  }
}

export async function assignIncident(req, res, next) {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;
    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'assignedTo user ID is required.' }
      });
    }

    const incident = await incidentService.assignIncident(id, {
      assignedTo,
      actor: req.user
    });
    return successResponse(res, { incident }, 'Incident assignment updated.');
  } catch (err) {
    next(err);
  }
}

export async function transitionStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reason, expectedVersion } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Target status is required.' }
      });
    }

    const incident = await incidentService.transitionStatus(id, {
      newStatus: status,
      reason,
      expectedVersion,
      actor: req.user
    });
    return successResponse(res, { incident }, `Incident transitioned to ${status}.`);
  } catch (err) {
    next(err);
  }
}

export async function recordAction(req, res, next) {
  try {
    const { id } = req.params;
    const { actionType, notes } = req.body;
    const action = await incidentService.recordAction(id, {
      actionType,
      notes,
      actor: req.user
    });
    return successResponse(res, { action }, 'Remediation action recorded.', 201);
  } catch (err) {
    next(err);
  }
}

export async function getActions(req, res, next) {
  try {
    const { id } = req.params;
    const actions = await incidentService.getActions(id, req.user);
    return successResponse(res, { actions }, 'Remediation history retrieved.');
  } catch (err) {
    next(err);
  }
}

export async function recordVerification(req, res, next) {
  try {
    const { id } = req.params;
    const { outcome, summary } = req.body;
    const incident = await incidentService.recordVerification(id, {
      outcome,
      summary,
      actor: req.user
    });
    return successResponse(res, { incident }, 'Verification result recorded.');
  } catch (err) {
    next(err);
  }
}

export async function resolveIncident(req, res, next) {
  try {
    const { id } = req.params;
    const { resolutionSummary, verificationOutcome, expectedVersion } = req.body;
    const incident = await incidentService.resolveIncident(id, {
      resolutionSummary,
      verificationOutcome,
      expectedVersion,
      actor: req.user
    });
    return successResponse(res, { incident }, 'Incident resolved successfully.');
  } catch (err) {
    next(err);
  }
}

export async function reopenIncident(req, res, next) {
  try {
    const { id } = req.params;
    const { justification, expectedVersion } = req.body;
    const incident = await incidentService.reopenIncident(id, {
      justification,
      expectedVersion,
      actor: req.user
    });
    return successResponse(res, { incident }, 'Incident reopened successfully.');
  } catch (err) {
    next(err);
  }
}

export async function associateFinding(req, res, next) {
  try {
    const { id } = req.params;
    const { findingId } = req.body;
    if (!findingId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'findingId is required.' }
      });
    }

    const incident = await incidentService.associateFinding(id, {
      findingId,
      actor: req.user
    });
    return successResponse(res, { incident }, 'Finding associated with incident.');
  } catch (err) {
    next(err);
  }
}

export async function disassociateFinding(req, res, next) {
  try {
    const { id, findingId } = req.params;
    const { reason } = req.body || {};
    const incident = await incidentService.disassociateFinding(id, findingId, {
      reason,
      actor: req.user
    });
    return successResponse(res, { incident }, 'Finding disassociated from incident.');
  } catch (err) {
    next(err);
  }
}

export async function getMetrics(req, res, next) {
  try {
    const metrics = await incidentService.getMetrics(req.user);
    return successResponse(res, { metrics }, 'Incident metrics retrieved.');
  } catch (err) {
    next(err);
  }
}

export async function getUnassociatedFindings(req, res, next) {
  try {
    const findings = await incidentService.getUnassociatedFindings(req.user);
    return successResponse(res, { findings }, 'Unassociated findings retrieved.');
  } catch (err) {
    next(err);
  }
}

export async function getEligibleAssignees(req, res, next) {
  try {
    const assignees = await userRepository.getEligibleAssignees();
    return successResponse(res, { assignees }, 'Eligible assignees retrieved.');
  } catch (err) {
    next(err);
  }
}

export default {
  listIncidents,
  createIncident,
  getIncident,
  assignIncident,
  transitionStatus,
  recordAction,
  getActions,
  recordVerification,
  resolveIncident,
  reopenIncident,
  associateFinding,
  disassociateFinding,
  getMetrics,
  getUnassociatedFindings,
  getEligibleAssignees
};
