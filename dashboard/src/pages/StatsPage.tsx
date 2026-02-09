import { FileText, Clock, Loader, CheckCircle, CalendarDays, Users } from 'lucide-react';
import { useStats } from '../hooks/useStats';
import StatCard from '../components/stats/StatCard';
import CategoryChart from '../components/stats/CategoryChart';
import ResolutionGauge from '../components/stats/ResolutionGauge';
import TopIssuesList from '../components/stats/TopIssuesList';
import RefreshIndicator from '../components/shared/RefreshIndicator';
import LoadingSpinner from '../components/shared/LoadingSpinner';

export default function StatsPage() {
  const { data, loading, refreshing, lastUpdated } = useStats();

  if (loading) return <LoadingSpinner size="lg" />;

  const issue = data?.issueStats;
  const platform = data?.platformStats;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">CivicSense Dashboard</h1>
        <p className="text-gray-500 mt-1">Real-time civic issues tracker for Delhi</p>
        <div className="mt-2">
          <RefreshIndicator lastUpdated={lastUpdated} refreshing={refreshing} />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          label="Total Issues"
          value={issue?.total_issues ?? platform?.total_issues ?? 0}
          icon={FileText}
          color="text-indigo-600"
          bgColor="bg-indigo-50"
        />
        <StatCard
          label="Pending"
          value={issue?.pending ?? platform?.pending_issues ?? 0}
          icon={Clock}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
        <StatCard
          label="In Progress"
          value={issue?.in_progress ?? 0}
          icon={Loader}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatCard
          label="Resolved"
          value={issue?.resolved ?? platform?.resolved_issues ?? 0}
          icon={CheckCircle}
          color="text-green-600"
          bgColor="bg-green-50"
        />
        <StatCard
          label="This Week"
          value={issue?.recent_week ?? 0}
          icon={CalendarDays}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
      </div>

      {/* Second Row: Resolution Gauge + Officials + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <ResolutionGauge
          resolved={issue?.resolved ?? platform?.resolved_issues ?? 0}
          total={issue?.total_issues ?? platform?.total_issues ?? 0}
        />

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center">
          <Users className="w-10 h-10 text-indigo-400 mb-3" />
          <p className="text-4xl font-bold text-gray-900">{platform?.total_officials ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">Government Officials</p>
          <p className="text-xs text-gray-400 mt-2">{platform?.total_users ?? 0} registered citizens</p>
        </div>

        <TopIssuesList issues={issue?.top_issues ?? []} />
      </div>

      {/* Category Chart */}
      {platform?.categories && (
        <CategoryChart categories={platform.categories} />
      )}
    </div>
  );
}
