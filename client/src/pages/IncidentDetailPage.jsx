import React, { useState, useEffect } from 'react';
import StatusBadge from '../components/StatusBadge';
import {
  getIncidentById,
  assignIncident,
  updateIncidentStatus,
  addIncidentAction,
  getIncidentActions,
  recordIncidentVerification,
  resolveIncident,
  reopenIncident,
  disassociateFindingFromIncident,
  getEligibleAssignees,
  getUnassociatedFindings,
  associateFindingToIncident
} from '../services/api';

export function IncidentDetailPage({ incidentId, user, onNavigate }) {
  const [incident, setIncident] = useState(null);
  const [actions, setActions] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Assignment state
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [updatingAssignee, setUpdatingAssignee] = useState(false);

  // New action form state
  const [actionType, setActionType] = useState('INVESTIGATION');
  const [actionNotes, setActionNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Verification modal/form state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyOutcome, setVerifyOutcome] = useState('PASSED');
  const [verifySummary, setVerifySummary] = useState('');
  const [submittingVerify, setSubmittingVerify] = useState(false);

  // Resolution modal/form state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [submittingResolve, setSubmittingResolve] = useState(false);

  // Reopen modal/form state
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenJustification, setReopenJustification] = useState('');
  const [submittingReopen, setSubmittingReopen] = useState(false);

  // Add finding modal state
  const [showAddFindingModal, setShowAddFindingModal] = useState(false);
  const [unassociatedFindings, setUnassociatedFindings] = useState([]);
  const [loadingUnassociated, setLoadingUnassociated] = useState(false);

  const isCompliance = user?.role === 'COMPLIANCE_REVIEWER';
  const isAdmin = user?.role === 'ADMIN';

  const loadIncidentData = React.useCallback(async () => {
    if (!incidentId) return;
    try {
      setError(null);
      const [incRes, actRes] = await Promise.all([
        getIncidentById(incidentId),
        getIncidentActions(incidentId)
      ]);

      if (incRes?.success && incRes?.data?.incident) {
        setIncident(incRes.data.incident);
        setSelectedAssignee(incRes.data.incident.assigned_to || '');
      } else {
        throw new Error('Incident not found.');
      }

      if (actRes?.success && actRes?.data?.actions) {
        setActions(actRes.data.actions);
      }
    } catch (err) {
      setError(err.message || 'Failed to load incident.');
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      if (!incidentId) return;
      try {
        setError(null);
        const [incRes, actRes] = await Promise.all([
          getIncidentById(incidentId),
          getIncidentActions(incidentId)
        ]);

        if (!ignore && incRes?.success && incRes?.data?.incident) {
          setIncident(incRes.data.incident);
          setSelectedAssignee(incRes.data.incident.assigned_to || '');
        }
        if (!ignore && actRes?.success && actRes?.data?.actions) {
          setActions(actRes.data.actions);
        }
        if (!ignore && !isCompliance) {
          const assigneesRes = await getEligibleAssignees().catch(() => null);
          if (!ignore && assigneesRes?.success && assigneesRes?.data?.assignees) {
            setAssignees(assigneesRes.data.assignees);
          }
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load incident.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => { ignore = true; };
  }, [incidentId, isCompliance]);

  const handleAssign = async () => {
    if (!selectedAssignee) return;
    try {
      setUpdatingAssignee(true);
      setError(null);
      const res = await assignIncident(incidentId, selectedAssignee);
      if (res?.success) {
        setSuccessMsg('Incident assignment updated successfully.');
        await loadIncidentData();
      }
    } catch (err) {
      setError(err.message || 'Failed to update assignment.');
    } finally {
      setUpdatingAssignee(false);
    }
  };

  const handleStatusTransition = async (targetStatus, reason = '') => {
    try {
      setError(null);
      const res = await updateIncidentStatus(incidentId, targetStatus, reason, incident?.version);
      if (res?.success) {
        setSuccessMsg(`Incident transitioned to ${targetStatus}.`);
        await loadIncidentData();
      }
    } catch (err) {
      setError(err.message || 'Failed to transition status.');
    }
  };

  const handleAddAction = async (e) => {
    e.preventDefault();
    if (!actionNotes.trim()) return;

    try {
      setSubmittingAction(true);
      setError(null);
      const res = await addIncidentAction(incidentId, actionType, actionNotes.trim());
      if (res?.success) {
        setActionNotes('');
        setSuccessMsg('Action logged successfully.');
        await loadIncidentData();
      }
    } catch (err) {
      setError(err.message || 'Failed to record remediation action.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRecordVerification = async (e) => {
    e.preventDefault();
    if (!verifySummary.trim()) {
      setError('Verification summary is required.');
      return;
    }

    try {
      setSubmittingVerify(true);
      setError(null);
      const res = await recordIncidentVerification(incidentId, verifyOutcome, verifySummary.trim());
      if (res?.success) {
        setShowVerifyModal(false);
        setVerifySummary('');
        setSuccessMsg(`Verification recorded with outcome: ${verifyOutcome}.`);
        await loadIncidentData();
      }
    } catch (err) {
      setError(err.message || 'Failed to record verification.');
    } finally {
      setSubmittingVerify(false);
    }
  };

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!resolutionSummary.trim() || resolutionSummary.trim().length < 5) {
      setError('Resolution summary is mandatory (minimum 5 characters).');
      return;
    }

    try {
      setSubmittingResolve(true);
      setError(null);
      const res = await resolveIncident(incidentId, {
        resolutionSummary: resolutionSummary.trim(),
        verificationOutcome: 'PASSED',
        expectedVersion: incident?.version
      });

      if (res?.success) {
        setShowResolveModal(false);
        setResolutionSummary('');
        setSuccessMsg('Incident atomically resolved via sp_resolve_incident.');
        await loadIncidentData();
      }
    } catch (err) {
      setError(err.message || 'Failed to resolve incident.');
    } finally {
      setSubmittingResolve(false);
    }
  };

  const handleReopen = async (e) => {
    e.preventDefault();
    if (!reopenJustification.trim() || reopenJustification.trim().length < 5) {
      setError('Reopening justification is mandatory (minimum 5 characters).');
      return;
    }

    try {
      setSubmittingReopen(true);
      setError(null);
      const res = await reopenIncident(incidentId, reopenJustification.trim(), incident?.version);
      if (res?.success) {
        setShowReopenModal(false);
        setReopenJustification('');
        setSuccessMsg('Incident reopened into IN_PROGRESS.');
        await loadIncidentData();
      }
    } catch (err) {
      setError(err.message || 'Failed to reopen incident.');
    } finally {
      setSubmittingReopen(false);
    }
  };

  const handleDisassociate = async (findingId) => {
    if (!confirm('Are you sure you want to disassociate this finding from the incident?')) return;
    try {
      setError(null);
      await disassociateFindingFromIncident(incidentId, findingId, 'Disassociated by analyst');
      setSuccessMsg('Finding disassociated.');
      await loadIncidentData();
    } catch (err) {
      setError(err.message || 'Failed to disassociate finding.');
    }
  };

  const openAddFindingModal = async () => {
    try {
      setShowAddFindingModal(true);
      setLoadingUnassociated(true);
      const res = await getUnassociatedFindings();
      if (res?.success && res?.data?.findings) {
        setUnassociatedFindings(res.data.findings);
      }
    } catch (err) {
      setError(err.message || 'Failed to load unassociated findings.');
    } finally {
      setLoadingUnassociated(false);
    }
  };

  const handleAssociate = async (findingId) => {
    try {
      setError(null);
      await associateFindingToIncident(incidentId, findingId);
      setShowAddFindingModal(false);
      setSuccessMsg('Finding linked to incident.');
      await loadIncidentData();
    } catch (err) {
      setError(err.message || 'Failed to associate finding.');
    }
  };

  if (loading) {
    return (
      <div className="state-center" style={{ minHeight: '350px' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>Loading incident and timeline...</p>
      </div>
    );
  }

  if (error && !incident) {
    return (
      <div className="page-container">
        <button className="btn btn-secondary" onClick={() => onNavigate('incidents')}>
          ← Back to Incidents
        </button>
        <div className="alert alert-danger" style={{ marginTop: '16px' }}>
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  const priorityType = incident.priority?.toLowerCase() === 'critical' ? 'danger'
    : incident.priority?.toLowerCase() === 'high' ? 'danger'
    : incident.priority?.toLowerCase() === 'medium' ? 'warning'
    : 'neutral';

  const statusType = incident.status === 'RESOLVED' ? 'success'
    : incident.status === 'CLOSED' ? 'neutral'
    : incident.status === 'PENDING_VERIFICATION' ? 'info'
    : incident.status === 'IN_PROGRESS' ? 'info'
    : 'warning';

  const isResolvedOrClosed = ['RESOLVED', 'CLOSED'].includes(incident.status);

  return (
    <div className="page-container">
      {/* Top Navigation & Feedback */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button className="btn btn-secondary" onClick={() => onNavigate('incidents')}>
          ← Back to Incidents
        </button>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Optimistic Version: <strong>v{incident.version || 1}</strong>
          </span>
          <button className="btn btn-secondary" onClick={loadIncidentData} style={{ padding: '4px 10px', fontSize: '12px' }}>
            Refresh
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '16px' }}>
          {successMsg}
          <button onClick={() => setSuccessMsg(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Incident Header Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <StatusBadge type={statusType}>{incident.status}</StatusBadge>
              <StatusBadge type={priorityType}>{incident.priority} PRIORITY</StatusBadge>
              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
                {incident.incident_id}
              </span>
            </div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>{incident.title}</h2>
          </div>

          {/* Quick Lifecycle Actions */}
          {!isCompliance && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {incident.status === 'OPEN' && (
                <>
                  <button
                    id="btn-start-investigation"
                    className="btn btn-primary"
                    onClick={() => handleStatusTransition('IN_PROGRESS', 'Analyst initiated investigation')}
                  >
                    Start Investigation
                  </button>
                  {isAdmin && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleStatusTransition('CLOSED', 'Closed by admin from OPEN')}
                    >
                      Close (No Remediation)
                    </button>
                  )}
                </>
              )}

              {incident.status === 'IN_PROGRESS' && (
                <>
                  <button
                    id="btn-request-verification"
                    className="btn btn-secondary"
                    onClick={() => handleStatusTransition('PENDING_VERIFICATION', 'Remediation completed; awaiting validation')}
                  >
                    Request Verification
                  </button>
                  <button
                    id="btn-resolve-incident"
                    className="btn btn-primary"
                    onClick={() => setShowResolveModal(true)}
                  >
                    Resolve Incident
                  </button>
                </>
              )}

              {incident.status === 'PENDING_VERIFICATION' && (
                <>
                  <button
                    id="btn-record-verification"
                    className="btn btn-secondary"
                    onClick={() => setShowVerifyModal(true)}
                  >
                    Record Verification Check
                  </button>
                  <button
                    id="btn-resolve-verified-incident"
                    className="btn btn-primary"
                    onClick={() => setShowResolveModal(true)}
                  >
                    Confirm Resolution
                  </button>
                </>
              )}

              {incident.status === 'RESOLVED' && (
                <>
                  <button
                    id="btn-close-incident"
                    className="btn btn-secondary"
                    onClick={() => handleStatusTransition('CLOSED', 'Operational review completed')}
                  >
                    Close Incident
                  </button>
                  <button
                    id="btn-reopen-incident"
                    className="btn btn-secondary"
                    onClick={() => setShowReopenModal(true)}
                  >
                    Reopen Incident
                  </button>
                </>
              )}

              {incident.status === 'CLOSED' && isAdmin && (
                <button
                  id="btn-reopen-closed-incident"
                  className="btn btn-secondary"
                  onClick={() => setShowReopenModal(true)}
                >
                  Admin Reopen
                </button>
              )}
            </div>
          )}
        </div>

        {/* Description & Metadata */}
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>Incident Context</h4>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            {incident.description}
          </p>

          {incident.resolution_summary && (
            <div className="alert alert-success" style={{ marginTop: '12px' }}>
              <strong>Resolution Summary:</strong> {incident.resolution_summary}
              <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
                Resolved At: {new Date(incident.resolved_at).toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Assignee & Dates Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Reported By</span>
            <strong>{incident.created_user_name || 'System Analyst'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Created At</span>
            <span>{new Date(incident.created_at).toLocaleString()}</span>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Last Updated</span>
            <span>{new Date(incident.updated_at).toLocaleString()}</span>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Current Assignee</span>
            {!isCompliance && !isResolvedOrClosed ? (
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <select
                  id="select-assignee"
                  className="form-input"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                >
                  <option value="">-- Unassigned --</option>
                  {assignees.map(a => (
                    <option key={a.user_id} value={a.user_id}>
                      {a.display_name} ({a.role})
                    </option>
                  ))}
                </select>
                <button
                  id="btn-confirm-assign"
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                  onClick={handleAssign}
                  disabled={updatingAssignee || selectedAssignee === incident.assigned_to}
                >
                  Save
                </button>
              </div>
            ) : (
              <strong>{incident.assigned_user_name || 'Unassigned'}</strong>
            )}
          </div>
        </div>
      </div>

      {/* Associated Findings Table */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0 }}>Associated Exposure Findings ({incident.findings?.length || 0})</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Evidence items grouped under this response incident.
            </p>
          </div>
          {!isCompliance && !isResolvedOrClosed && (
            <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={openAddFindingModal}>
              + Link Another Finding
            </button>
          )}
        </div>

        {incident.findings?.length === 0 ? (
          <div className="alert alert-warning">No findings are currently associated with this incident.</div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Category</th>
                  <th>Masked Secret Excerpt</th>
                  <th>File / Location</th>
                  <th>Finding Status</th>
                  {!isCompliance && !isResolvedOrClosed && <th style={{ textAlign: 'right' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {incident.findings.map(f => {
                  const sevType = f.severity?.toLowerCase() === 'critical' || f.severity?.toLowerCase() === 'high' ? 'danger'
                    : f.severity?.toLowerCase() === 'medium' ? 'warning' : 'neutral';

                  return (
                    <tr key={f.finding_id}>
                      <td><StatusBadge type={sevType}>{f.severity}</StatusBadge></td>
                      <td>
                        <strong>{f.category}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{f.rule_name}</div>
                      </td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--status-warning)' }}>
                        {f.masked_excerpt}
                      </td>
                      <td>
                        <div>{f.original_filename}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                          {f.location_reference}
                        </div>
                      </td>
                      <td>
                        <StatusBadge type={f.status === 'remediated' ? 'success' : 'info'}>
                          {f.status}
                        </StatusBadge>
                      </td>
                      {!isCompliance && !isResolvedOrClosed && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '2px 8px', fontSize: '11px', color: 'var(--status-danger)' }}
                            onClick={() => handleDisassociate(f.finding_id)}
                          >
                            Unlink
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Remediation Work & Activity Timeline Section */}
      <div style={{ display: 'grid', gridTemplateColumns: !isCompliance && !isResolvedOrClosed ? '1fr 1fr' : '1fr', gap: '20px' }}>
        {/* Action Form */}
        {!isCompliance && !isResolvedOrClosed && (
          <div className="card">
            <h3>Record Remediation Action</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Log investigative discoveries, key rotations, or containment actions.
            </p>

            <form onSubmit={handleAddAction} style={{ marginTop: '12px' }}>
              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Action Classification</label>
                <select
                  id="select-action-type"
                  className="form-input"
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                >
                  <option value="INVESTIGATION">Investigation Discovery</option>
                  <option value="REMEDIATION">Remediation / Key Rotation</option>
                  <option value="COMMENT">Analyst Comment</option>
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Remediation Notes</label>
                <textarea
                  id="input-action-notes"
                  className="form-input"
                  rows={4}
                  placeholder="Record what defensive steps were taken (e.g. Revoked compromised key in AWS console, updated deployment secret manager)."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  required
                />
              </div>

              <button
                id="btn-log-action"
                type="submit"
                className="btn btn-primary"
                disabled={submittingAction || !actionNotes.trim()}
              >
                {submittingAction ? 'Logging...' : 'Log Remediation Action'}
              </button>
            </form>
          </div>
        )}

        {/* Activity Timeline */}
        <div className="card">
          <h3>Activity & Remediation Timeline</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Tamper-evident record of actions and status changes.
          </p>

          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '450px', overflowY: 'auto' }}>
            {actions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No actions recorded yet.</p>
            ) : (
              actions.map((act) => (
                <div
                  key={act.action_id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    borderLeft: `3px solid ${
                      act.action_type === 'RESOLUTION' ? 'var(--status-success)'
                      : act.action_type === 'VERIFICATION' ? '#a855f7'
                      : act.action_type === 'REOPENED' ? 'var(--status-warning)'
                      : 'var(--accent-cyan)'
                    }`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="badge" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                        {act.action_type}
                      </span>
                      <strong style={{ fontSize: '12px' }}>{act.user_name}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({act.user_role})</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(act.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {act.notes}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Verification Modal */}
      {showVerifyModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <h3>Record Independent Verification Check</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Confirm whether the reported secret was rotated and is no longer accessible.
            </p>

            <form onSubmit={handleRecordVerification} style={{ marginTop: '16px' }}>
              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Verification Outcome</label>
                <select
                  id="select-verification-outcome"
                  className="form-input"
                  value={verifyOutcome}
                  onChange={(e) => setVerifyOutcome(e.target.value)}
                >
                  <option value="PASSED">PASSED (Key revocation verified inactive)</option>
                  <option value="FAILED">FAILED (Key is still active; re-work required)</option>
                  <option value="NEEDS_MORE_WORK">NEEDS_MORE_WORK (Partial mitigation; additional rotation needed)</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Verification Evidence & Notes</label>
                <textarea
                  id="input-verification-summary"
                  className="form-input"
                  rows={4}
                  placeholder="Document how verification was performed (e.g. Executed aws sts get-caller-identity with old key; returned AccessDenied)."
                  value={verifySummary}
                  onChange={(e) => setVerifySummary(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowVerifyModal(false)}
                  disabled={submittingVerify}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-verification"
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingVerify || !verifySummary.trim()}
                >
                  {submittingVerify ? 'Recording...' : 'Record Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolution Modal */}
      {showResolveModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h3 style={{ color: 'var(--status-success)' }}>Resolve Security Incident</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              This will atomically commit status transition to RESOLVED, update all {incident.findings?.length} associated
              findings to 'remediated', log remediation action, and record immutable audit telemetry via <code>sp_resolve_incident</code>.
            </p>

            <form onSubmit={handleResolve} style={{ marginTop: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Final Resolution Summary <span style={{ color: 'var(--status-danger)' }}>*</span></label>
                <textarea
                  id="input-resolution-summary"
                  className="form-input"
                  rows={4}
                  placeholder="Summarize the remediation root-cause, key rotation steps completed, and validation results (e.g. AWS access key rotated, git repository commit rewritten to purge history, verified zero subsequent API calls)."
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowResolveModal(false)}
                  disabled={submittingResolve}
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-resolve"
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingResolve || resolutionSummary.trim().length < 5}
                  style={{ backgroundColor: 'var(--status-success)' }}
                >
                  {submittingResolve ? 'Executing Transaction...' : 'Commit Atomic Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <h3 style={{ color: 'var(--status-warning)' }}>Reopen Incident</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Reopen this incident to IN_PROGRESS. Mandatory justification is required for audit compliance.
            </p>

            <form onSubmit={handleReopen} style={{ marginTop: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Reopening Justification <span style={{ color: 'var(--status-danger)' }}>*</span></label>
                <textarea
                  id="input-reopen-justification"
                  className="form-input"
                  rows={4}
                  placeholder="Explain why this incident is being reopened (e.g. Additional secondary exposure identified in subsidiary repository)."
                  value={reopenJustification}
                  onChange={(e) => setReopenJustification(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowReopenModal(false)}
                  disabled={submittingReopen}
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-reopen"
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingReopen || reopenJustification.trim().length < 5}
                  style={{ backgroundColor: 'var(--status-warning)', color: '#000' }}
                >
                  {submittingReopen ? 'Reopening...' : 'Confirm Reopen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Another Finding Modal */}
      {showAddFindingModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <h3>Link Additional Finding</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Select an unassociated finding to link into this incident case.
            </p>

            {loadingUnassociated ? (
              <div className="state-center" style={{ minHeight: '120px' }}>
                <div className="spinner" />
              </div>
            ) : unassociatedFindings.length === 0 ? (
              <div className="alert alert-info">No unassociated findings available to attach.</div>
            ) : (
              <div style={{ maxHeight: '250px', overflowY: 'auto', marginTop: '12px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>Category</th>
                      <th>Masked Excerpt</th>
                      <th>File</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unassociatedFindings.map(f => (
                      <tr key={f.finding_id}>
                        <td><StatusBadge type={f.severity === 'high' || f.severity === 'critical' ? 'danger' : 'warning'}>{f.severity}</StatusBadge></td>
                        <td>{f.category}</td>
                        <td style={{ fontFamily: 'monospace' }}>{f.masked_excerpt}</td>
                        <td>{f.original_filename}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '2px 8px', fontSize: '11px' }}
                            onClick={() => handleAssociate(f.finding_id)}
                          >
                            Attach
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddFindingModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default IncidentDetailPage;
