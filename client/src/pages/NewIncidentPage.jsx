import React, { useState, useEffect } from 'react';
import StatusBadge from '../components/StatusBadge';
import { createIncident, getUnassociatedFindings } from '../services/api';

export function NewIncidentPage({ user, onNavigate, initialFindingId = null }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('HIGH');
  const [availableFindings, setAvailableFindings] = useState([]);
  const [selectedFindingIds, setSelectedFindingIds] = useState(
    initialFindingId ? [initialFindingId] : []
  );

  const [loadingFindings, setLoadingFindings] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadFindings() {
      try {
        const res = await getUnassociatedFindings();
        if (!ignore && res?.success && res?.data?.findings) {
          setAvailableFindings(res.data.findings);
          if (initialFindingId) {
            setSelectedFindingIds(prev => (!prev.includes(initialFindingId) ? [...prev, initialFindingId] : prev));
          }
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load available findings.');
      } finally {
        if (!ignore) setLoadingFindings(false);
      }
    }

    loadFindings();
    return () => { ignore = true; };
  }, [initialFindingId]);

  const handleToggleFinding = (id) => {
    setSelectedFindingIds(prev =>
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 3) {
      setError('Incident title must be at least 3 characters.');
      return;
    }
    if (!description.trim()) {
      setError('Incident description is required.');
      return;
    }
    if (selectedFindingIds.length === 0) {
      setError('You must select at least one finding to associate with the incident.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await createIncident({
        title: title.trim(),
        description: description.trim(),
        priority,
        findingIds: selectedFindingIds
      });

      if (res?.success && res?.data?.incident) {
        const createdId = res.data.incident.incident_id;
        onNavigate('incident-detail', createdId);
      } else {
        throw new Error('Unexpected response format from server.');
      }
    } catch (err) {
      setError(err.message || 'Failed to create security incident.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '20px' }}>
        <button
          className="btn btn-secondary"
          onClick={() => onNavigate('incidents')}
          style={{ marginBottom: '12px' }}
        >
          ← Back to Incidents
        </button>
        <h2>Create Security Incident</h2>
        <p>Escalate detected exposures into a formal response ticket, assign an SLA priority, and initiate investigation.</p>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '16px' }}>1. Incident Details</h3>

          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">
              Incident Title <span style={{ color: 'var(--status-danger)' }}>*</span>
            </label>
            <input
              id="input-incident-title"
              type="text"
              className="form-input"
              placeholder="e.g. Production AWS Access Key Exposure in Billing Service"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label className="form-label">
                Priority Classification <span style={{ color: 'var(--status-danger)' }}>*</span>
              </label>
              <select
                id="select-incident-priority"
                className="form-input"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={submitting}
              >
                <option value="CRITICAL">CRITICAL (Immediate containment, 1h SLA)</option>
                <option value="HIGH">HIGH (High privilege, 4h SLA)</option>
                <option value="MEDIUM">MEDIUM (Standard triage, 24h SLA)</option>
                <option value="LOW">LOW (Low impact, 72h SLA)</option>
              </select>
            </div>

            <div>
              <label className="form-label">Reporting Identity</label>
              <input
                type="text"
                className="form-input"
                value={`${user?.display_name || 'Current User'} (${user?.role || 'ANALYST'})`}
                disabled
                style={{ opacity: 0.7, backgroundColor: 'var(--bg-app)' }}
              />
            </div>
          </div>

          <div>
            <label className="form-label">
              Safe Incident Description <span style={{ color: 'var(--status-danger)' }}>*</span>
            </label>
            <textarea
              id="input-incident-description"
              className="form-input"
              rows={4}
              placeholder="Describe the context of exposure, affected systems, and initial observations. Note: Never enter plaintext secrets or private keys."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              required
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              Defensive Policy: Raw secrets are strictly prohibited in ticket descriptions.
            </span>
          </div>
        </div>

        {/* Finding Association Section */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3>2. Associate Detected Findings ({selectedFindingIds.length} Selected)</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Select one or more unassociated findings to link to this response case.
              </p>
            </div>
          </div>

          {loadingFindings ? (
            <div className="state-center" style={{ minHeight: '120px' }}>
              <div className="spinner" />
              <p style={{ color: 'var(--text-secondary)' }}>Loading unassociated findings...</p>
            </div>
          ) : availableFindings.length === 0 && selectedFindingIds.length === 0 ? (
            <div className="alert alert-info">
              No unassociated findings available in the database. Scan a file first to detect findings.
            </div>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>Select</th>
                    <th>Severity</th>
                    <th>Category</th>
                    <th>Masked Excerpt</th>
                    <th>File / Location</th>
                    <th>Detected</th>
                  </tr>
                </thead>
                <tbody>
                  {availableFindings.map(f => {
                    const isSelected = selectedFindingIds.includes(f.finding_id);
                    const sev = f.severity?.toLowerCase() === 'critical' || f.severity?.toLowerCase() === 'high' ? 'danger'
                      : f.severity?.toLowerCase() === 'medium' ? 'warning' : 'neutral';

                    return (
                      <tr
                        key={f.finding_id}
                        onClick={() => handleToggleFinding(f.finding_id)}
                        style={{ cursor: 'pointer', backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.08)' : undefined }}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by row click
                          />
                        </td>
                        <td><StatusBadge type={sev}>{f.severity}</StatusBadge></td>
                        <td>{f.category}</td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--status-warning)' }}>
                          {f.masked_excerpt}
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <div>{f.original_filename}</div>
                          <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{f.location_reference}</div>
                        </td>
                        <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(f.detected_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Submission Controls */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate('incidents')}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            id="btn-submit-incident"
            type="submit"
            className="btn btn-primary"
            disabled={submitting || selectedFindingIds.length === 0}
          >
            {submitting ? 'Creating Incident...' : 'Create Incident & Associate Findings'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewIncidentPage;
