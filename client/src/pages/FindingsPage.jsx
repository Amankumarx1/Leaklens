import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [confidenceFilter, setConfidenceFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState('none'); // 'none' | 'file' | 'category'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeFinding, setActiveFinding] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const isCompliance = user?.role === 'COMPLIANCE_REVIEWER';

  const fetchFindingsList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (severityFilter) params.severity = severityFilter;
      if (confidenceFilter) params.confidence = confidenceFilter;
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
  }, [severityFilter, confidenceFilter, categoryFilter, statusFilter]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const params = {};
        if (severityFilter) params.severity = severityFilter;
        if (confidenceFilter) params.confidence = confidenceFilter;
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
  }, [severityFilter, confidenceFilter, categoryFilter, statusFilter]);

  const handleEscalate = (findingId) => {
    onNavigate('incidents-new', findingId);
  };

  const handleEscalateSelected = () => {
    if (selectedIds.size === 0) return;
    const firstId = Array.from(selectedIds)[0];
    onNavigate('incidents-new', firstId);
  };

  // Filter client-side by text search across filename, rule_name, excerpt, location, field_path, finding_id
  const filteredFindings = useMemo(() => {
    return findings.filter(f => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const idMatch = (f.finding_id || '').toLowerCase().includes(q);
      const nameMatch = (f.original_filename || '').toLowerCase().includes(q);
      const ruleMatch = (f.rule_name || '').toLowerCase().includes(q);
      const excerptMatch = (f.masked_excerpt || '').toLowerCase().includes(q);
      const locMatch = (f.location_reference || '').toLowerCase().includes(q);
      const fieldMatch = (f.field_path || '').toLowerCase().includes(q);
      const catMatch = (f.category || '').toLowerCase().includes(q);
      return idMatch || nameMatch || ruleMatch || excerptMatch || locMatch || fieldMatch || catMatch;
    });
  }, [findings, searchQuery]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredFindings.length / pageSize));
  const paginatedFindings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFindings.slice(start, start + pageSize);
  }, [filteredFindings, currentPage]);

  // Grouped findings calculation
  const groupedData = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups = {};
    for (const f of filteredFindings) {
      const key = groupBy === 'file' 
        ? (f.original_filename || 'Unknown File')
        : (f.category || 'General Exposure');
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    }
    return groups;
  }, [filteredFindings, groupBy]);

  const hasActiveFilters = Boolean(severityFilter || confidenceFilter || categoryFilter || statusFilter || searchQuery);

  const handleClearFilters = () => {
    setSeverityFilter('');
    setConfidenceFilter('');
    setCategoryFilter('');
    setStatusFilter('');
    setSearchQuery('');
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedFindings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedFindings.map(f => f.finding_id)));
    }
  };

  const toggleSelectOne = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderFindingsTable = (items) => (
    <div className="data-table-container">
      <table className="data-table">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
            <th style={{ width: '36px', padding: '12px 8px', textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={items.length > 0 && items.every(f => selectedIds.has(f.finding_id))}
                onChange={toggleSelectAll}
                title="Select all on current page"
              />
            </th>
            <th style={{ padding: '12px 14px' }}>Category</th>
            <th style={{ padding: '12px 14px' }}>Severity</th>
            <th style={{ padding: '12px 14px' }}>Confidence</th>
            <th style={{ padding: '12px 14px' }}>Masked Excerpt</th>
            <th style={{ padding: '12px 14px' }}>Location / Field Path</th>
            <th style={{ padding: '12px 14px' }}>Target File</th>
            <th style={{ padding: '12px 14px' }}>Status</th>
            <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((f) => (
            <tr
              key={f.finding_id}
              id={`finding-row-${f.finding_id}`}
              style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
              onClick={() => setActiveFinding(f)}
              className="hover-row"
            >
              <td style={{ padding: '12px 8px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(f.finding_id)}
                  onChange={(e) => toggleSelectOne(f.finding_id, e)}
                />
              </td>
              <td style={{ padding: '12px 14px', fontWeight: '500' }}>
                {f.category}
              </td>
              <td style={{ padding: '12px 14px' }}>
                <StatusBadge type={f.severity === 'critical' ? 'danger' : f.severity === 'high' ? 'warning' : 'info'}>
                  {f.severity.toUpperCase()}
                </StatusBadge>
              </td>
              <td style={{ padding: '12px 14px' }}>
                <StatusBadge type={f.confidence === 'high' ? 'healthy' : f.confidence === 'medium' ? 'warning' : 'neutral'}>
                  {(f.confidence || 'high').toUpperCase()}
                </StatusBadge>
              </td>
              <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                <code style={{ background: 'var(--bg-app)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  {f.masked_excerpt}
                </code>
              </td>
              <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-cyan)' }}>
                {f.field_path ? (
                  <span title={`Location: ${f.location_reference}`}>{f.field_path}</span>
                ) : (
                  f.location_reference
                )}
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
  );

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Sensitive-Data Findings Register</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Modular detection results with separate severity and confidence metrics, checksum validation, and locational coordinates.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {selectedIds.size > 0 && !isCompliance && (
              <button
                id="btn-findings-escalate-selected"
                className="btn btn-primary"
                onClick={handleEscalateSelected}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                Create Incident ({selectedIds.size})
              </button>
            )}

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
          background: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'var(--glass-blur-light)',
          padding: '12px 18px',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '20px',
          border: '1px solid rgba(255, 255, 255, 0.85)',
          boxShadow: 'var(--shadow-glass-sm)'
        }}>
          {/* Text Search Input */}
          <div style={{ flex: 1, minWidth: '220px' }}>
            <input
              id="input-findings-search"
              type="text"
              className="input"
              placeholder="Search by rule, file, excerpt, location, ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '13px'
              }}
            />
          </div>

          {/* Severity Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Severity:</span>
            <select
              id="select-finding-severity"
              className="input"
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: 'auto',
                padding: '8px 14px',
                borderRadius: 'var(--radius-pill)',
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

          {/* Confidence Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Confidence:</span>
            <select
              id="select-finding-confidence"
              className="input"
              value={confidenceFilter}
              onChange={(e) => {
                setConfidenceFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: 'auto',
                padding: '8px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '13px'
              }}
            >
              <option value="">All Confidences</option>
              <option value="high">High Confidence</option>
              <option value="medium">Medium Confidence</option>
              <option value="low">Low Confidence</option>
            </select>
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Category:</span>
            <select
              id="select-finding-category"
              className="input"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: 'auto',
                padding: '8px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '13px'
              }}
            >
              <option value="">All Categories</option>
              <option value="CLOUD_CREDENTIAL">Cloud Credentials & API Tokens</option>
              <option value="PASSWORD_CREDENTIAL">Passwords & Hardcoded Secrets</option>
              <option value="PRIVATE_KEY_MARKER">Private Key Markers</option>
              <option value="JWT_BEARER_TOKEN">JWT & Bearer Tokens</option>
              <option value="DATABASE_CONNECTION_STRING">Database Connection Strings</option>
              <option value="EMAIL_ADDRESS">Email Addresses</option>
              <option value="TELEPHONE_NUMBER">Telephone Numbers</option>
              <option value="PERSONAL_IDENTIFIER">Personal Identifiers (PAN/Aadhaar/UPI)</option>
              <option value="FINANCIAL_IDENTIFIER">Financial Identifiers (Payment Cards)</option>
              <option value="CONFIDENTIAL_CONFIG">Confidential Configuration</option>
              <option value="HIGH_ENTROPY_SECRET">High-Entropy Secrets</option>
              <option value="API_KEY_CANDIDATE">Candidate API Keys</option>
              <option value="SENSITIVE_IDENTIFIER">Internal Asset Identifiers</option>
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
            <select
              id="select-finding-status"
              className="input"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: 'auto',
                padding: '8px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '13px'
              }}
            >
              <option value="">All Statuses</option>
              <option value="detected">Detected</option>
              <option value="confirmed">Confirmed</option>
              <option value="remediated">Remediated</option>
            </select>
          </div>

          {/* Grouping Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>View:</span>
            <select
              id="select-finding-groupby"
              className="input"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              style={{
                width: 'auto',
                padding: '8px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '13px'
              }}
            >
              <option value="none">Flat View</option>
              <option value="file">Group by File</option>
              <option value="category">Group by Category</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              id="btn-findings-clear-filters"
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '6px 14px' }}
              onClick={handleClearFilters}
            >
              Clear Filters
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            Showing {filteredFindings.length} of {findings.length} findings
          </div>
        </div>

        {/* Findings Table or Grouped View */}
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
        ) : groupBy !== 'none' && groupedData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {Object.entries(groupedData).map(([groupTitle, groupItems]) => (
              <div key={groupTitle} className="panel" style={{ background: 'rgba(255,255,255,0.4)', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 700 }}>
                    {groupTitle} ({groupItems.length})
                  </h4>
                </div>
                {renderFindingsTable(groupItems)}
              </div>
            ))}
          </div>
        ) : (
          <>
            {renderFindingsTable(paginatedFindings)}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '16px',
                padding: '8px 4px',
                fontSize: '13px',
                color: 'var(--text-secondary)'
              }}>
                <div>
                  Page {currentPage} of {totalPages} ({filteredFindings.length} items)
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >
                    ← Previous
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
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
