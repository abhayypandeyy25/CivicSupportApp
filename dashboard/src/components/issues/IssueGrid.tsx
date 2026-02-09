import type { Issue } from '../../api/types';
import IssueCard from './IssueCard';
import { FileX } from 'lucide-react';

interface IssueGridProps {
  issues: Issue[];
  onIssueClick: (id: string) => void;
}

export default function IssueGrid({ issues, onIssueClick }: IssueGridProps) {
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <FileX className="w-12 h-12 mb-3" />
        <p className="text-lg font-medium">No issues found</p>
        <p className="text-sm">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {issues.map((issue) => (
        <IssueCard
          key={issue.id}
          issue={issue}
          onClick={() => onIssueClick(issue.id)}
        />
      ))}
    </div>
  );
}
