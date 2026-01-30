import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Linking,
  Alert,
  ScrollView,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiService, Issue, DashboardStats, CategoryBreakdown, AreaBreakdown, OfficialPerformance, Official } from '../../src/services/api';

const { width: screenWidth } = Dimensions.get('window');

// Category colors and icons
const categoryConfig: Record<string, { color: string; icon: string; bgColor: string; name: string }> = {
  roads: { color: '#F44336', icon: 'car-outline', bgColor: '#FFEBEE', name: 'Roads' },
  sanitation: { color: '#4CAF50', icon: 'trash-outline', bgColor: '#E8F5E9', name: 'Sanitation' },
  water: { color: '#2196F3', icon: 'water-outline', bgColor: '#E3F2FD', name: 'Water' },
  electricity: { color: '#FF9800', icon: 'flash-outline', bgColor: '#FFF3E0', name: 'Electricity' },
  encroachment: { color: '#9C27B0', icon: 'alert-circle-outline', bgColor: '#F3E5F5', name: 'Encroachment' },
  parks: { color: '#8BC34A', icon: 'leaf-outline', bgColor: '#F1F8E9', name: 'Parks' },
  public_safety: { color: '#E91E63', icon: 'shield-outline', bgColor: '#FCE4EC', name: 'Safety' },
  health: { color: '#00BCD4', icon: 'medkit-outline', bgColor: '#E0F7FA', name: 'Health' },
  education: { color: '#3F51B5', icon: 'school-outline', bgColor: '#E8EAF6', name: 'Education' },
  transport: { color: '#795548', icon: 'bus-outline', bgColor: '#EFEBE9', name: 'Transport' },
  housing: { color: '#607D8B', icon: 'home-outline', bgColor: '#ECEFF1', name: 'Housing' },
  general: { color: '#9E9E9E', icon: 'help-circle-outline', bgColor: '#FAFAFA', name: 'General' },
};

const statusConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  pending: { color: '#FF9800', bgColor: '#FFF3E0', label: 'Pending' },
  in_progress: { color: '#2196F3', bgColor: '#E3F2FD', label: 'In Progress' },
  resolved: { color: '#4CAF50', bgColor: '#E8F5E9', label: 'Resolved' },
  rejected: { color: '#F44336', bgColor: '#FFEBEE', label: 'Rejected' },
};

const gradeConfig: Record<string, { color: string; bgColor: string }> = {
  A: { color: '#4CAF50', bgColor: '#E8F5E9' },
  B: { color: '#8BC34A', bgColor: '#F1F8E9' },
  C: { color: '#FF9800', bgColor: '#FFF3E0' },
  D: { color: '#FF5722', bgColor: '#FBE9E7' },
  F: { color: '#F44336', bgColor: '#FFEBEE' },
};

