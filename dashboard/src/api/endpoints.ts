import client from './client';
import type { Issue, IssueStats, PlatformStats, Category, Comment, TimelineEvent, SortOption } from './types';

export const fetchIssueStats = () =>
  client.get<IssueStats>('/issues/stats/summary').then(r => r.data);

export const fetchPlatformStats = () =>
  client.get<PlatformStats>('/stats').then(r => r.data);

export const fetchCategories = () =>
  client.get<{ categories: Category[] }>('/categories').then(r => r.data.categories);

export const fetchIssues = (params: {
  category?: string;
  status?: string;
  search?: string;
  sort_by?: SortOption;
  skip?: number;
  limit?: number;
}) => client.get<Issue[]>('/issues', { params }).then(r => r.data);

export const fetchIssue = (id: string) =>
  client.get<Issue>(`/issues/${id}`).then(r => r.data);

export const fetchIssueComments = (id: string) =>
  client.get<Comment[]>(`/issues/${id}/comments`).then(r => r.data);

export const fetchIssueTimeline = (id: string) =>
  client.get<TimelineEvent[]>(`/issues/${id}/timeline`).then(r => r.data);
