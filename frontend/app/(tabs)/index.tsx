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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import IssueCard from '../../src/components/IssueCard';
import CategoryPicker from '../../src/components/CategoryPicker';
import { apiService, Issue, Category, Location as LocationType } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

export default function HomeScreen() {
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
  const { user } = useAuth();

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchCategories();
      await requestLocationPermission();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [selectedCategory, radius, userLocation, locationEnabled]);

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
        console.log('Location obtained:', userLoc);
        return userLoc;
      } else {
        Alert.alert(
          'Location Permission',
          'Location access helps show issues near you. You can still browse all issues without it.',
          [{ text: 'OK' }]
        );
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

  const fetchIssues = async () => {
    try {
      const params: any = { limit: 50 };

      if (selectedCategory) {
        params.category = selectedCategory;
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
    await fetchIssues();
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

  const handleApplyRadius = () => {
    setRadius(tempRadius);
    setShowLocationModal(false);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Title */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.title}>Civic Issues Near You</Text>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Location & Filter */}
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
            {locationEnabled ? `${radius} km radius` : 'Enable Location'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={locationEnabled ? "#FF5722" : "#999"} />
        </TouchableOpacity>

        {!locationEnabled && locationPermissionAsked && (
          <TouchableOpacity 
            style={styles.enableButton}
            onPress={requestLocationPermission}
          >
            <Text style={styles.enableButtonText}>Enable</Text>
          </TouchableOpacity>
        )}
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
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Issues Found</Text>
      <Text style={styles.emptyText}>
        {selectedCategory
          ? `No ${selectedCategory.replace('_', ' ')} issues ${locationEnabled ? 'within ' + radius + ' km' : 'found'}`
          : locationEnabled 
            ? `No issues found within ${radius} km of your location`
            : 'No civic issues reported yet'}
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
        <Text style={styles.refreshButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
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
        <View style={styles.modalContent}>
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
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, alignItems: 'center' },
  locationButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  locationButtonActive: { backgroundColor: '#FFF3E0' },
  locationButtonText: { fontSize: 13, color: '#999', marginHorizontal: 6 },
  locationButtonTextActive: { color: '#FF5722', fontWeight: '500' },
  enableButton: { backgroundColor: '#FF5722', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  enableButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  locationInfo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  locationInfoText: { fontSize: 12, color: '#666', marginLeft: 4, flex: 1 },
  listContent: { paddingBottom: 20 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 8 },
  refreshButton: { marginTop: 20, backgroundColor: '#FF5722', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  refreshButtonText: { color: '#fff', fontWeight: '600' },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 300 },
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
});
