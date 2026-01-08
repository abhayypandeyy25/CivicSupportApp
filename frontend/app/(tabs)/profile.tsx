import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { apiService, Issue, User } from '../../src/services/api';
import IssueCard from '../../src/components/IssueCard';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'issues' | 'settings'>('issues');

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const [profileRes, issuesRes] = await Promise.all([
        apiService.getCurrentUser(),
        apiService.getMyIssues({ limit: 20 }),
      ]);
      setUserProfile(profileRes.data);
      setMyIssues(issuesRes.data);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleUpvote = async (issueId: string) => {
    try {
      const response = await apiService.upvoteIssue(issueId);
      setMyIssues((prev) =>
        prev.map((issue) =>
          issue.id === issueId ? response.data : issue
        )
      );
    } catch (error) {
      console.error('Error upvoting:', error);
    }
  };

  const getStats = () => {
    const total = myIssues.length;
    const pending = myIssues.filter((i) => i.status === 'pending').length;
    const resolved = myIssues.filter((i) => i.status === 'resolved').length;
    const totalUpvotes = myIssues.reduce((sum, i) => sum + i.upvotes, 0);
    return { total, pending, resolved, totalUpvotes };
  };

  const stats = getStats();

  const renderSettingsContent = () => (
    <View style={styles.settingsContainer}>
      <TouchableOpacity style={styles.settingsItem}>
        <View style={styles.settingsIconContainer}>
          <Ionicons name="person-outline" size={22} color="#FF5722" />
        </View>
        <View style={styles.settingsInfo}>
          <Text style={styles.settingsTitle}>Edit Profile</Text>
          <Text style={styles.settingsSubtitle}>Update your personal information</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem}>
        <View style={styles.settingsIconContainer}>
          <Ionicons name="notifications-outline" size={22} color="#FF5722" />
        </View>
        <View style={styles.settingsInfo}>
          <Text style={styles.settingsTitle}>Notifications</Text>
          <Text style={styles.settingsSubtitle}>Manage notification preferences</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem}>
        <View style={styles.settingsIconContainer}>
          <Ionicons name="location-outline" size={22} color="#FF5722" />
        </View>
        <View style={styles.settingsInfo}>
          <Text style={styles.settingsTitle}>Location Settings</Text>
          <Text style={styles.settingsSubtitle}>Manage location preferences</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem}>
        <View style={styles.settingsIconContainer}>
          <Ionicons name="help-circle-outline" size={22} color="#FF5722" />
        </View>
        <View style={styles.settingsInfo}>
          <Text style={styles.settingsTitle}>Help & Support</Text>
          <Text style={styles.settingsSubtitle}>FAQs and contact support</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem}>
        <View style={styles.settingsIconContainer}>
          <Ionicons name="document-text-outline" size={22} color="#FF5722" />
        </View>
        <View style={styles.settingsInfo}>
          <Text style={styles.settingsTitle}>Terms & Privacy</Text>
          <Text style={styles.settingsSubtitle}>Read our policies</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.settingsItem, styles.signOutItem]}
        onPress={handleSignOut}
      >
        <View style={[styles.settingsIconContainer, styles.signOutIcon]}>
          <Ionicons name="log-out-outline" size={22} color="#F44336" />
        </View>
        <View style={styles.settingsInfo}>
          <Text style={[styles.settingsTitle, styles.signOutText]}>Sign Out</Text>
          <Text style={styles.settingsSubtitle}>Sign out of your account</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF5722" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userProfile?.display_name?.charAt(0)?.toUpperCase() ||
                user?.email?.charAt(0)?.toUpperCase() ||
                'U'}
            </Text>
          </View>
          <Text style={styles.userName}>
            {userProfile?.display_name || user?.email?.split('@')[0] || 'User'}
          </Text>
          <Text style={styles.userContact}>
            {userProfile?.phone_number || user?.phoneNumber || user?.email || 'Demo User'}
          </Text>
          {userProfile?.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#999" />
              <Text style={styles.locationText}>
                {userProfile.location.area || userProfile.location.city || 'Delhi'}
              </Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Issues</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.resolved}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalUpvotes}</Text>
            <Text style={styles.statLabel}>Upvotes</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'issues' && styles.tabActive]}
            onPress={() => setActiveTab('issues')}
          >
            <Text style={[styles.tabText, activeTab === 'issues' && styles.tabTextActive]}>
              My Issues
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
            onPress={() => setActiveTab('settings')}
          >
            <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
              Settings
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'issues' ? (
          myIssues.length > 0 ? (
            myIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onUpvote={handleUpvote}
                currentUserId={userProfile?.id}
              />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No Issues Yet</Text>
              <Text style={styles.emptyText}>
                You haven't reported any civic issues yet
              </Text>
              <TouchableOpacity
                style={styles.reportButton}
                onPress={() => router.push('/(tabs)/upload')}
              >
                <Text style={styles.reportButtonText}>Report an Issue</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          renderSettingsContent()
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  userContact: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  locationText: {
    fontSize: 13,
    color: '#999',
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF5722',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#f0f0f0',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FF5722',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  reportButton: {
    marginTop: 20,
    backgroundColor: '#FF5722',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  reportButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  settingsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  settingsIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingsInfo: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  settingsSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  signOutItem: {
    marginTop: 10,
  },
  signOutIcon: {
    backgroundColor: '#FFEBEE',
  },
  signOutText: {
    color: '#F44336',
  },
});
