import { TrendingUp, ThumbsUp } from 'lucide-react';
import CategoryBadge from '../shared/CategoryBadge';
import StatusBadge from '../shared/StatusBadge';

interface TopIssue {
  id: string;
  title: string;
  upvotes: number;
  category: string;
  status: string;
}

interface TopIssuesListProps {
  issues: TopIssue[];
}

export default function TopIssuesList({ issues }: TopIssuesListProps) {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-gray-900">Trending Issues</h3>
      </div>
      <div className="space-y-3">
        {issues.slice(0, 5).map((issue, i) => (
          <div
            key={issue.id}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="text-lg font-bold text-gray-300 w-6 text-center">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{issue.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <CategoryBadge categoryId={issue.category} />
                <StatusBadge status={issue.status} />
              </div>
            </div>
            <div className="flex items-center gap-1 text-gray-500">
              <ThumbsUp className="w-4 h-4" />
              <span className="text-sm font-medium">{issue.upvotes}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
