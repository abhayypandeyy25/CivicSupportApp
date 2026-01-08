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
  created_at: string;
  updated_at: string;
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
    skip?: number;
    limit?: number;
  }) => api.get<Issue[]>('/issues', { params }),

  getIssue: (issueId: string) => api.get<Issue>(`/issues/${issueId}`),

  updateIssue: (issueId: string, data: Partial<Issue>) =>
    api.put<Issue>(`/issues/${issueId}`, data),

  upvoteIssue: (issueId: string) => api.post<Issue>(`/issues/${issueId}/upvote`),

  getMyIssues: (params?: { skip?: number; limit?: number }) =>
    api.get<Issue[]>('/issues/user/me', { params }),

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
  }) => api.get<GovtOfficial[]>('/officials', { params }),

  getOfficialsByHierarchy: () => api.get('/officials/hierarchy'),

  getOfficial: (officialId: string) => api.get<GovtOfficial>(`/officials/${officialId}`),

  // Categories
  getCategories: () => api.get<{ categories: Category[] }>('/categories'),

  // Stats
  getStats: () => api.get('/stats'),
};

export default api;
