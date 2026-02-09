import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchIssues } from '../api/endpoints';
import { ITEMS_PER_PAGE, REFRESH_INTERVAL_MS } from '../utils/constants';
import type { Issue, SortOption } from '../api/types';

export interface Filters {
  category: string;
  status: string;
  search: string;
  sortBy: SortOption;
}

export function useIssues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    category: '',
    status: '',
    search: '',
    sortBy: 'newest',
  });
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const doFetch = useCallback(async (currentFilters: Filters, currentPage: number) => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        skip: (currentPage - 1) * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
        sort_by: currentFilters.sortBy,
      };
      if (currentFilters.category) params.category = currentFilters.category;
      if (currentFilters.status) params.status = currentFilters.status;
      if (currentFilters.search) params.search = currentFilters.search;

      const data = await fetchIssues(params as any);
      setIssues(data);
      setHasMore(data.length === ITEMS_PER_PAGE);
    } catch (err) {
      console.error('Failed to fetch issues:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    doFetch(filters, page);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => doFetch(filters, page), REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [filters, page, doFetch]);

  const updateFilters = useCallback((newFilters: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  return { issues, loading, page, setPage, hasMore, filters, updateFilters };
}
