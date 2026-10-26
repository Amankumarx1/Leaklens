import React, { useState, useEffect, useCallback } from 'react';
import { getFindings } from '../services/api';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import StatusBadge from '../components/StatusBadge';
import FindingDetailModal from '../components/FindingDetailModal';

export function FindingsPage({ onNavigate, user }) {
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFinding, setActiveFinding] = useState(null);

  const isCompliance = user?.role === 'COMPLIANCE_REVIEWER';

  const fetchFindingsList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (severityFilter) params.severity = severityFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await getFindings(params);
      if (res?.success) {
        setFindings(res.data?.findings || res.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load findings.');
    } finally {
      setLoading(false);
    }
  }, [severityFilter, categoryFilter, statusFilter]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const params = {};
        if (severityFilter) params.severity = severityFilter;
        if (categoryFilter) params.category = categoryFilter;
        if (statusFilter) params.status = statusFilter;

        const res = await getFindings(params);
        if (!ignore && res?.success) {
          setFindings(res.data?.findings || res.data || []);
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load findings.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, [severityFilter, categoryFilter, statusFilter]);

  const handleEscalate = (findingId) => {
    onNavigate('incidents-new', findingId);
  };

  // Filter client-side by text search across filename, rule_name, excerpt, location
  const filteredFindings = findings.filter(f => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = (f.original_filename || '').toLowerCase().includes(q);
    const ruleMatch = (f.rule_name || '').toLowerCase().includes(q);
    const excerptMatch = (f.masked_excerpt || '').toLowerCase().includes(q);
    const locMatch = (f.location_reference || '').toLowerCase().includes(q);
    const catMatch = (f.category || '').toLowerCase().includes(q);
    return nameMatch || ruleMatch || excerptMatch || locMatch || catMatch;
  });

  const hasActiveFilters = Boolean(severityFilter || categoryFilter || statusFilter || searchQuery);

  const handleClearFilters = () => {
    setSeverityFilter('');
    setCategoryFilter('');
    setStatusFilter('');
    setSearchQuery('');
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Sensitive-Data Findings Register</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Persisted detection results with cryptographic masking and locational coordinates.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              id="btn-findings-refresh"
              className="btn btn-secondary" 
              onClick={fetchFindingsList}
              disabled={loading}
              title="Refresh findings list"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'var(--bg-app)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          border: '1px solid var(--border-subtle)'
        }}>
          {/* Text Search Input */}
          <div style={{ flex: 1, minWidth: '220px' }}>
            <input
              id="input-findings-search"
              type="text"
              placeholder="Search by rule, file, excerpt, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>

          {/* Severity Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Severity:</span>
            <select
              id="select-finding-severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px'
              }}
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Category:</span>
            <select
              id="select-finding-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px'
              }}
            >
              <option value="">All Categories</option>
              <option value="EMAIL_ADDRESS">Email Addresses</option>
              <option value="API_KEY_CANDIDATE">API Keys & Tokens</option>
              <option value="PRIVATE_KEY_MARKER">Private Key Markers</option>
              <option value="SENSITIVE_IDENTIFIER">Sensitive Identifiers</option>
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Status:</span>
            <select
              id="select-finding-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px'
              }}
            >
              <option value="">All Statuses</option>
              <option value="detected">Detected</option>
              <option value="confirmed">Confirmed</option>
              <option value="remediated">Remediated</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              id="btn-findings-clear-filters"
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '4px 10px' }}
              onClick={handleClearFilters}
            >
              Clear Filters
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing {filteredFindings.length} of {findings.length} findings
          </div>
        </div>

        {/* Findings Table */}
        {loading && findings.length === 0 ? (
          <LoadingState message="Loading persisted findings..." />
        ) : error && findings.length === 0 ? (
          <ErrorState title="Failed to Load Findings" message={error} onRetry={fetchFindingsList} />
        ) : filteredFindings.length === 0 ? (
          <EmptyState
            title={findings.length === 0 ? "No Findings Recorded" : "No Matching Findings"}
            description={
              hasActiveFilters
                ? 'No exposure findings match your current search and filter selections.'
                : 'No exposure findings have been recorded yet. Initiate an authorized scan to evaluate files.'
            }
            actionText={hasActiveFilters ? "Clear Filters" : "Initiate File Scan"}
            onAction={hasActiveFilters ? handleClearFilters : () => onNavigate('scans-new')}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 14px' }}>Category</th>
                  <th style={{ padding: '12px 14px' }}>Severity</th>
                  <th style={{ padding: '12px 14px' }}>Masked Excerpt</th>
                  <th style={{ padding: '12px 14px' }}>Location</th>
                  <th style={{ padding: '12px 14px' }}>Target File</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFindings.map((f) => (
                  <tr
                    key={f.finding_id}
                    id={`finding-row-${f.finding_id}`}
                    style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                    onClick={() => setActiveFinding(f)}
                    className="hover-row"
                  >
                    <td style={{ padding: '12px 14px', fontWeight: '500' }}>
                      {f.category}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <StatusBadge type={f.severity === 'critical' ? 'danger' : f.severity === 'high' ? 'warning' : 'info'}>
                        {f.severity.toUpperCase()}
                      </StatusBadge>
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      <code style={{ background: 'var(--bg-app)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                        {f.masked_excerpt}
                      </code>
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-cyan)' }}>
                      {f.location_reference}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                      {f.original_filename || 'File'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <StatusBadge type={f.status === 'remediated' ? 'healthy' : f.status === 'confirmed' ? 'warning' : 'info'}>
                        {f.status || 'detected'}
                      </StatusBadge>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        id={`btn-inspect-finding-${f.finding_id}`}
                        className="btn btn-secondary"
                        style={{ fontSize: '11px', padding: '3px 8px', marginRight: '6px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveFinding(f);
                        }}
                      >
                        Inspect
                      </button>
                      {!isCompliance && f.status !== 'remediated' && (
                        <button
                          id={`btn-escalate-${f.finding_id}`}
                          className="btn btn-primary"
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEscalate(f.finding_id);
                          }}
                        >
                          Escalate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Finding Detail Modal */}
      {activeFinding && (
        <FindingDetailModal
          finding={activeFinding}
          onClose={() => setActiveFinding(null)}
          onEscalate={!isCompliance && activeFinding.status !== 'remediated' ? () => handleEscalate(activeFinding.finding_id) : undefined}
        />
      )}
    </div>
  );
}

export default FindingsPage;
