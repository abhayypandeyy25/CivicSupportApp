export const REFRESH_INTERVAL_MS = 30_000;
export const ITEMS_PER_PAGE = 12;

export const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
] as const;

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'upvotes', label: 'Most Upvoted' },
  { value: 'priority', label: 'Highest Priority' },
  { value: 'oldest', label: 'Oldest First' },
] as const;

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:     { bg: 'bg-amber-100', text: 'text-amber-800' },
  in_progress: { bg: 'bg-blue-100',  text: 'text-blue-800' },
  resolved:    { bg: 'bg-green-100', text: 'text-green-800' },
  closed:      { bg: 'bg-gray-100',  text: 'text-gray-800' },
};
