import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import IssueCard from '../../src/components/IssueCard';
import CategoryPicker from '../../src/components/CategoryPicker';
import { apiService, Issue, Category, Location as LocationType, SortOption, IssueStats } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const sortOptions: { value: SortOption; label: string; icon: string }[] = [
  { value: 'newest', label: 'Newest', icon: 'time-outline' },
  { value: 'upvotes', label: 'Most Upvoted', icon: 'arrow-up-circle-outline' },
  { value: 'priority', label: 'Trending', icon: 'flame-outline' },
  { value: 'oldest', label: 'Oldest', icon: 'hourglass-outline' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<LocationType | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationPermissionAsked, setLocationPermissionAsked] = useState(false);
  const [radius, setRadius] = useState(10);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [tempRadius, setTempRadius] = useState(10);

  // New state for search, sort, and stats
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSortModal, setShowSortModal] = useState(false);
  const [stats, setStats] = useState<IssueStats | null>(null);
  const [showStats, setShowStats] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const { user } = useAuth();

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([
        fetchCategories(),
        fetchStats(),
        requestLocationPermission(),
      ]);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [selectedCategory, selectedStatus, radius, userLocation, locationEnabled, sortBy]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchIssues();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermissionAsked(true);

      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        let address;
        try {
          const [addr] = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          address = addr;
        } catch (e) {
          console.log('Reverse geocode failed:', e);
        }

        const userLoc: LocationType = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: address ? `${address.street || ''}, ${address.district || ''}, ${address.city || ''}`.replace(/^, |, $/g, '') : undefined,
          area: address?.district || address?.subregion || undefined,
          city: address?.city || 'Delhi',
        };

        setUserLocation(userLoc);
        setLocationEnabled(true);
        return userLoc;
      } else {
        setLocationEnabled(false);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationEnabled(false);
    }
    return null;
  };

  const fetchCategories = async () => {
    try {
      const response = await apiService.getCategories();
      setCategories([{ id: '', name: 'All', icon: 'apps' }, ...response.data.categories]);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiService.getIssueStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchIssues = async () => {
    try {
      const params: any = { limit: 50, sort_by: sortBy };

      if (selectedCategory) {
        params.category = selectedCategory;
      }

      if (selectedStatus) {
        params.status = selectedStatus;
      }

      if (searchQuery.length >= 2) {
        params.search = searchQuery;
      }

      if (userLocation && locationEnabled) {
        params.latitude = userLocation.latitude;
        params.longitude = userLocation.longitude;
        params.radius_km = radius;
      }

      const response = await apiService.getIssues(params);
      setIssues(response.data);
    } catch (error) {
      console.error('Error fetching issues:', error);
      setIssues([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (locationEnabled) {
      await requestLocationPermission();
    }
    await Promise.all([fetchIssues(), fetchStats()]);
    setRefreshing(false);
  };

  const handleUpvote = async (issueId: string) => {
    try {
      const response = await apiService.upvoteIssue(issueId);
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === issueId ? response.data : issue
        )
      );
    } catch (error) {
      console.error('Error upvoting:', error);
      Alert.alert('Login Required', 'Please login to upvote issues');
    }
  };

  const handleIssuePress = (issue: Issue) => {
    router.push(`/issue/${issue.id}`);
  };

  const handleApplyRadius = () => {
    setRadius(tempRadius);
    setShowLocationModal(false);
  };

  const renderStatsSection = () => {
    if (!stats || !showStats) return null;

    return (
      <View style={styles.statsSection}>
        <View style={styles.statsSectionHeader}>
          <Text style={styles.statsSectionTitle}>Issue Statistics</Text>
          <TouchableOpacity onPress={() => setShowStats(false)}>
            <Ionicons name="close-circle-outline" size={20} color="#999" />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.statsCards}>
            <View style={[styles.statsCard, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="hourglass-outline" size={24} color="#FF9800" />
              <Text style={styles.statsNumber}>{stats.pending}</Text>
              <Text style={styles.statsLabel}>Pending</Text>
            </View>
            <View style={[styles.statsCard, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="construct-outline" size={24} color="#2196F3" />
              <Text style={styles.statsNumber}>{stats.in_progress}</Text>
              <Text style={styles.statsLabel}>In Progress</Text>
            </View>
            <View style={[styles.statsCard, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#4CAF50" />
              <Text style={styles.statsNumber}>{stats.resolved}</Text>
              <Text style={styles.statsLabel}>Resolved</Text>
            </View>
            <View style={[styles.statsCard, { backgroundColor: '#F3E5F5' }]}>
              <Ionicons name="document-text-outline" size={24} color="#9C27B0" />
              <Text style={styles.statsNumber}>{stats.total_issues}</Text>
              <Text style={styles.statsLabel}>Total</Text>
            </View>
            <View style={[styles.statsCard, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="trending-up-outline" size={24} color="#F44336" />
              <Text style={styles.statsNumber}>{stats.recent_week}</Text>
              <Text style={styles.statsLabel}>This Week</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Title */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.title}>Civic Issues</Text>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search issues..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortModal(true)}
        >
          <Ionicons name="funnel-outline" size={20} color="#FF5722" />
        </TouchableOpacity>
      </View>

      {/* Stats Section */}
      {renderStatsSection()}

      {/* Location & Filter Row */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.locationButton, locationEnabled && styles.locationButtonActive]}
          onPress={() => setShowLocationModal(true)}
        >
          <Ionicons
            name={locationEnabled ? "location" : "location-outline"}
            size={18}
            color={locationEnabled ? "#FF5722" : "#999"}
          />
          <Text style={[styles.locationButtonText, locationEnabled && styles.locationButtonTextActive]}>
            {locationEnabled ? `${radius} km` : 'Location'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sortChip}
          onPress={() => setShowSortModal(true)}
        >
          <Ionicons
            name={sortOptions.find(s => s.value === sortBy)?.icon as any || 'time-outline'}
            size={16}
            color="#666"
          />
          <Text style={styles.sortChipText}>
            {sortOptions.find(s => s.value === sortBy)?.label || 'Newest'}
          </Text>
        </TouchableOpacity>

        {!showStats && stats && (
          <TouchableOpacity
            style={styles.showStatsButton}
            onPress={() => setShowStats(true)}
          >
            <Ionicons name="stats-chart-outline" size={16} color="#FF5722" />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filter Row */}
      <View style={styles.statusFilterRow}>
        <TouchableOpacity
          style={[styles.statusChip, !selectedStatus && styles.statusChipActive]}
          onPress={() => setSelectedStatus('')}
        >
          <Text style={[styles.statusChipText, !selectedStatus && styles.statusChipTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statusChip, selectedStatus === 'pending' && styles.statusChipPending]}
          onPress={() => setSelectedStatus(selectedStatus === 'pending' ? '' : 'pending')}
        >
          <Ionicons name="hourglass-outline" size={14} color={selectedStatus === 'pending' ? '#fff' : '#FF9800'} />
          <Text style={[styles.statusChipText, selectedStatus === 'pending' && styles.statusChipTextActive]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statusChip, selectedStatus === 'in_progress' && styles.statusChipInProgress]}
          onPress={() => setSelectedStatus(selectedStatus === 'in_progress' ? '' : 'in_progress')}
        >
          <Ionicons name="construct-outline" size={14} color={selectedStatus === 'in_progress' ? '#fff' : '#2196F3'} />
          <Text style={[styles.statusChipText, selectedStatus === 'in_progress' && styles.statusChipTextActive]}>In Progress</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statusChip, selectedStatus === 'resolved' && styles.statusChipResolved]}
          onPress={() => setSelectedStatus(selectedStatus === 'resolved' ? '' : 'resolved')}
        >
          <Ionicons name="checkmark-circle-outline" size={14} color={selectedStatus === 'resolved' ? '#fff' : '#4CAF50'} />
          <Text style={[styles.statusChipText, selectedStatus === 'resolved' && styles.statusChipTextActive]}>Resolved</Text>
        </TouchableOpacity>
      </View>

      {/* Location Info */}
      {locationEnabled && userLocation && (
        <View style={styles.locationInfo}>
          <Ionicons name="location" size={14} color="#4CAF50" />
          <Text style={styles.locationInfoText} numberOfLines={1}>
            {userLocation.address || userLocation.area || 'Your Location'}
          </Text>
        </View>
      )}

      {/* Categories */}
      <CategoryPicker
        categories={categories}
        selectedCategory={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {/* Results Count */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>
          {issues.length} issue{issues.length !== 1 ? 's' : ''} found
          {searchQuery ? ` for "${searchQuery}"` : ''}
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Issues Found</Text>
      <Text style={styles.emptyText}>
        {searchQuery
          ? `No results for "${searchQuery}"`
          : selectedCategory
            ? `No ${selectedCategory.replace('_', ' ')} issues ${locationEnabled ? 'within ' + radius + ' km' : 'found'}`
            : locationEnabled
              ? `No issues found within ${radius} km`
              : 'No civic issues reported yet'}
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
        <Text style={styles.refreshButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  // Sort Modal
  const renderSortModal = () => (
    <Modal
      visible={showSortModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowSortModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowSortModal(false)}
      >
        <View style={styles.sortModalContent}>
          <Text style={styles.sortModalTitle}>Sort By</Text>
          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && styles.sortOptionActive,
              ]}
              onPress={() => {
                setSortBy(option.value);
                setShowSortModal(false);
              }}
            >
              <Ionicons
                name={option.icon as any}
                size={20}
                color={sortBy === option.value ? '#FF5722' : '#666'}
              />
              <Text
                style={[
                  styles.sortOptionText,
                  sortBy === option.value && styles.sortOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
              {sortBy === option.value && (
                <Ionicons name="checkmark" size={20} color="#FF5722" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Location Filter Modal
  const renderLocationModal = () => (
    <Modal
      visible={showLocationModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowLocationModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.locationModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Location Filter</Text>
            <TouchableOpacity onPress={() => setShowLocationModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {locationEnabled && userLocation ? (
            <>
              <View style={styles.currentLocation}>
                <Ionicons name="location" size={20} color="#4CAF50" />
                <Text style={styles.currentLocationText} numberOfLines={2}>
                  {userLocation.address || `${userLocation.area}, ${userLocation.city}`}
                </Text>
              </View>

              <View style={styles.sliderSection}>
                <Text style={styles.sliderLabel}>Search Radius: {tempRadius} km</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={50}
                  step={1}
                  value={tempRadius}
                  onValueChange={setTempRadius}
                  minimumTrackTintColor="#FF5722"
                  maximumTrackTintColor="#ddd"
                  thumbTintColor="#FF5722"
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderMinMax}>1 km</Text>
                  <Text style={styles.sliderMinMax}>50 km</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.applyButton} onPress={handleApplyRadius}>
                <Text style={styles.applyButtonText}>Apply Filter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.disableButton}
                onPress={() => { setLocationEnabled(false); setShowLocationModal(false); }}
              >
                <Text style={styles.disableButtonText}>Show All Issues (No Location Filter)</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.enableLocationSection}>
              <Ionicons name="location-outline" size={48} color="#FF5722" />
              <Text style={styles.enableLocationTitle}>Enable Location</Text>
              <Text style={styles.enableLocationText}>
                Allow location access to see issues near you and filter by distance.
              </Text>
              <TouchableOpacity style={styles.applyButton} onPress={() => { requestLocationPermission(); setShowLocationModal(false); }}>
                <Text style={styles.applyButtonText}>Enable Location</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF5722" />
          <Text style={styles.loadingText}>Loading issues...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={issues}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <IssueCard
            issue={item}
            onUpvote={handleUpvote}
            onPress={handleIssuePress}
            currentUserId={user?.uid}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FF5722"
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      {renderLocationModal()}
      {renderSortModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  headerContainer: { backgroundColor: '#fff', paddingTop: 8, paddingBottom: 12, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, marginBottom: 8 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  greeting: { fontSize: 14, color: '#666' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  notificationButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },

  // Search
  searchContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, alignItems: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 15, color: '#333', marginLeft: 8 },
  sortButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

  // Stats Section
  statsSection: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginBottom: 8 },
  statsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  statsSectionTitle: { fontSize: 14, fontWeight: '600', color: '#666' },
  statsCards: { flexDirection: 'row', paddingHorizontal: 12 },
  statsCard: { width: 90, padding: 12, borderRadius: 12, alignItems: 'center', marginHorizontal: 4 },
  statsNumber: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 4 },
  statsLabel: { fontSize: 11, color: '#666', marginTop: 2 },

  // Filter Row
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, alignItems: 'center' },
  locationButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  locationButtonActive: { backgroundColor: '#FFF3E0' },
  locationButtonText: { fontSize: 13, color: '#999', marginLeft: 4 },
  locationButtonTextActive: { color: '#FF5722', fontWeight: '500' },
  sortChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  sortChipText: { fontSize: 13, color: '#666', marginLeft: 4 },
  showStatsButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center' },

  // Status Filter
  statusFilterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, flexWrap: 'wrap', gap: 8 },
  statusChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 4 },
  statusChipActive: { backgroundColor: '#FF5722' },
  statusChipPending: { backgroundColor: '#FF9800' },
  statusChipInProgress: { backgroundColor: '#2196F3' },
  statusChipResolved: { backgroundColor: '#4CAF50' },
  statusChipText: { fontSize: 12, color: '#666' },
  statusChipTextActive: { color: '#fff', fontWeight: '500' },

  locationInfo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  locationInfoText: { fontSize: 12, color: '#666', marginLeft: 4, flex: 1 },

  resultsRow: { paddingHorizontal: 16, marginTop: 8 },
  resultsText: { fontSize: 13, color: '#999' },

  listContent: { paddingBottom: 20 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 8 },
  refreshButton: { marginTop: 20, backgroundColor: '#FF5722', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  refreshButtonText: { color: '#fff', fontWeight: '600' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  locationModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 300 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  currentLocation: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', padding: 12, borderRadius: 12, marginBottom: 20 },
  currentLocationText: { flex: 1, fontSize: 14, color: '#333', marginLeft: 8 },
  sliderSection: { marginBottom: 20 },
  sliderLabel: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12, textAlign: 'center' },
  slider: { width: '100%', height: 40 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderMinMax: { fontSize: 12, color: '#999' },
  applyButton: { backgroundColor: '#FF5722', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  applyButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disableButton: { paddingVertical: 12, alignItems: 'center' },
  disableButtonText: { color: '#666', fontSize: 14 },
  enableLocationSection: { alignItems: 'center', paddingVertical: 20 },
  enableLocationTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16 },
  enableLocationText: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, marginBottom: 20, paddingHorizontal: 20 },

  // Sort Modal
  sortModalContent: { backgroundColor: '#fff', borderRadius: 16, margin: 20, padding: 16 },
  sortModalTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 16, textAlign: 'center' },
  sortOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 8 },
  sortOptionActive: { backgroundColor: '#FFF3E0' },
  sortOptionText: { flex: 1, fontSize: 15, color: '#666', marginLeft: 12 },
  sortOptionTextActive: { color: '#FF5722', fontWeight: '600' },
});
