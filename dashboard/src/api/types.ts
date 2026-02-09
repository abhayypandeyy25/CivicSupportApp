export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  area?: string;
  city?: string;
}

export interface Comment {
  id: string;
  user_id: string;
  user_name: string;
  text: string;
  is_official: boolean;
  official_designation?: string;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  event_type: 'created' | 'status_change' | 'assigned' | 'comment_added' | 'upvote_milestone';
  old_value?: string;
  new_value?: string;
  description: string;
  user_id?: string;
  user_name?: string;
  created_at: string;
}

export interface Issue {
  id: string;
  user_id: string;
  user_name?: string;
  title: string;
  description: string;
  category: string;
  sub_category?: string;
  photos: string[];
  location: Location;
  status: string;
  assigned_official_id?: string;
  assigned_official_name?: string;
  upvotes: number;
  upvoted_by: string[];
  comments: Comment[];
  timeline: TimelineEvent[];
  priority_score: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface IssueStats {
  total_issues: number;
  pending: number;
  in_progress: number;
  resolved: number;
  categories: { category: string; count: number }[];
  recent_week: number;
  top_issues: { id: string; title: string; upvotes: number; category: string; status: string }[];
}

export interface PlatformStats {
  total_issues: number;
  pending_issues: number;
  resolved_issues: number;
  total_users: number;
  total_officials: number;
  categories: Record<string, number>;
}

export type SortOption = 'newest' | 'oldest' | 'upvotes' | 'priority';
