import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAutoRefreshResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refreshing: boolean;
  lastUpdated: Date | null;
  refetch: () => void;
}

export function useAutoRefresh<T>(
  fetcher: () => Promise<T>,
  intervalMs: number = 30000
): UseAutoRefreshResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const doFetch = useCallback(async (isBackground = false) => {
    try {
      if (isBackground) setRefreshing(true);
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    doFetch(false);
    intervalRef.current = setInterval(() => doFetch(true), intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [doFetch, intervalMs]);

  return { data, loading, error, refreshing, lastUpdated, refetch: () => doFetch(true) };
}
