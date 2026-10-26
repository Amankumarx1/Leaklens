import { useState, useEffect, useCallback } from 'react';
import { getHealthStatus } from '../services/api';

/**
 * Hook to monitor LeakLens backend & database health.
 */
export function useHealth(autoRefreshIntervalMs = 15000) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await getHealthStatus();
      if (res && res.success) {
        setHealth(res.data);
        setError(null);
      }
    } catch (err) {
      setError(err.message);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initialFetch() {
      try {
        const res = await getHealthStatus();
        if (isMounted && res && res.success) {
          setHealth(res.data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setHealth(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initialFetch();

    if (autoRefreshIntervalMs > 0) {
      const interval = setInterval(fetchHealth, autoRefreshIntervalMs);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }

    return () => {
      isMounted = false;
    };
  }, [fetchHealth, autoRefreshIntervalMs]);

  return { health, loading, error, refetch: fetchHealth };
}

export default useHealth;
