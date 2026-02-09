import { useEffect, useState } from 'react';
import { X, MapPin, ThumbsUp, Eye, User, Calendar } from 'lucide-react';
import { fetchIssue, fetchIssueTimeline, fetchIssueComments } from '../../api/endpoints';
import type { Issue, TimelineEvent, Comment } from '../../api/types';
import StatusBadge from '../shared/StatusBadge';
import CategoryBadge from '../shared/CategoryBadge';
import LoadingSpinner from '../shared/LoadingSpinner';
import { formatTimeAgo } from '../../utils/formatters';

interface IssueDetailModalProps {
  issueId: string;
  onClose: () => void;
}

export default function IssueDetailModal({ issueId, onClose }: IssueDetailModalProps) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'comments'>('details');

  useEffect(() => {
    Promise.all([
      fetchIssue(issueId),
      fetchIssueTimeline(issueId).catch(() => []),
      fetchIssueComments(issueId).catch(() => []),
    ]).then(([issueData, timelineData, commentsData]) => {
      setIssue(issueData);
      setTimeline(timelineData);
      setComments(commentsData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [issueId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 pr-8 line-clamp-1">
            {issue?.title || 'Loading...'}
          </h2>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : issue ? (
          <>
            {/* Photos */}
            {issue.photos && issue.photos.length > 0 && (
              <div className="flex gap-2 p-4 overflow-x-auto bg-gray-50">
                {issue.photos.map((photo, i) => (
                  <img
                    key={i}
                    src={photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`}
                    alt={`Photo ${i + 1}`}
                    className="h-48 rounded-lg object-cover flex-shrink-0"
                  />
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {(['details', 'timeline', 'comments'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab} {tab === 'comments' && comments.length > 0 ? `(${comments.length})` : ''}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'details' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <CategoryBadge categoryId={issue.category} />
                    <StatusBadge status={issue.status} />
                  </div>

                  <p className="text-gray-700 text-sm leading-relaxed">{issue.description}</p>

                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow icon={MapPin} label="Location" value={issue.location?.address || issue.location?.area || 'Delhi'} />
                    <InfoRow icon={User} label="Reported by" value={issue.user_name || 'Anonymous'} />
                    <InfoRow icon={Calendar} label="Reported" value={formatTimeAgo(issue.created_at)} />
                    <InfoRow icon={ThumbsUp} label="Upvotes" value={String(issue.upvotes)} />
                    <InfoRow icon={Eye} label="Views" value={String(issue.view_count)} />
                    {issue.assigned_official_name && (
                      <InfoRow icon={User} label="Assigned to" value={issue.assigned_official_name} />
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  {timeline.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-8">No timeline events yet</p>
                  ) : (
                    timeline.map((event) => (
                      <div key={event.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5" />
                          <div className="w-px flex-1 bg-gray-200" />
                        </div>
                        <div className="pb-4">
                          <p className="text-sm text-gray-700">{event.description}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatTimeAgo(event.created_at)}
                            {event.user_name && ` by ${event.user_name}`}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-8">No comments yet</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">{comment.user_name}</span>
                          {comment.is_official && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              {comment.official_designation || 'Official'}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">{formatTimeAgo(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-600">{comment.text}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-gray-500">Issue not found</div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-gray-400 text-xs">{label}</p>
        <p className="text-gray-700">{value}</p>
      </div>
    </div>
  );
}
