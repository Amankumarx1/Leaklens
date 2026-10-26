/**
 * Shared API Client for LeakLens
 * Communicates with the Express backend using HttpOnly cookie credentials and JWT bearer fallback.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

let authToken = localStorage.getItem('leaklens_token') || null;

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('leaklens_token', token);
  } else {
    localStorage.removeItem('leaklens_token');
  }
}

export function getAuthToken() {
  return authToken;
}

/**
 * Generic request wrapper supporting cookies, Authorization header, and JSON/FormData payloads.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = { ...options.headers };

  if (authToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  // Do not set Content-Type for FormData; browser sets boundary automatically
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    credentials: 'include', // Send and receive HttpOnly cookies
    ...options,
    headers
  };

  try {
    const res = await fetch(url, config);
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = body?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      const err = new Error(errorMsg);
      err.status = res.status;
      err.code = body?.error?.code || 'FETCH_ERROR';
      err.details = body?.error?.details;
      throw err;
    }

    return body;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
      const networkErr = new Error(`Unable to connect to LeakLens API at ${API_BASE_URL}`);
      networkErr.code = 'NETWORK_UNAVAILABLE';
      throw networkErr;
    }
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Authentication Endpoints
// -----------------------------------------------------------------------------
export async function login(email, password) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  if (res?.data?.token) {
    setAuthToken(res.data.token);
  }
  return res;
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' });
  } finally {
    setAuthToken(null);
  }
}

export async function getProfile() {
  return request('/auth/me');
}

// -----------------------------------------------------------------------------
// Health & Diagnostics
// -----------------------------------------------------------------------------
export async function getHealthStatus() {
  return request('/health');
}

// -----------------------------------------------------------------------------
// Scans & Ingestion
// -----------------------------------------------------------------------------
export async function uploadAndScanFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  return request('/scans', {
    method: 'POST',
    body: formData
  });
}

export async function getScans(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/scans${query ? `?${query}` : ''}`);
}

export async function getScanById(scanId) {
  return request(`/scans/${scanId}`);
}

export async function getScanFindings(scanId) {
  return request(`/scans/${scanId}/findings`);
}

export async function clearAllScanData() {
  return request('/scans/clear', {
    method: 'POST'
  });
}

// -----------------------------------------------------------------------------
// Findings & Redaction
// -----------------------------------------------------------------------------
export async function getFindings(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/findings${query ? `?${query}` : ''}`);
}

export async function getFindingById(findingId) {
  return request(`/findings/${findingId}`);
}

// -----------------------------------------------------------------------------
// Incident Management & Remediation
// -----------------------------------------------------------------------------
export async function getIncidents(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/incidents${query ? `?${query}` : ''}`);
}

export async function getIncidentById(incidentId) {
  return request(`/incidents/${incidentId}`);
}

export async function createIncident(data) {
  return request('/incidents', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function assignIncident(incidentId, assignedTo) {
  return request(`/incidents/${incidentId}/assignment`, {
    method: 'PATCH',
    body: JSON.stringify({ assignedTo })
  });
}

export async function updateIncidentStatus(incidentId, status, reason = '', expectedVersion = null) {
  return request(`/incidents/${incidentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason, expectedVersion })
  });
}

export async function addIncidentAction(incidentId, actionType, notes) {
  return request(`/incidents/${incidentId}/actions`, {
    method: 'POST',
    body: JSON.stringify({ actionType, notes })
  });
}

export async function getIncidentActions(incidentId) {
  return request(`/incidents/${incidentId}/actions`);
}

export async function recordIncidentVerification(incidentId, outcome, summary) {
  return request(`/incidents/${incidentId}/verify`, {
    method: 'POST',
    body: JSON.stringify({ outcome, summary })
  });
}

export async function resolveIncident(incidentId, { resolutionSummary, verificationOutcome = 'PASSED', expectedVersion = null }) {
  return request(`/incidents/${incidentId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolutionSummary, verificationOutcome, expectedVersion })
  });
}

export async function reopenIncident(incidentId, justification, expectedVersion = null) {
  return request(`/incidents/${incidentId}/reopen`, {
    method: 'POST',
    body: JSON.stringify({ justification, expectedVersion })
  });
}

export async function associateFindingToIncident(incidentId, findingId) {
  return request(`/incidents/${incidentId}/findings`, {
    method: 'POST',
    body: JSON.stringify({ findingId })
  });
}

export async function disassociateFindingFromIncident(incidentId, findingId, reason = '') {
  return request(`/incidents/${incidentId}/findings/${findingId}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason })
  });
}

export async function getIncidentMetrics() {
  return request('/incidents/metrics');
}

export async function getUnassociatedFindings() {
  return request('/incidents/unassociated-findings');
}

export async function getEligibleAssignees() {
  return request('/incidents/assignees');
}

// -----------------------------------------------------------------------------
// Analytics & Audit
// -----------------------------------------------------------------------------
export async function getDashboardAnalytics() {
  return request('/analytics/dashboard');
}

export async function getAuditLogs(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/audit-logs${query ? `?${query}` : ''}`);
}

// -----------------------------------------------------------------------------
// Azure Cloud Integrations (Admin Only)
// -----------------------------------------------------------------------------
export async function getIntegrations() {
  return request('/admin/integrations');
}

export async function getIntegrationsStatus() {
  return request('/admin/integrations/status');
}

export async function updateIntegrationPreferences(preferences) {
  return request('/admin/integrations/preferences', {
    method: 'PUT',
    body: JSON.stringify(preferences)
  });
}

export async function testSqlIntegration() {
  return request('/admin/integrations/sql/test', {
    method: 'POST'
  });
}

export async function testBlobIntegration() {
  return request('/admin/integrations/blob/test', {
    method: 'POST'
  });
}

export async function testKeyVaultIntegration() {
  return request('/admin/integrations/key-vault/test', {
    method: 'POST'
  });
}

export async function testPowerBiIntegration(reportUrl = null) {
  return request('/admin/integrations/power-bi/test', {
    method: 'POST',
    body: JSON.stringify({ reportUrl })
  });
}

export default {
  login,
  logout,
  getProfile,
  getHealthStatus,
  uploadAndScanFile,
  getScans,
  getScanById,
  getScanFindings,
  clearAllScanData,
  getFindings,
  getFindingById,
  getIncidents,
  getIncidentById,
  createIncident,
  assignIncident,
  updateIncidentStatus,
  addIncidentAction,
  getIncidentActions,
  recordIncidentVerification,
  resolveIncident,
  reopenIncident,
  associateFindingToIncident,
  disassociateFindingFromIncident,
  getIncidentMetrics,
  getUnassociatedFindings,
  getEligibleAssignees,
  getDashboardAnalytics,
  getAuditLogs,
  getIntegrations,
  getIntegrationsStatus,
  updateIntegrationPreferences,
  testSqlIntegration,
  testBlobIntegration,
  testKeyVaultIntegration,
  testPowerBiIntegration,
  setAuthToken,
  getAuthToken,
  API_BASE_URL
};

