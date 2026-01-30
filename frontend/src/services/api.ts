import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('userToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types
export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  area?: string;
  city?: string;
}

export interface User {
  id: string;
  firebase_uid: string;
  phone_number?: string;
  email?: string;
  display_name?: string;
  photo_url?: string;
  location?: Location;
  is_admin: boolean;
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

// Twitter-specific data for issues reported via Twitter
export interface TwitterData {
  tweet_id: string;
  twitter_user_id: string;
  twitter_username: string;
  twitter_display_name?: string;
  twitter_profile_image?: string;
  tweet_text: string;
  tweet_url: string;
  tweet_created_at: string;
  has_media: boolean;
  media_urls: string[];
  hashtags: string[];
  retweet_count: number;
  like_count: number;
  reply_count: number;
  fetched_at: string;
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
  ai_suggested_category?: string;
  ai_suggested_officials: string[];
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
  // Source tracking
  source: 'app' | 'twitter';
  location_status: 'resolved' | 'pending';
  // Twitter-specific data (only present when source === 'twitter')
  twitter_data?: TwitterData;
}

export interface GovtOfficial {
  id: string;
  name: string;
  designation: string;
  department: string;
  area?: string;
  city: string;
  contact_email?: string;
  contact_phone?: string;
  photo_url?: string;
  categories: string[];
  hierarchy_level: number;
  is_active: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface AIClassificationResponse {
  category: string;
  sub_category?: string;
  suggested_officials: {
    id: string;
    name: string;
    designation: string;
    department: string;
  }[];
  confidence: number;
}

export interface IssueStats {
  total_issues: number;
  pending: number;
  in_progress: number;
  resolved: number;
  categories: { category: string; count: number }[];
  recent_week: number;
  top_issues: {
    id: string;
    title: string;
    upvotes: number;
    category: string;
    status: string;
  }[];
}

// Enhanced dashboard stats
export interface DashboardStats {
  total_issues: number;
  pending_issues: number;
  in_progress_issues: number;
  resolved_issues: number;
  resolution_rate: number;
  issues_this_week: number;
  total_users: number;
  total_officials: number;
  categories: CategoryBreakdown[];
  areas: AreaBreakdown[];
  issues_by_source: {
    app: number;
    twitter: number;
  };
  pending_location_issues: number;
  twitter_engagement: {
    total_likes: number;
    total_retweets: number;
    total_replies: number;
  };
  top_officials: OfficialPerformance[];
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
}

export interface AreaBreakdown {
  area: string;
  total: number;
  pending: number;
  resolved: number;
}

export interface OfficialPerformance {
  id: string;
  name: string;
  designation: string;
  department: string;
  total_assigned: number;
  resolved: number;
  resolution_rate: number;
  grade: string;
}

export type SortOption = 'newest' | 'oldest' | 'upvotes' | 'priority' | 'nearest';

export interface OfficialReportCard {
  official: {
    id: string;
    name: string;
    designation: string;
    department: string;
    area?: string;
    contact_email?: string;
    contact_phone?: string;
    categories: string[];
    hierarchy_level: number;
  };
  stats: {
    total_assigned: number;
    resolved: number;
    in_progress: number;
    pending: number;
    resolution_rate: number;
    avg_resolution_days: number;
  };
  performance: {
    score: number;
    grade: string;
    grade_label: string;
  };
  categories_breakdown: {
    category: string;
    total: number;
    resolved: number;
    pending: number;
    in_progress: number;
    resolution_rate: number;
  }[];
  recent_resolved: {
    id: string;
    title: string;
    category: string;
    resolved_at: string;
    upvotes: number;
  }[];
}

export interface OfficialWithStats extends GovtOfficial {
  stats: {
    total_assigned: number;
    resolved: number;
    resolution_rate: number;
  };
}

// API Functions
export const apiService = {
  // Health check
  healthCheck: () => api.get('/health'),

  // User
  createOrUpdateUser: (userData: Partial<User>) => api.post('/users', userData),
  getCurrentUser: () => api.get<User>('/users/me'),
  updateUserProfile: (data: Partial<User>) => api.put<User>('/users/me', data),
  updateUserLocation: (location: Location) => api.put<User>('/users/me/location', location),

  // Issues
  createIssue: (issueData: {
    title: string;
    description: string;
    category: string;
    sub_category?: string;
    photos: string[];
    location: Location;
  }) => api.post<Issue>('/issues', issueData),

  getIssues: (params?: {
    latitude?: number;
    longitude?: number;
    radius_km?: number;
    category?: string;
    status?: string;
    source?: 'app' | 'twitter';  // Filter by source
    location_status?: 'resolved' | 'pending';  // Filter by location status
    search?: string;
    sort_by?: SortOption;
    skip?: number;
    limit?: number;
  }) => api.get<Issue[]>('/issues', { params }),

  getIssue: (issueId: string) => api.get<Issue>(`/issues/${issueId}`),

  updateIssue: (issueId: string, data: Partial<Issue>) =>
    api.put<Issue>(`/issues/${issueId}`, data),

  upvoteIssue: (issueId: string) => api.post<Issue>(`/issues/${issueId}/upvote`),

  getMyIssues: (params?: { skip?: number; limit?: number }) =>
    api.get<Issue[]>('/issues/user/me', { params }),

  // Issue Stats
  getIssueStats: () => api.get<IssueStats>('/issues/stats/summary'),

  // Comments
  getComments: (issueId: string) => api.get<Comment[]>(`/issues/${issueId}/comments`),

  addComment: (issueId: string, text: string) =>
    api.post<Comment>(`/issues/${issueId}/comments`, { text }),

  deleteComment: (issueId: string, commentId: string) =>
    api.delete(`/issues/${issueId}/comments/${commentId}`),

  // Timeline
  getTimeline: (issueId: string) => api.get<TimelineEvent[]>(`/issues/${issueId}/timeline`),

  // AI Classification
  classifyIssue: (data: { title: string; description: string; location?: Location }) =>
    api.post<AIClassificationResponse>('/classify', data),

  // Officials
  getOfficials: (params?: {
    designation?: string;
    hierarchy_level?: number;
    area?: string;
    category?: string;
    skip?: number;
    limit?: number;
  }) => api.get<OfficialWithStats[]>('/officials', { params }),

  getOfficialsByHierarchy: () => api.get('/officials/hierarchy'),

  getOfficial: (officialId: string) => api.get<GovtOfficial>(`/officials/${officialId}`),

  getOfficialReportCard: (officialId: string) =>
    api.get<OfficialReportCard>(`/officials/${officialId}/report-card`),

  // Categories
  getCategories: () => api.get<{ categories: Category[] }>('/categories'),

  // Stats
  getStats: () => api.get<DashboardStats>('/stats'),
  getDashboardStats: () => api.get<DashboardStats>('/stats'),

  // Twitter (public endpoints for governance dashboard)
  getTwitterStats: () => api.get<TwitterStats>('/twitter/stats'),
  triggerTwitterSync: () => api.post<{ success: boolean; stats: TwitterSyncStats }>('/twitter/sync'),
  getTwitterIssues: (params?: {
    skip?: number;
    limit?: number;
    status?: string;
    location_status?: 'resolved' | 'pending';
  }) => api.get<Issue[]>('/admin/twitter/issues', { params }),
  updateIssueLocation: (issueId: string, location: Location) =>
    api.put<Issue>(`/admin/issues/${issueId}/location`, location),

  // Issue management (for governance dashboard)
  updateIssueStatus: (issueId: string, status: string) =>
    api.patch<{ success: boolean; status: string; issue_id: string }>(`/issues/${issueId}/status`, { status }),

  assignOfficialToIssue: (issueId: string, officialId: string) =>
    api.patch<{ success: boolean; issue_id: string; assigned_official_id: string; official_name: string }>(`/issues/${issueId}/assign`, { official_id: officialId }),

  getOfficialsList: () => api.get<Official[]>('/officials'),
};

// Simple Official type for dropdown
export interface Official {
  id: string;
  name: string;
  designation: string;
  department: string;
  area?: string;
  email?: string;
  phone?: string;
}

// Twitter Stats Types
export interface TwitterSyncStats {
  tweets_fetched: number;
  issues_created: number;
  duplicates_skipped: number;
  errors: number;
  pending_location: number;
}

export interface TwitterStats {
  enabled: boolean;
  twitter_handle: string;
  sync_state: {
    last_mention_id?: string;
    last_sync_at?: string;
    total_tweets_processed: number;
    total_issues_created: number;
  };
  total_twitter_issues: number;
  pending_twitter_issues: number;
  pending_location_issues: number;
  top_reporters: {
    username: string;
    display_name?: string;
    count: number;
  }[];
}

export default api;
