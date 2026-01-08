import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiService, GovtOfficial } from '../../src/services/api';

interface HierarchyGroup {
  level: number;
  designation: string;
  count: number;
  officials: {
    id: string;
    name: string;
    designation: string;
    department: string;
    area?: string;
  }[];
}

const hierarchyIcons: { [key: string]: string } = {
  Parshad: 'person-outline',
  MCD: 'business-outline',
  IAS: 'briefcase-outline',
  MLA: 'people-outline',
  MP: 'globe-outline',
  CM: 'ribbon-outline',
  PM: 'flag-outline',
};

const hierarchyColors: { [key: string]: string } = {
  Parshad: '#4CAF50',
  MCD: '#2196F3',
  IAS: '#9C27B0',
  MLA: '#FF9800',
  MP: '#E91E63',
  CM: '#00BCD4',
  PM: '#F44336',
};

export default function OfficialsScreen() {
  const [hierarchyGroups, setHierarchyGroups] = useState<HierarchyGroup[]>([]);
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOfficials = async () => {
    try {
      const response = await apiService.getOfficialsByHierarchy();
      setHierarchyGroups(response.data);
    } catch (error) {
      console.error('Error fetching officials:', error);
      // Set demo data
      setHierarchyGroups([
        { level: 1, designation: 'Parshad', count: 0, officials: [] },
        { level: 2, designation: 'MCD', count: 0, officials: [] },
        { level: 3, designation: 'IAS', count: 0, officials: [] },
        { level: 4, designation: 'MLA', count: 0, officials: [] },
        { level: 5, designation: 'MP', count: 0, officials: [] },
        { level: 6, designation: 'CM', count: 0, officials: [] },
        { level: 7, designation: 'PM', count: 0, officials: [] },
      ]);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchOfficials();
      setLoading(false);
    };
    init();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOfficials();
    setRefreshing(false);
  };

  const toggleExpand = (level: number) => {
    setExpandedLevel(expandedLevel === level ? null : level);
  };

  const renderOfficialItem = (official: HierarchyGroup['officials'][0]) => (
    <View key={official.id} style={styles.officialItem}>
      <View style={styles.officialAvatar}>
        <Text style={styles.officialAvatarText}>
          {official.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.officialInfo}>
        <Text style={styles.officialName}>{official.name}</Text>
        <Text style={styles.officialDetails}>
          {official.department}
          {official.area ? ` • ${official.area}` : ''}
        </Text>
      </View>
      <TouchableOpacity style={styles.contactButton}>
        <Ionicons name="mail-outline" size={18} color="#FF5722" />
      </TouchableOpacity>
    </View>
  );

  const renderHierarchyItem = ({ item }: { item: HierarchyGroup }) => {
    const isExpanded = expandedLevel === item.level;
    const color = hierarchyColors[item.designation] || '#666';
    const icon = hierarchyIcons[item.designation] || 'person-outline';

    return (
      <View style={styles.hierarchyCard}>
        <TouchableOpacity
          style={styles.hierarchyHeader}
          onPress={() => toggleExpand(item.level)}
        >
          <View style={[styles.hierarchyIcon, { backgroundColor: `${color}20` }]}>
            <Ionicons name={icon as any} size={24} color={color} />
          </View>
          <View style={styles.hierarchyInfo}>
            <Text style={styles.hierarchyTitle}>{item.designation}</Text>
            <Text style={styles.hierarchySubtitle}>
              {item.count} {item.count === 1 ? 'official' : 'officials'}
            </Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Level {item.level}</Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#666"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.officialsContainer}>
            {item.officials.length > 0 ? (
              item.officials.map(renderOfficialItem)
            ) : (
              <View style={styles.emptyOfficialsContainer}>
                <Text style={styles.emptyOfficialsText}>
                  No officials added yet
                </Text>
                <Text style={styles.emptyOfficialsSubtext}>
                  Officials will appear here once added by admin
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF5722" />
          <Text style={styles.loadingText}>Loading officials...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Government Officials</Text>
        <Text style={styles.headerSubtitle}>
          Delhi Government Hierarchy
        </Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color="#2196F3" />
        <Text style={styles.infoText}>
          Issues are automatically assigned to the appropriate level based on category
        </Text>
      </View>

      {/* Hierarchy List */}
      <FlatList
        data={hierarchyGroups}
        keyExtractor={(item) => item.level.toString()}
        renderItem={renderHierarchyItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FF5722"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Officials Found</Text>
            <Text style={styles.emptyText}>
              Officials data will be loaded by admin
            </Text>
          </View>
        }
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
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1976D2',
    marginLeft: 10,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  hierarchyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  hierarchyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  hierarchyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hierarchyInfo: {
    flex: 1,
  },
  hierarchyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  hierarchySubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  levelBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  levelText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  officialsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    padding: 12,
  },
  officialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  officialAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  officialAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  officialInfo: {
    flex: 1,
  },
  officialName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  officialDetails: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  contactButton: {
    padding: 8,
  },
  emptyOfficialsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyOfficialsText: {
    fontSize: 14,
    color: '#999',
  },
  emptyOfficialsSubtext: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
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
    marginTop: 8,
  },
});
