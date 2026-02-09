import { formatTimeAgo } from '../../utils/formatters';

export default function TimeAgo({ date }: { date: string }) {
  return <span className="text-gray-500 text-xs">{formatTimeAgo(date)}</span>;
}
