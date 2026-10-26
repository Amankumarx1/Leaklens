/**
 * Shared API Client for LeakLens
 * Configured via Vite environment variable VITE_API_URL
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Generic JSON request wrapper with consistent error normalization.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
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
      const networkErr = new Error('Unable to connect to LeakLens Backend API. Ensure server is running on ' + API_BASE_URL);
      networkErr.code = 'NETWORK_UNAVAILABLE';
      throw networkErr;
    }
    throw err;
  }
}

/**
 * Fetches backend operational health status.
 */
export async function getHealthStatus() {
  return request('/health');
}

/**
 * Helper to query placeholder modules.
 */
export async function getModuleStatus(moduleSlug) {
  return request(`/${moduleSlug}`);
}

export default {
  getHealthStatus,
  getModuleStatus,
  API_BASE_URL
};
