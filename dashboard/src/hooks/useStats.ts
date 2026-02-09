import { useAutoRefresh } from './useAutoRefresh';
import { fetchIssueStats, fetchPlatformStats } from '../api/endpoints';
import { REFRESH_INTERVAL_MS } from '../utils/constants';
import type { IssueStats, PlatformStats } from '../api/types';

interface CombinedStats {
  issueStats: IssueStats;
  platformStats: PlatformStats;
}

export function useStats() {
  return useAutoRefresh<CombinedStats>(async () => {
    const [issueStats, platformStats] = await Promise.all([
      fetchIssueStats(),
      fetchPlatformStats(),
    ]);
    return { issueStats, platformStats };
  }, REFRESH_INTERVAL_MS);
}
