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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import IssueCard from '../../src/components/IssueCard';
import CategoryPicker from '../../src/components/CategoryPicker';
import LocationFilter from '../../src/components/LocationFilter';
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
  const [radius, setRadius] = useState(5);
  const { user } = useAuth();

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        const userLoc: LocationType = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: address ? `${address.street || ''}, ${address.city || ''}, ${address.region || ''}` : undefined,
          area: address?.district || address?.subregion || undefined,
          city: address?.city || 'Delhi',
        };

        setUserLocation(userLoc);
        setLocationEnabled(true);
        return userLoc;
      } else {
        Alert.alert(
          'Location Permission',
          'Location permission is needed to show issues near you. You can still browse all issues.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error getting location:', error);
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

  const fetchIssues = async (location?: LocationType | null) => {
    try {
      const params: any = {
        limit: 50,
      };

      if (selectedCategory) {
        params.category = selectedCategory;
      }

      if (location && locationEnabled) {
        params.latitude = location.latitude;
        params.longitude = location.longitude;
        params.radius_km = radius;
      }

      const response = await apiService.getIssues(params);
      setIssues(response.data);
    } catch (error) {
      console.error('Error fetching issues:', error);
      // Show some dummy data for demo
      setIssues([]);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchCategories();
      const location = await requestLocationPermission();
      await fetchIssues(location);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    fetchIssues(userLocation);
  }, [selectedCategory, radius]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchIssues(userLocation);
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
      Alert.alert('Error', 'Please login to upvote issues');
    }
  };

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
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
        <LocationFilter
          radius={radius}
          onRadiusChange={handleRadiusChange}
          locationEnabled={locationEnabled}
          address={userLocation?.address}
        />
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="filter-outline" size={18} color="#666" />
          <Text style={styles.filterText}>Filter</Text>
        </TouchableOpacity>
      </View>

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
          ? `No ${selectedCategory} issues in your area yet`
          : 'No civic issues reported in your area yet'}
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
        <Text style={styles.refreshButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  headerContainer: {
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
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
  refreshButton: {
    marginTop: 20,
    backgroundColor: '#FF5722',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
