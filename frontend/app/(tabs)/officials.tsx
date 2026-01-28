import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiService, OfficialWithStats, OfficialReportCard } from '../../src/services/api';

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

const gradeColors: { [key: string]: string } = {
  A: '#4CAF50',
  B: '#8BC34A',
  C: '#FFC107',
  D: '#FF9800',
  F: '#F44336',
};

const categoryIcons: { [key: string]: string } = {
  roads: 'car-outline',
  sanitation: 'trash-outline',
  water: 'water-outline',
  electricity: 'flash-outline',
  encroachment: 'alert-circle-outline',
  parks: 'leaf-outline',
  public_safety: 'shield-outline',
  health: 'medkit-outline',
  education: 'school-outline',
  transport: 'bus-outline',
  housing: 'home-outline',
  general: 'help-circle-outline',
};

export default function OfficialsScreen() {
  const [hierarchyGroups, setHierarchyGroups] = useState<HierarchyGroup[]>([]);
  const [officialsWithStats, setOfficialsWithStats] = useState<OfficialWithStats[]>([]);
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOfficial, setSelectedOfficial] = useState<string | null>(null);
  const [reportCard, setReportCard] = useState<OfficialReportCard | null>(null);
  const [loadingReportCard, setLoadingReportCard] = useState(false);
  const [viewMode, setViewMode] = useState<'hierarchy' | 'list'>('list');

  const fetchOfficials = async () => {
    try {
      const [hierarchyRes, officialsRes] = await Promise.all([
        apiService.getOfficialsByHierarchy(),
        apiService.getOfficials(),
      ]);
      setHierarchyGroups(hierarchyRes.data);
      setOfficialsWithStats(officialsRes.data);
    } catch (error) {
      console.error('Error fetching officials:', error);
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

  const fetchReportCard = async (officialId: string) => {
    setSelectedOfficial(officialId);
    setLoadingReportCard(true);
    try {
      const response = await apiService.getOfficialReportCard(officialId);
      setReportCard(response.data);
    } catch (error) {
      console.error('Error fetching report card:', error);
    } finally {
      setLoadingReportCard(false);
    }
  };

  const closeReportCard = () => {
    setSelectedOfficial(null);
    setReportCard(null);
  };

  const toggleExpand = (level: number) => {
    setExpandedLevel(expandedLevel === level ? null : level);
  };

  const renderOfficialCard = ({ item }: { item: OfficialWithStats }) => {
    const color = hierarchyColors[item.designation] || '#666';
    const icon = hierarchyIcons[item.designation] || 'person-outline';

    return (
      <TouchableOpacity
        style={styles.officialCard}
        onPress={() => fetchReportCard(item.id)}
      >
        <View style={styles.officialCardHeader}>
          <View style={[styles.officialAvatar, { backgroundColor: `${color}20` }]}>
            <Ionicons name={icon as any} size={24} color={color} />
          </View>
          <View style={styles.officialCardInfo}>
            <Text style={styles.officialCardName}>{item.name}</Text>
            <Text style={styles.officialCardDesignation}>
              {item.designation} • {item.department}
            </Text>
            {item.area && (
              <Text style={styles.officialCardArea}>
                <Ionicons name="location-outline" size={12} color="#999" /> {item.area}
              </Text>
            )}
          </View>
          <View style={styles.statsPreview}>
            <Text style={[styles.resolutionRate, { color: item.stats?.resolution_rate >= 50 ? '#4CAF50' : '#FF9800' }]}>
              {item.stats?.resolution_rate || 0}%
            </Text>
            <Text style={styles.statsLabel}>resolved</Text>
          </View>
        </View>

        <View style={styles.officialCardStats}>
          <View style={styles.statItem}>
            <Ionicons name="documents-outline" size={16} color="#666" />
            <Text style={styles.statValue}>{item.stats?.total_assigned || 0}</Text>
            <Text style={styles.statLabel}>Assigned</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
            <Text style={styles.statValue}>{item.stats?.resolved || 0}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="bar-chart-outline" size={16} color="#FF5722" />
            <Text style={styles.statValue}>View</Text>
            <Text style={styles.statLabel}>Report Card</Text>
          </View>
        </View>

        <View style={styles.categoriesRow}>
          {item.categories.slice(0, 4).map((cat) => (
            <View key={cat} style={styles.categoryBadge}>
              <Ionicons name={categoryIcons[cat] as any || 'help-circle-outline'} size={12} color="#666" />
              <Text style={styles.categoryBadgeText}>{cat}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  const renderReportCardModal = () => (
    <Modal
      visible={selectedOfficial !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeReportCard}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={closeReportCard} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Official Report Card</Text>
          <View style={{ width: 40 }} />
        </View>

        {loadingReportCard ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF5722" />
            <Text style={styles.loadingText}>Loading report card...</Text>
          </View>
        ) : reportCard ? (
          <ScrollView style={styles.reportCardContent} showsVerticalScrollIndicator={false}>
            {/* Official Info */}
            <View style={styles.reportHeader}>
              <View style={[styles.reportAvatar, { backgroundColor: `${hierarchyColors[reportCard.official.designation] || '#666'}20` }]}>
                <Ionicons
                  name={hierarchyIcons[reportCard.official.designation] as any || 'person-outline'}
                  size={40}
                  color={hierarchyColors[reportCard.official.designation] || '#666'}
                />
              </View>
              <Text style={styles.reportName}>{reportCard.official.name}</Text>
              <Text style={styles.reportDesignation}>
                {reportCard.official.designation} • {reportCard.official.department}
              </Text>
              {reportCard.official.area && (
                <Text style={styles.reportArea}>
                  <Ionicons name="location" size={14} color="#999" /> {reportCard.official.area}
                </Text>
              )}
            </View>

            {/* Performance Grade */}
            <View style={styles.gradeSection}>
              <View style={[styles.gradeBadge, { backgroundColor: gradeColors[reportCard.performance.grade] }]}>
                <Text style={styles.gradeText}>{reportCard.performance.grade}</Text>
              </View>
              <View style={styles.gradeInfo}>
                <Text style={styles.gradeLabel}>{reportCard.performance.grade_label}</Text>
                <Text style={styles.scoreText}>Performance Score: {reportCard.performance.score}/100</Text>
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statsGridItem}>
                <Ionicons name="documents" size={24} color="#2196F3" />
                <Text style={styles.statsGridValue}>{reportCard.stats.total_assigned}</Text>
                <Text style={styles.statsGridLabel}>Total Assigned</Text>
              </View>
              <View style={styles.statsGridItem}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                <Text style={styles.statsGridValue}>{reportCard.stats.resolved}</Text>
                <Text style={styles.statsGridLabel}>Resolved</Text>
              </View>
              <View style={styles.statsGridItem}>
                <Ionicons name="time" size={24} color="#FF9800" />
                <Text style={styles.statsGridValue}>{reportCard.stats.in_progress}</Text>
                <Text style={styles.statsGridLabel}>In Progress</Text>
              </View>
              <View style={styles.statsGridItem}>
                <Ionicons name="hourglass" size={24} color="#F44336" />
                <Text style={styles.statsGridValue}>{reportCard.stats.pending}</Text>
                <Text style={styles.statsGridLabel}>Pending</Text>
              </View>
            </View>

            {/* Resolution Stats */}
            <View style={styles.resolutionSection}>
              <View style={styles.resolutionItem}>
                <Text style={styles.resolutionLabel}>Resolution Rate</Text>
                <Text style={[styles.resolutionValue, { color: reportCard.stats.resolution_rate >= 50 ? '#4CAF50' : '#FF9800' }]}>
                  {reportCard.stats.resolution_rate}%
                </Text>
              </View>
              <View style={styles.resolutionDivider} />
              <View style={styles.resolutionItem}>
                <Text style={styles.resolutionLabel}>Avg. Resolution Time</Text>
                <Text style={styles.resolutionValue}>
                  {reportCard.stats.avg_resolution_days} days
                </Text>
              </View>
            </View>

            {/* Categories Breakdown */}
            {reportCard.categories_breakdown.length > 0 && (
              <View style={styles.categoriesSection}>
                <Text style={styles.sectionTitle}>Category Performance</Text>
                {reportCard.categories_breakdown.map((cat) => (
                  <View key={cat.category} style={styles.categoryRow}>
                    <View style={styles.categoryInfo}>
                      <Ionicons
                        name={categoryIcons[cat.category] as any || 'help-circle-outline'}
                        size={18}
                        color="#666"
                      />
                      <Text style={styles.categoryName}>{cat.category.replace('_', ' ')}</Text>
                    </View>
                    <View style={styles.categoryStats}>
                      <Text style={styles.categoryCount}>{cat.resolved}/{cat.total}</Text>
                      <View style={[styles.categoryBar, { width: 60 }]}>
                        <View
                          style={[
                            styles.categoryBarFill,
                            {
                              width: `${cat.resolution_rate}%`,
                              backgroundColor: cat.resolution_rate >= 50 ? '#4CAF50' : '#FF9800'
                            }
                          ]}
                        />
                      </View>
                      <Text style={styles.categoryRate}>{cat.resolution_rate}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Recent Resolved */}
            {reportCard.recent_resolved.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={styles.sectionTitle}>Recently Resolved</Text>
                {reportCard.recent_resolved.map((issue) => (
                  <View key={issue.id} style={styles.recentItem}>
                    <View style={styles.recentIcon}>
                      <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    </View>
                    <View style={styles.recentInfo}>
                      <Text style={styles.recentTitle} numberOfLines={1}>{issue.title}</Text>
                      <Text style={styles.recentMeta}>
                        {issue.category} • {issue.upvotes} upvotes
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Contact Info */}
            <View style={styles.contactSection}>
              <Text style={styles.sectionTitle}>Contact</Text>
              {reportCard.official.contact_email && (
                <View style={styles.contactRow}>
                  <Ionicons name="mail-outline" size={18} color="#666" />
                  <Text style={styles.contactText}>{reportCard.official.contact_email}</Text>
                </View>
              )}
              {reportCard.official.contact_phone && (
                <View style={styles.contactRow}>
                  <Ionicons name="call-outline" size={18} color="#666" />
                  <Text style={styles.contactText}>{reportCard.official.contact_phone}</Text>
                </View>
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        ) : (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#ccc" />
            <Text style={styles.errorText}>Could not load report card</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );

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
          View performance report cards
        </Text>
      </View>

      {/* View Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons name="grid-outline" size={18} color={viewMode === 'list' ? '#fff' : '#666'} />
          <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>
            All Officials
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'hierarchy' && styles.toggleButtonActive]}
          onPress={() => setViewMode('hierarchy')}
        >
          <Ionicons name="git-network-outline" size={18} color={viewMode === 'hierarchy' ? '#fff' : '#666'} />
          <Text style={[styles.toggleText, viewMode === 'hierarchy' && styles.toggleTextActive]}>
            By Hierarchy
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'list' ? (
        <FlatList
          data={officialsWithStats}
          keyExtractor={(item) => item.id}
          renderItem={renderOfficialCard}
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
      ) : (
        <FlatList
          data={hierarchyGroups}
          keyExtractor={(item) => item.level.toString()}
          renderItem={({ item }) => {
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
                      item.officials.map((official) => (
                        <TouchableOpacity
                          key={official.id}
                          style={styles.officialItem}
                          onPress={() => fetchReportCard(official.id)}
                        >
                          <View style={styles.officialItemAvatar}>
                            <Text style={styles.officialAvatarText}>
                              {official.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.officialItemInfo}>
                            <Text style={styles.officialItemName}>{official.name}</Text>
                            <Text style={styles.officialItemDetails}>
                              {official.department}
                              {official.area ? ` • ${official.area}` : ''}
                            </Text>
                          </View>
                          <View style={styles.viewReportButton}>
                            <Ionicons name="document-text-outline" size={16} color="#FF5722" />
                          </View>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <View style={styles.emptyOfficialsContainer}>
                        <Text style={styles.emptyOfficialsText}>No officials added yet</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FF5722"
            />
          }
        />
      )}

      {renderReportCardModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  headerSubtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  toggleContainer: { flexDirection: 'row', padding: 16, gap: 10 },
  toggleButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0' },
  toggleButtonActive: { backgroundColor: '#FF5722', borderColor: '#FF5722' },
  toggleText: { fontSize: 14, color: '#666', marginLeft: 6, fontWeight: '500' },
  toggleTextActive: { color: '#fff' },
  listContent: { padding: 16, paddingTop: 0, paddingBottom: 40 },
  officialCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  officialCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  officialAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  officialCardInfo: { flex: 1 },
  officialCardName: { fontSize: 16, fontWeight: '700', color: '#333' },
  officialCardDesignation: { fontSize: 13, color: '#666', marginTop: 2 },
  officialCardArea: { fontSize: 12, color: '#999', marginTop: 2 },
  statsPreview: { alignItems: 'center' },
  resolutionRate: { fontSize: 20, fontWeight: 'bold' },
  statsLabel: { fontSize: 11, color: '#999' },
  officialCardStats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f0f0f0', marginBottom: 12 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '600', color: '#333', marginTop: 4 },
  statLabel: { fontSize: 11, color: '#999', marginTop: 2 },
  categoriesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  categoryBadgeText: { fontSize: 11, color: '#666', marginLeft: 4, textTransform: 'capitalize' },
  hierarchyCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  hierarchyHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  hierarchyIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  hierarchyInfo: { flex: 1 },
  hierarchyTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  hierarchySubtitle: { fontSize: 13, color: '#999', marginTop: 2 },
  levelBadge: { backgroundColor: '#f5f5f5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 10 },
  levelText: { fontSize: 11, color: '#666', fontWeight: '600' },
  officialsContainer: { borderTopWidth: 1, borderTopColor: '#f0f0f0', padding: 12 },
  officialItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  officialItemAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF5722', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  officialAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  officialItemInfo: { flex: 1 },
  officialItemName: { fontSize: 14, fontWeight: '600', color: '#333' },
  officialItemDetails: { fontSize: 12, color: '#999', marginTop: 2 },
  viewReportButton: { padding: 8, backgroundColor: '#FFF3E0', borderRadius: 8 },
  emptyOfficialsContainer: { alignItems: 'center', paddingVertical: 20 },
  emptyOfficialsText: { fontSize: 14, color: '#999' },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#999', marginTop: 8 },
  // Modal styles
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  closeButton: { padding: 4 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  reportCardContent: { flex: 1, padding: 16 },
  reportHeader: { alignItems: 'center', marginBottom: 24 },
  reportAvatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  reportName: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  reportDesignation: { fontSize: 14, color: '#666', marginTop: 4 },
  reportArea: { fontSize: 14, color: '#999', marginTop: 4 },
  gradeSection: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', padding: 16, borderRadius: 12, marginBottom: 20 },
  gradeBadge: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  gradeText: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  gradeInfo: { flex: 1 },
  gradeLabel: { fontSize: 18, fontWeight: '600', color: '#333' },
  scoreText: { fontSize: 14, color: '#666', marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  statsGridItem: { width: '50%', alignItems: 'center', paddingVertical: 16, borderWidth: 0.5, borderColor: '#f0f0f0' },
  statsGridValue: { fontSize: 24, fontWeight: 'bold', color: '#333', marginTop: 8 },
  statsGridLabel: { fontSize: 12, color: '#999', marginTop: 4 },
  resolutionSection: { flexDirection: 'row', backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16, marginBottom: 20 },
  resolutionItem: { flex: 1, alignItems: 'center' },
  resolutionLabel: { fontSize: 12, color: '#999' },
  resolutionValue: { fontSize: 24, fontWeight: 'bold', color: '#333', marginTop: 4 },
  resolutionDivider: { width: 1, backgroundColor: '#e0e0e0', marginHorizontal: 16 },
  categoriesSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  categoryInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  categoryName: { fontSize: 14, color: '#333', marginLeft: 8, textTransform: 'capitalize' },
  categoryStats: { flexDirection: 'row', alignItems: 'center' },
  categoryCount: { fontSize: 13, color: '#666', marginRight: 8 },
  categoryBar: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  categoryBarFill: { height: '100%', borderRadius: 3 },
  categoryRate: { fontSize: 13, fontWeight: '600', marginLeft: 8, width: 40, textAlign: 'right' },
  recentSection: { marginBottom: 20 },
  recentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  recentIcon: { marginRight: 12 },
  recentInfo: { flex: 1 },
  recentTitle: { fontSize: 14, color: '#333' },
  recentMeta: { fontSize: 12, color: '#999', marginTop: 2, textTransform: 'capitalize' },
  contactSection: { marginBottom: 20 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  contactText: { fontSize: 14, color: '#333', marginLeft: 12 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14, color: '#999', marginTop: 12 },
});
