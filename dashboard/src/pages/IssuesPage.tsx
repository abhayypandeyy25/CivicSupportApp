import { useState } from 'react';
import { useIssues } from '../hooks/useIssues';
import { useCategories } from '../hooks/useCategories';
import FilterBar from '../components/issues/FilterBar';
import IssueGrid from '../components/issues/IssueGrid';
import Pagination from '../components/issues/Pagination';
import IssueDetailModal from '../components/issues/IssueDetailModal';
import LoadingSpinner from '../components/shared/LoadingSpinner';

export default function IssuesPage() {
  const { issues, loading, page, setPage, hasMore, filters, updateFilters } = useIssues();
  const categories = useCategories();
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">All Civic Issues</h1>
        <p className="text-gray-500 mt-1">Browse and explore reported issues across Delhi</p>
      </div>

      <FilterBar
        categories={categories}
        filters={filters}
        onFilterChange={updateFilters}
      />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <IssueGrid
            issues={issues}
            onIssueClick={(id) => setSelectedIssueId(id)}
          />
          <Pagination
            currentPage={page}
            hasMore={hasMore}
            onPageChange={setPage}
          />
        </>
      )}

      {selectedIssueId && (
        <IssueDetailModal
          issueId={selectedIssueId}
          onClose={() => setSelectedIssueId(null)}
        />
      )}
    </div>
  );
}
