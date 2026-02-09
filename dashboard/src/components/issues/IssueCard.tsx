import { MapPin, ThumbsUp, Eye, MessageCircle, Twitter } from 'lucide-react';
import type { Issue } from '../../api/types';
import StatusBadge from '../shared/StatusBadge';
import CategoryBadge from '../shared/CategoryBadge';
import TimeAgo from '../shared/TimeAgo';

interface IssueCardProps {
  issue: Issue;
  onClick: () => void;
}

export default function IssueCard({ issue, onClick }: IssueCardProps) {
  const hasPhoto = issue.photos && issue.photos.length > 0;
  const photoSrc = hasPhoto
    ? issue.photos[0].startsWith('data:')
      ? issue.photos[0]
      : `data:image/jpeg;base64,${issue.photos[0]}`
    : null;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-pointer group"
    >
      {/* Photo */}
      <div className="h-40 bg-gray-100 relative overflow-hidden">
        {photoSrc ? (
          <img
            src={photoSrc}
            alt={issue.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
            <span className="text-4xl opacity-30">
              {issue.category === 'roads' ? '🛣️' : issue.category === 'water' ? '💧' : '📋'}
            </span>
          </div>
        )}
        {issue.photos && issue.photos.length > 1 && (
          <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
            +{issue.photos.length - 1}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm mb-2">{issue.title}</h3>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <CategoryBadge categoryId={issue.category} />
          <StatusBadge status={issue.status} />
          {issue.source === 'twitter' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700">
              <Twitter className="w-3 h-3" />
              {issue.source_meta?.twitter_handle ? `@${issue.source_meta.twitter_handle}` : 'Twitter'}
            </span>
          )}
        </div>

        {/* Location */}
        <div className="flex items-center gap-1 text-gray-500 text-xs mb-3">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">
            {issue.location?.address || issue.location?.area || 'Delhi'}
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
          <div className="flex items-center gap-3 text-gray-400 text-xs">
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3.5 h-3.5" /> {issue.upvotes}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> {issue.view_count}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" /> {issue.comments?.length || 0}
            </span>
          </div>
          <TimeAgo date={issue.created_at} />
        </div>
      </div>
    </div>
  );
}