export default function GovernanceDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [officials, setOfficials] = useState<Official[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [activeSection, setActiveSection] = useState<'analytics' | 'issues'>('analytics');

  // Modal states
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [assigningOfficial, setAssigningOfficial] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsResponse, issuesResponse, officialsResponse] = await Promise.all([
        apiService.getDashboardStats(),
        apiService.getIssues({ limit: 50 }),
        apiService.getOfficialsList().catch(() => ({ data: [] }))
      ]);
      setStats(statsResponse.data);
      setIssues(issuesResponse.data);
      setOfficials(officialsResponse.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const handleTwitterSync = async () => {
    setSyncing(true);
    try {
      const response = await apiService.triggerTwitterSync();
      const syncStats = response.data.stats;
      Alert.alert(
        'Sync Complete',
        `Fetched: ${syncStats.tweets_fetched}\nCreated: ${syncStats.issues_created}\nDuplicates: ${syncStats.duplicates_skipped}`
      );
      await fetchData();
    } catch (error: any) {
      Alert.alert('Sync Failed', error.response?.data?.detail || 'Failed to sync Twitter mentions');
    } finally {
      setSyncing(false);
    }
  };

  const openTweet = (tweetId: string) => {
    Linking.openURL(`https://twitter.com/i/web/status/${tweetId}`);
  };

  // Handle status update
  const handleUpdateStatus = async (status: string) => {
    if (!selectedIssue) return;

    setUpdatingStatus(true);
    try {
      await apiService.updateIssueStatus(selectedIssue.id, status);
      // Update local state
      setIssues(prevIssues =>
        prevIssues.map(issue =>
          issue.id === selectedIssue.id ? { ...issue, status } : issue
        )
      );
      setStatusModalVisible(false);
      Alert.alert('Success', `Status updated to ${statusConfig[status]?.label || status}`);
      // Refresh stats
      const statsResponse = await apiService.getDashboardStats();
      setStats(statsResponse.data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle assign official
  const handleAssignOfficial = async (officialId: string, officialName: string) => {
    if (!selectedIssue) return;

    setAssigningOfficial(true);
    try {
      await apiService.assignOfficialToIssue(selectedIssue.id, officialId);
      // Update local state
      setIssues(prevIssues =>
        prevIssues.map(issue =>
          issue.id === selectedIssue.id
            ? { ...issue, assigned_official_id: officialId, status: 'in_progress' }
            : issue
        )
      );
      setAssignModalVisible(false);
      Alert.alert('Success', `Assigned to ${officialName}`);
      // Refresh stats
      const statsResponse = await apiService.getDashboardStats();
      setStats(statsResponse.data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to assign official');
    } finally {
      setAssigningOfficial(false);
    }
  };

  // Open modals
  const openStatusModal = (issue: Issue) => {
    setSelectedIssue(issue);
    setStatusModalVisible(true);
  };

  const openAssignModal = (issue: Issue) => {
    setSelectedIssue(issue);
    setAssignModalVisible(true);
  };

  const openViewModal = (issue: Issue) => {
    setSelectedIssue(issue);
    setViewModalVisible(true);
  };

  const getCategoryConfig = (category: string) => {
    return categoryConfig[category] || categoryConfig.general;
  };

  const getStatusConfig = (status: string) => {
    return statusConfig[status] || statusConfig.pending;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredIssues = selectedStatus === 'all'
    ? issues
    : issues.filter(issue => issue.status === selectedStatus);

  // KPI Card Component
  const KPICard = ({ icon, value, label, color, trend }: {
    icon: string;
    value: number | string;
    label: string;
    color: string;
    trend?: number;
  }) => (
    <View style={[styles.kpiCard, { borderLeftColor: color }]}>
      <View style={styles.kpiHeader}>
        <View style={[styles.kpiIconContainer, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon as any} size={20} color={color} />
        </View>
        {trend !== undefined && (
          <View style={[styles.trendBadge, { backgroundColor: trend >= 0 ? '#E8F5E9' : '#FFEBEE' }]}>
            <Ionicons
              name={trend >= 0 ? 'trending-up' : 'trending-down'}
              size={12}
              color={trend >= 0 ? '#4CAF50' : '#F44336'}
            />
            <Text style={[styles.trendText, { color: trend >= 0 ? '#4CAF50' : '#F44336' }]}>
              {Math.abs(trend)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );

  // Category Bar Component
  const CategoryBar = ({ item, maxTotal }: { item: CategoryBreakdown; maxTotal: number }) => {
    const config = getCategoryConfig(item.category);
    const percentage = maxTotal > 0 ? (item.total / maxTotal) * 100 : 0;

    return (
      <View style={styles.categoryBarContainer}>
        <View style={styles.categoryBarHeader}>
          <View style={styles.categoryBarLabel}>
            <View style={[styles.categoryDot, { backgroundColor: config.color }]} />
            <Text style={styles.categoryBarName}>{config.name}</Text>
          </View>
          <Text style={styles.categoryBarCount}>{item.total}</Text>
        </View>
        <View style={styles.categoryBarTrack}>
          <View style={[styles.categoryBarFill, { width: `${percentage}%`, backgroundColor: config.color }]} />
        </View>
        <View style={styles.categoryBarStats}>
          <Text style={styles.categoryBarStat}>
            <Text style={{ color: '#FF9800' }}>{item.pending}</Text> pending
          </Text>
          <Text style={styles.categoryBarStat}>
            <Text style={{ color: '#4CAF50' }}>{item.resolved}</Text> resolved
          </Text>
        </View>
      </View>
    );
  };

  // Official Card Component
  const OfficialCard = ({ official, rank }: { official: OfficialPerformance; rank: number }) => {
    const gradeStyle = gradeConfig[official.grade] || gradeConfig.F;

    return (
      <View style={styles.officialCard}>
        <View style={styles.officialRank}>
          <Text style={styles.officialRankText}>#{rank}</Text>
        </View>
        <View style={styles.officialInfo}>
          <Text style={styles.officialName} numberOfLines={1}>{official.name}</Text>
          <Text style={styles.officialDesignation} numberOfLines={1}>{official.designation}</Text>
        </View>
        <View style={styles.officialStats}>
          <Text style={styles.officialRate}>{official.resolution_rate}%</Text>
          <View style={[styles.gradeBadge, { backgroundColor: gradeStyle.bgColor }]}>
            <Text style={[styles.gradeText, { color: gradeStyle.color }]}>{official.grade}</Text>
          </View>
        </View>
      </View>
    );
  };

  // Area Card Component
  const AreaCard = ({ item }: { item: AreaBreakdown }) => (
    <View style={styles.areaCard}>
      <View style={styles.areaHeader}>
        <Ionicons name="location" size={16} color="#666" />
        <Text style={styles.areaName} numberOfLines={1}>{item.area}</Text>
      </View>
      <View style={styles.areaStats}>
        <View style={styles.areaStat}>
          <Text style={styles.areaStatValue}>{item.total}</Text>
          <Text style={styles.areaStatLabel}>Total</Text>
        </View>
        <View style={styles.areaStat}>
          <Text style={[styles.areaStatValue, { color: '#FF9800' }]}>{item.pending}</Text>
          <Text style={styles.areaStatLabel}>Pending</Text>
        </View>
        <View style={styles.areaStat}>
          <Text style={[styles.areaStatValue, { color: '#4CAF50' }]}>{item.resolved}</Text>
          <Text style={styles.areaStatLabel}>Resolved</Text>
        </View>
      </View>
    </View>
  );

  // Government Complaint Card Component
  const ComplaintCard = ({ item }: { item: Issue }) => {
    const catConfig = getCategoryConfig(item.category);
    const statConfig = getStatusConfig(item.status);
    const twitterData = item.twitter_data;

    return (
      <View style={styles.complaintCard}>
        {/* Header Row */}
        <View style={styles.complaintHeader}>
          <View style={styles.complaintUserInfo}>
            {twitterData?.twitter_profile_image ? (
              <Image source={{ uri: twitterData.twitter_profile_image }} style={styles.complaintAvatar} />
            ) : (
              <View style={[styles.complaintAvatar, styles.complaintAvatarPlaceholder]}>
                <Ionicons name="person" size={20} color="#999" />
              </View>
            )}
            <View style={styles.complaintUserDetails}>
              <Text style={styles.complaintUserName} numberOfLines={1}>
                {twitterData?.twitter_display_name || item.user_name || 'Anonymous'}
              </Text>
              {twitterData && (
                <View style={styles.complaintSourceRow}>
                  <Ionicons name="logo-twitter" size={12} color="#1DA1F2" />
                  <Text style={styles.complaintHandle}>@{twitterData.twitter_username}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.complaintHeaderRight}>
            <Text style={styles.complaintTime}>{formatDate(item.created_at)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statConfig.bgColor }]}>
              <Text style={[styles.statusText, { color: statConfig.color }]}>{statConfig.label}</Text>
            </View>
          </View>
        </View>

        {/* Content Row with Photo */}
        <View style={styles.complaintContent}>
          {item.photos && item.photos.length > 0 && (
            <View style={styles.complaintPhotoContainer}>
              <Image source={{ uri: item.photos[0] }} style={styles.complaintPhoto} />
              {item.photos.length > 1 && (
                <View style={styles.photoCountBadge}>
                  <Text style={styles.photoCountText}>+{item.photos.length - 1}</Text>
                </View>
              )}
            </View>
          )}
          <View style={[styles.complaintDetails, !item.photos?.length && { marginLeft: 0 }]}>
            <Text style={styles.complaintTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.complaintDescription} numberOfLines={2}>
              {item.description || twitterData?.tweet_text}
            </Text>
            <View style={styles.complaintTags}>
              <View style={[styles.categoryBadge, { backgroundColor: catConfig.bgColor }]}>
                <Ionicons name={catConfig.icon as any} size={12} color={catConfig.color} />
                <Text style={[styles.categoryText, { color: catConfig.color }]}>{catConfig.name}</Text>
              </View>
              {item.source === 'twitter' && (
                <View style={styles.sourceBadge}>
                  <Ionicons name="logo-twitter" size={10} color="#1DA1F2" />
                  <Text style={styles.sourceText}>Twitter</Text>
                </View>
              )}
              {item.upvotes > 0 && (
                <View style={styles.upvoteBadge}>
                  <Ionicons name="arrow-up" size={10} color="#666" />
                  <Text style={styles.upvoteText}>{item.upvotes}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Location Row */}
        <View style={styles.complaintLocation}>
          <Ionicons name="location-outline" size={14} color="#666" />
          <Text style={styles.complaintLocationText} numberOfLines={1}>
            {item.location?.address || item.location?.area || item.location?.city || 'Location pending'}
          </Text>
          {item.location_status === 'pending' && (
            <View style={styles.locationWarning}>
              <Text style={styles.locationWarningText}>Needs location</Text>
            </View>
          )}
        </View>

        {/* Twitter Engagement */}
        {twitterData && (
          <View style={styles.complaintEngagement}>
            <View style={styles.engagementItem}>
              <Ionicons name="heart-outline" size={14} color="#657786" />
              <Text style={styles.engagementText}>{twitterData.like_count || 0}</Text>
            </View>
            <View style={styles.engagementItem}>
              <Ionicons name="repeat-outline" size={14} color="#657786" />
              <Text style={styles.engagementText}>{twitterData.retweet_count || 0}</Text>
            </View>
            <View style={styles.engagementItem}>
              <Ionicons name="chatbubble-outline" size={14} color="#657786" />
              <Text style={styles.engagementText}>{twitterData.reply_count || 0}</Text>
            </View>
          </View>
        )}

        {/* Actions Row */}
        <View style={styles.complaintActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => openViewModal(item)}>
            <Ionicons name="eye-outline" size={16} color="#666" />
            <Text style={styles.actionText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.assignButton]} onPress={() => openAssignModal(item)}>
            <Ionicons name="person-add-outline" size={16} color="#9C27B0" />
            <Text style={[styles.actionText, { color: '#9C27B0' }]}>Assign</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.updateButton]} onPress={() => openStatusModal(item)}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
            <Text style={[styles.actionText, { color: '#4CAF50' }]}>Update</Text>
          </TouchableOpacity>
          {twitterData && (
            <TouchableOpacity
              style={[styles.actionButton, styles.twitterButton]}
              onPress={() => openTweet(twitterData.tweet_id)}
            >
              <Ionicons name="open-outline" size={16} color="#1DA1F2" />
              <Text style={[styles.actionText, { color: '#1DA1F2' }]}>Tweet</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF5722" />
          <Text style={styles.loadingText}>Loading Dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const maxCategoryTotal = stats?.categories.length
    ? Math.max(...stats.categories.map(c => c.total))
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Governance Dashboard</Text>
            <Text style={styles.headerSubtitle}>CivicSense Analytics</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
              onPress={handleTwitterSync}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="sync" size={16} color="#fff" />
                  <Text style={styles.syncButtonText}>Sync</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* KPI Grid */}
        <View style={styles.section}>
          <View style={styles.kpiGrid}>
            <KPICard
              icon="document-text"
              value={stats?.total_issues || 0}
              label="Total Issues"
              color="#2196F3"
            />
            <KPICard
              icon="time-outline"
              value={stats?.pending_issues || 0}
              label="Pending"
              color="#FF9800"
            />
            <KPICard
              icon="checkmark-circle"
              value={`${stats?.resolution_rate || 0}%`}
              label="Resolution Rate"
              color="#4CAF50"
            />
            <KPICard
              icon="people"
              value={stats?.total_users || 0}
              label="Active Users"
              color="#9C27B0"
            />
            <KPICard
              icon="briefcase"
              value={stats?.total_officials || 0}
              label="Officials"
              color="#607D8B"
            />
            <KPICard
              icon="calendar"
              value={stats?.issues_this_week || 0}
              label="This Week"
              color="#00BCD4"
            />
          </View>
        </View>

        {/* Category Breakdown & Source Analysis Row */}
        <View style={styles.splitSection}>
          {/* Category Breakdown */}
          <View style={[styles.sectionCard, { flex: 1.2 }]}>
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
            {stats?.categories.slice(0, 6).map((item, index) => (
              <CategoryBar key={index} item={item} maxTotal={maxCategoryTotal} />
            ))}
          </View>

          {/* Source Analysis */}
          <View style={[styles.sectionCard, { flex: 0.8 }]}>
            <Text style={styles.sectionTitle}>Source Analysis</Text>
            <View style={styles.sourceItem}>
              <View style={styles.sourceIcon}>
                <Ionicons name="phone-portrait-outline" size={20} color="#FF5722" />
              </View>
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceLabel}>Mobile App</Text>
                <Text style={styles.sourceValue}>{stats?.issues_by_source.app || 0}</Text>
              </View>
            </View>
            <View style={styles.sourceItem}>
              <View style={[styles.sourceIcon, { backgroundColor: '#E8F5FE' }]}>
                <Ionicons name="logo-twitter" size={20} color="#1DA1F2" />
              </View>
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceLabel}>Twitter</Text>
                <Text style={styles.sourceValue}>{stats?.issues_by_source.twitter || 0}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.sectionSubtitle}>Twitter Engagement</Text>
            <View style={styles.engagementGrid}>
              <View style={styles.engagementStat}>
                <Ionicons name="heart" size={16} color="#E91E63" />
                <Text style={styles.engagementStatValue}>{stats?.twitter_engagement.total_likes || 0}</Text>
              </View>
              <View style={styles.engagementStat}>
                <Ionicons name="repeat" size={16} color="#17BF63" />
                <Text style={styles.engagementStatValue}>{stats?.twitter_engagement.total_retweets || 0}</Text>
              </View>
              <View style={styles.engagementStat}>
                <Ionicons name="chatbubble" size={16} color="#1DA1F2" />
                <Text style={styles.engagementStatValue}>{stats?.twitter_engagement.total_replies || 0}</Text>
              </View>
            </View>
            {stats?.pending_location_issues ? (
              <View style={styles.pendingLocationBanner}>
                <Ionicons name="warning" size={14} color="#FF9800" />
                <Text style={styles.pendingLocationText}>
                  {stats.pending_location_issues} issues need location
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Official Performance & Area Distribution Row */}
        <View style={styles.splitSection}>
          {/* Official Leaderboard */}
          <View style={[styles.sectionCard, { flex: 1 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Official Performance</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {stats?.top_officials.length ? (
              stats.top_officials.slice(0, 5).map((official, index) => (
                <OfficialCard key={official.id} official={official} rank={index + 1} />
              ))
            ) : (
              <Text style={styles.emptyText}>No officials assigned yet</Text>
            )}
          </View>

          {/* Area Distribution */}
          <View style={[styles.sectionCard, { flex: 1 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Area Distribution</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {stats?.areas.length ? (
              stats.areas.slice(0, 4).map((area, index) => (
                <AreaCard key={index} item={area} />
              ))
            ) : (
              <Text style={styles.emptyText}>No area data available</Text>
            )}
          </View>
        </View>

        {/* Complaints Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Complaints</Text>
            <View style={styles.filterChips}>
              {['all', 'pending', 'in_progress', 'resolved'].map(status => (
                <TouchableOpacity
                  key={status}
                  style={[styles.filterChip, selectedStatus === status && styles.filterChipActive]}
                  onPress={() => setSelectedStatus(status)}
                >
                  <Text style={[styles.filterChipText, selectedStatus === status && styles.filterChipTextActive]}>
                    {status === 'all' ? 'All' : statusConfig[status]?.label || status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={styles.issuesCount}>{filteredIssues.length} complaints</Text>
        </View>

        {/* Complaints List */}
        {filteredIssues.map(item => (
          <ComplaintCard key={item.id} item={item} />
        ))}

        {filteredIssues.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>No Complaints</Text>
            <Text style={styles.emptySubtitle}>No complaints match your filter</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Status Update Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={statusModalVisible}
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setStatusModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Status</Text>
              <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            {selectedIssue && (
              <Text style={styles.modalSubtitle} numberOfLines={2}>{selectedIssue.title}</Text>
            )}
            <View style={styles.statusOptions}>
              {['pending', 'in_progress', 'resolved', 'rejected'].map(status => {
                const config = statusConfig[status];
                const isSelected = selectedIssue?.status === status;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusOption,
                      { borderColor: config.color },
                      isSelected && { backgroundColor: config.bgColor }
                    ]}
                    onPress={() => handleUpdateStatus(status)}
                    disabled={updatingStatus}
                  >
                    <View style={[styles.statusDot, { backgroundColor: config.color }]} />
                    <Text style={[styles.statusOptionText, { color: config.color }]}>{config.label}</Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={config.color} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            {updatingStatus && (
              <ActivityIndicator style={styles.modalLoader} color="#FF5722" />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Assign Official Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={assignModalVisible}
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setAssignModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Official</Text>
              <TouchableOpacity onPress={() => setAssignModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            {selectedIssue && (
              <Text style={styles.modalSubtitle} numberOfLines={2}>{selectedIssue.title}</Text>
            )}
            <ScrollView style={styles.officialsList}>
              {officials.length > 0 ? (
                officials.map(official => (
                  <TouchableOpacity
                    key={official.id}
                    style={styles.officialOption}
                    onPress={() => handleAssignOfficial(official.id, official.name)}
                    disabled={assigningOfficial}
                  >
                    <View style={styles.officialAvatar}>
                      <Ionicons name="person" size={20} color="#666" />
                    </View>
                    <View style={styles.officialOptionInfo}>
                      <Text style={styles.officialOptionName}>{official.name}</Text>
                      <Text style={styles.officialOptionDesignation}>{official.designation}</Text>
                      {official.department && (
                        <Text style={styles.officialOptionDept}>{official.department}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.noOfficialsContainer}>
                  <Ionicons name="people-outline" size={40} color="#ccc" />
                  <Text style={styles.noOfficialsText}>No officials available</Text>
                  <Text style={styles.noOfficialsSubtext}>Add officials in admin panel</Text>
                </View>
              )}
            </ScrollView>
            {assigningOfficial && (
              <ActivityIndicator style={styles.modalLoader} color="#FF5722" />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* View Details Modal - Redesigned V2 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={viewModalVisible}
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.viewModalOverlay}>
          <View style={styles.viewModalContainer}>
            {selectedIssue && (
              <>
                {/* Header Banner */}
                <View style={styles.viewModalHeader}>
                  <View style={styles.viewModalHeaderLeft}>
                    <TouchableOpacity style={styles.viewModalBackBtn} onPress={() => setViewModalVisible(false)}>
                      <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
                    </TouchableOpacity>
                    <Text style={styles.viewModalHeaderTitle}>Complaint Details</Text>
                  </View>
                  <View style={styles.viewModalHeaderRight}>
                    <View style={[styles.viewModalHeaderStatus, { backgroundColor: getStatusConfig(selectedIssue.status).bgColor }]}>
                      <View style={[styles.viewModalHeaderStatusDot, { backgroundColor: getStatusConfig(selectedIssue.status).color }]} />
                      <Text style={[styles.viewModalHeaderStatusText, { color: getStatusConfig(selectedIssue.status).color }]}>
                        {getStatusConfig(selectedIssue.status).label}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Content Section */}
                <ScrollView style={styles.viewModalBody} showsVerticalScrollIndicator={false}>
                  {/* Category and Source Row */}
                  <View style={styles.viewModalCategoryRow}>
                    <View style={[styles.viewModalCategoryBadge, { backgroundColor: getCategoryConfig(selectedIssue.category).color }]}>
                      <Ionicons name={getCategoryConfig(selectedIssue.category).icon as any} size={16} color="#fff" />
                      <Text style={styles.viewModalCategoryBadgeText}>{getCategoryConfig(selectedIssue.category).name}</Text>
                    </View>
                    {selectedIssue.source === 'twitter' && (
                      <View style={styles.viewModalSourceBadge}>
                        <Ionicons name="logo-twitter" size={14} color="#1DA1F2" />
                        <Text style={styles.viewModalSourceText}>Twitter</Text>
                      </View>
                    )}
                    <Text style={styles.viewModalIdText}>#{selectedIssue.id.slice(0, 8)}</Text>
                  </View>

                  {/* Title */}
                  <Text style={styles.viewModalTitleNew}>{selectedIssue.title}</Text>

                  {/* Description */}
                  <Text style={styles.viewModalDescNew}>
                    {selectedIssue.description || selectedIssue.twitter_data?.tweet_text || 'No description provided'}
                  </Text>

                  {/* Photo Card with Gallery */}
                  {selectedIssue.photos && selectedIssue.photos.length > 0 && (
                    <View style={styles.viewModalPhotoCard}>
                      <View style={styles.viewModalPhotoCardHeader}>
                        <Ionicons name="images-outline" size={18} color="#666" />
                        <Text style={styles.viewModalPhotoCardTitle}>Attached Photos</Text>
                        <Text style={styles.viewModalPhotoCount}>{selectedIssue.photos.length} photo{selectedIssue.photos.length > 1 ? 's' : ''}</Text>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.viewModalPhotoScroll}
                        contentContainerStyle={styles.viewModalPhotoScrollContent}
                      >
                        {selectedIssue.photos.map((photo, index) => (
                          <TouchableOpacity key={index} style={styles.viewModalPhotoItem}>
                            <Image source={{ uri: photo }} style={styles.viewModalPhotoImage} />
                            <View style={styles.viewModalPhotoIndex}>
                              <Text style={styles.viewModalPhotoIndexText}>{index + 1}/{selectedIssue.photos.length}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Reporter Card */}
                  <View style={styles.viewModalInfoCardFull}>
                    <View style={styles.viewModalInfoCardIcon}>
                      <Ionicons name="person-circle" size={24} color="#FF5722" />
                    </View>
                    <View style={styles.viewModalInfoCardContent}>
                      <Text style={styles.viewModalInfoCardSmallLabel}>Reported by</Text>
                      <View style={styles.viewModalReporterRow}>
                        {selectedIssue.twitter_data?.twitter_profile_image ? (
                          <Image source={{ uri: selectedIssue.twitter_data.twitter_profile_image }} style={styles.viewModalReporterAvatar} />
                        ) : (
                          <View style={styles.viewModalReporterAvatarPlaceholder}>
                            <Ionicons name="person" size={16} color="#999" />
                          </View>
                        )}
                        <View style={styles.viewModalReporterInfo}>
                          <Text style={styles.viewModalReporterNameNew}>
                            {selectedIssue.twitter_data?.twitter_display_name || selectedIssue.user_name || 'Anonymous'}
                          </Text>
                          {selectedIssue.twitter_data && (
                            <Text style={styles.viewModalReporterHandleNew}>@{selectedIssue.twitter_data.twitter_username}</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Date and Time Card */}
                  <View style={styles.viewModalInfoCardFull}>
                    <View style={styles.viewModalInfoCardIcon}>
                      <Ionicons name="calendar" size={24} color="#2196F3" />
                    </View>
                    <View style={styles.viewModalInfoCardContent}>
                      <Text style={styles.viewModalInfoCardSmallLabel}>Reported on</Text>
                      <Text style={styles.viewModalInfoCardValue}>
                        {new Date(selectedIssue.created_at).toLocaleDateString('en-IN', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </Text>
                      <Text style={styles.viewModalInfoCardSubValue}>
                        at {new Date(selectedIssue.created_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    </View>
                  </View>

                  {/* Location Card */}
                  <View style={styles.viewModalInfoCardFull}>
                    <View style={[styles.viewModalInfoCardIcon, { backgroundColor: '#FFF3E0' }]}>
                      <Ionicons name="location" size={24} color="#FF9800" />
                    </View>
                    <View style={styles.viewModalInfoCardContent}>
                      <Text style={styles.viewModalInfoCardSmallLabel}>Location</Text>
                      <Text style={styles.viewModalInfoCardValue}>
                        {selectedIssue.location?.address || selectedIssue.location?.area || selectedIssue.location?.city || 'Location needed'}
                      </Text>
                      {selectedIssue.location_status === 'pending' && (
                        <View style={styles.viewModalLocationPendingBadge}>
                          <Ionicons name="alert-circle" size={12} color="#FF9800" />
                          <Text style={styles.viewModalLocationPendingText}>Verification pending</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Twitter Engagement Card */}
                  {selectedIssue.twitter_data && (
                    <View style={styles.viewModalTwitterCard}>
                      <View style={styles.viewModalTwitterCardHeader}>
                        <View style={styles.viewModalTwitterLogo}>
                          <Ionicons name="logo-twitter" size={20} color="#fff" />
                        </View>
                        <View style={styles.viewModalTwitterHeaderText}>
                          <Text style={styles.viewModalTwitterTitle}>Twitter Engagement</Text>
                          <Text style={styles.viewModalTwitterSubtitle}>Public interaction metrics</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.viewModalViewTweetBtn}
                          onPress={() => openTweet(selectedIssue.twitter_data!.tweet_id)}
                        >
                          <Text style={styles.viewModalViewTweetText}>View</Text>
                          <Ionicons name="open-outline" size={14} color="#1DA1F2" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.viewModalTwitterStats}>
                        <View style={styles.viewModalTwitterStat}>
                          <Ionicons name="heart" size={22} color="#E91E63" />
                          <Text style={styles.viewModalTwitterStatNumber}>{selectedIssue.twitter_data.like_count || 0}</Text>
                          <Text style={styles.viewModalTwitterStatLabel}>Likes</Text>
                        </View>
                        <View style={styles.viewModalTwitterStatDivider} />
                        <View style={styles.viewModalTwitterStat}>
                          <Ionicons name="repeat" size={22} color="#17BF63" />
                          <Text style={styles.viewModalTwitterStatNumber}>{selectedIssue.twitter_data.retweet_count || 0}</Text>
                          <Text style={styles.viewModalTwitterStatLabel}>Retweets</Text>
                        </View>
                        <View style={styles.viewModalTwitterStatDivider} />
                        <View style={styles.viewModalTwitterStat}>
                          <Ionicons name="chatbubble" size={22} color="#1DA1F2" />
                          <Text style={styles.viewModalTwitterStatNumber}>{selectedIssue.twitter_data.reply_count || 0}</Text>
                          <Text style={styles.viewModalTwitterStatLabel}>Replies</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  <View style={{ height: 120 }} />
                </ScrollView>

                {/* Fixed Action Buttons at Bottom */}
                <View style={styles.viewModalActionsFixed}>
                  <TouchableOpacity
                    style={styles.viewModalPrimaryBtn}
                    onPress={() => {
                      setViewModalVisible(false);
                      setTimeout(() => openStatusModal(selectedIssue), 300);
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.viewModalPrimaryBtnText}>Update Status</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.viewModalSecondaryBtn}
                    onPress={() => {
                      setViewModalVisible(false);
                      setTimeout(() => openAssignModal(selectedIssue), 300);
                    }}
                  >
                    <Ionicons name="person-add" size={20} color="#9C27B0" />
                    <Text style={styles.viewModalSecondaryBtnText}>Assign</Text>
                  </TouchableOpacity>

                  {selectedIssue.twitter_data && (
                    <TouchableOpacity
                      style={styles.viewModalSecondaryBtn}
                      onPress={() => openTweet(selectedIssue.twitter_data!.tweet_id)}
                    >
                      <Ionicons name="logo-twitter" size={20} color="#1DA1F2" />
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  syncButtonDisabled: {
    opacity: 0.7,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  splitSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    marginTop: 4,
  },
  seeAllText: {
    fontSize: 13,
    color: '#1DA1F2',
    fontWeight: '600',
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    width: (screenWidth - 56) / 3,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },

  // Category Bars
  categoryBarContainer: {
    marginBottom: 12,
  },
  categoryBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryBarLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryBarName: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  categoryBarCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  categoryBarTrack: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryBarStats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  categoryBarStat: {
    fontSize: 10,
    color: '#999',
  },

  // Source Analysis
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceInfo: {
    flex: 1,
  },
  sourceLabel: {
    fontSize: 12,
    color: '#666',
  },
  sourceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
  engagementGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  engagementStat: {
    alignItems: 'center',
    gap: 4,
  },
  engagementStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  pendingLocationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  pendingLocationText: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
  },

  // Official Cards
  officialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  officialRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  officialRankText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  officialInfo: {
    flex: 1,
  },
  officialName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  officialDesignation: {
    fontSize: 11,
    color: '#999',
  },
  officialStats: {
    alignItems: 'flex-end',
  },
  officialRate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  gradeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Area Cards
  areaCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  areaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  areaName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  areaStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  areaStat: {
    alignItems: 'center',
  },
  areaStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  areaStatLabel: {
    fontSize: 10,
    color: '#999',
  },

  // Complaint Cards
  complaintCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  complaintUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  complaintAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  complaintAvatarPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  complaintUserDetails: {
    flex: 1,
  },
  complaintUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  complaintSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  complaintHandle: {
    fontSize: 12,
    color: '#657786',
  },
  complaintHeaderRight: {
    alignItems: 'flex-end',
  },
  complaintTime: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  complaintContent: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  complaintPhotoContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  complaintPhoto: {
    width: '100%',
    height: '100%',
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  photoCountText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  complaintDetails: {
    flex: 1,
    marginLeft: 0,
  },
  complaintTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  complaintDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  complaintTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E8F5FE',
    gap: 4,
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1DA1F2',
  },
  upvoteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    gap: 2,
  },
  upvoteText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
  },
  complaintLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 4,
  },
  complaintLocationText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  locationWarning: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  locationWarningText: {
    fontSize: 10,
    color: '#FF9800',
    fontWeight: '600',
  },
  complaintEngagement: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 20,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementText: {
    fontSize: 12,
    color: '#657786',
  },
  complaintActions: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    gap: 4,
  },
  twitterButton: {
    backgroundColor: '#E8F5FE',
  },
  assignButton: {
    backgroundColor: '#F3E5F5',
  },
  updateButton: {
    backgroundColor: '#E8F5E9',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },

  // Filters
  filterChips: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterChipActive: {
    backgroundColor: '#FF5722',
    borderColor: '#FF5722',
  },
  filterChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  issuesCount: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    marginBottom: 12,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  viewModalContent: {
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  modalLoader: {
    marginTop: 16,
  },

  // Status Modal
  statusOptions: {
    gap: 10,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 10,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },

  // Assign Modal
  officialsList: {
    maxHeight: 400,
  },
  officialOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    marginBottom: 10,
  },
  officialAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  officialOptionInfo: {
    flex: 1,
  },
  officialOptionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  officialOptionDesignation: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  officialOptionDept: {
    fontSize: 12,
    color: '#999',
    marginTop: 1,
  },
  noOfficialsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noOfficialsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  noOfficialsSubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },

  // View Modal - Redesigned V2
  viewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  viewModalContainer: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  viewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  viewModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  viewModalBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewModalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  viewModalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewModalHeaderStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  viewModalHeaderStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  viewModalHeaderStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewModalBody: {
    flex: 1,
    padding: 16,
  },
  viewModalCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  viewModalCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  viewModalCategoryBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  viewModalSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#E8F5FE',
    gap: 4,
  },
  viewModalSourceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1DA1F2',
  },
  viewModalIdText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 'auto',
  },
  viewModalTitleNew: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    lineHeight: 26,
  },
  viewModalDescNew: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    marginBottom: 16,
  },
  // Photo Card
  viewModalPhotoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  viewModalPhotoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  viewModalPhotoCardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  viewModalPhotoCount: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  viewModalPhotoScroll: {
    marginHorizontal: -4,
  },
  viewModalPhotoScrollContent: {
    paddingHorizontal: 4,
    gap: 12,
  },
  viewModalPhotoItem: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  viewModalPhotoImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  viewModalPhotoIndex: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewModalPhotoIndexText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  // Info Card Full Width
  viewModalInfoCardFull: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  viewModalInfoCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  viewModalInfoCardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  viewModalInfoCardSmallLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  viewModalInfoCardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    lineHeight: 20,
  },
  viewModalInfoCardSubValue: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  viewModalReporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  viewModalReporterAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  viewModalReporterAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewModalReporterInfo: {
    flex: 1,
  },
  viewModalReporterNameNew: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  viewModalReporterHandleNew: {
    fontSize: 12,
    color: '#1DA1F2',
    marginTop: 2,
  },
  viewModalLocationPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  viewModalLocationPendingText: {
    fontSize: 11,
    color: '#FF9800',
    fontWeight: '500',
  },
  // Twitter Card
  viewModalTwitterCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8F5FE',
  },
  viewModalTwitterCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewModalTwitterLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1DA1F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  viewModalTwitterHeaderText: {
    flex: 1,
  },
  viewModalTwitterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  viewModalTwitterSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 1,
  },
  viewModalViewTweetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  viewModalViewTweetText: {
    fontSize: 12,
    color: '#1DA1F2',
    fontWeight: '600',
  },
  viewModalTwitterStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    paddingVertical: 16,
  },
  viewModalTwitterStat: {
    alignItems: 'center',
    flex: 1,
  },
  viewModalTwitterStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e8f4fd',
  },
  viewModalTwitterStatNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 6,
  },
  viewModalTwitterStatLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  // Action Buttons
  viewModalActionsFixed: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  viewModalPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  viewModalPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  viewModalSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 6,
  },
  viewModalSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9C27B0',
  },
});
