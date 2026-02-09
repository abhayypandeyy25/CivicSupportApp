import { RefreshCw } from 'lucide-react';

interface RefreshIndicatorProps {
  lastUpdated: Date | null;
  refreshing: boolean;
}

export default function RefreshIndicator({ lastUpdated, refreshing }: RefreshIndicatorProps) {
  const secondsAgo = lastUpdated
    ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
    : null;

  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
      {secondsAgo !== null && (
        <span>Updated {secondsAgo < 5 ? 'just now' : `${secondsAgo}s ago`}</span>
      )}
      <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      <span>Live</span>
    </div>
  );
}
