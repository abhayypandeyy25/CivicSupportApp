import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiService, GovtOfficial } from '../../src/services/api';
import axios from 'axios';
import * as DocumentPicker from 'expo-document-picker';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface OfficialFormData {
  name: string;
  designation: string;
  department: string;
  area: string;
  city: string;
  contact_email: string;
  contact_phone: string;
  hierarchy_level: number;
  categories: string[];
}

const hierarchyOptions = [
  { level: 1, label: 'Parshad (Ward Councillor)' },
  { level: 2, label: 'MCD (Municipal Corporation)' },
  { level: 3, label: 'IAS Officer' },
  { level: 4, label: 'MLA' },
  { level: 5, label: 'MP' },
  { level: 6, label: 'CM' },
  { level: 7, label: 'PM' },
];

const categoryOptions = [
  'roads', 'sanitation', 'water', 'electricity', 'encroachment',
  'parks', 'public_safety', 'health', 'education', 'transport', 'housing', 'general'
];

export default function AdminScreen() {
  const [officials, setOfficials] = useState<GovtOfficial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<OfficialFormData>({
    name: '',
    designation: '',
    department: '',
    area: '',
    city: 'Delhi',
    contact_email: '',
    contact_phone: '',
    hierarchy_level: 1,
    categories: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchOfficials();
  }, []);

  const fetchOfficials = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/officials?limit=100`);
      setOfficials(response.data);
    } catch (error) {
      console.error('Error fetching officials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.designation || !formData.department) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    setSubmitting(true);
    try {
      // Note: This would require admin auth in production
      const response = await axios.post(`${API_BASE_URL}/api/admin/officials`, formData);
      Alert.alert('Success', 'Official added successfully');
      setFormData({
        name: '',
        designation: '',
        department: '',
        area: '',
        city: 'Delhi',
        contact_email: '',
        contact_phone: '',
        hierarchy_level: 1,
        categories: [],
      });
      setShowForm(false);
      fetchOfficials();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add official. Admin authentication required.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat]
    }));
  };

  const handleCSVImport = async () => {
    try {
      // Pick CSV file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      setImporting(true);

      // Read the file content
      const file = result.assets[0];
      const response = await fetch(file.uri);
      const csvContent = await response.text();

      // Send to backend
      const importResponse = await axios.post(
        `${API_BASE_URL}/api/admin/officials/bulk-import-csv`,
        { csv_content: csvContent },
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      const data = importResponse.data;

      // Show results
      let message = `Successfully imported ${data.created_count} officials`;

      // Show auto-created items
      if (data.new_categories && data.new_categories.length > 0) {
        message += `\n\n✨ Auto-created ${data.new_categories.length} new categories:`;
        message += '\n' + data.new_categories.slice(0, 3).join(', ');
        if (data.new_categories.length > 3) {
          message += ` +${data.new_categories.length - 3} more`;
        }
      }

      if (data.new_hierarchy_levels && Object.keys(data.new_hierarchy_levels).length > 0) {
        const levels = Object.entries(data.new_hierarchy_levels);
        message += `\n\n✨ Auto-created ${levels.length} new hierarchy levels:`;
        levels.forEach(([name, level]: [string, any]) => {
          message += `\n  ${name} = Level ${level}`;
        });
      }

      if (data.error_count > 0) {
        message += `\n\n⚠️ Errors: ${data.error_count}`;
        if (data.errors && data.errors.length > 0) {
          message += '\n' + data.errors.slice(0, 3).map((e: any) =>
            `Row ${e.row}: ${e.error}`
          ).join('\n');
          if (data.errors.length > 3) {
            message += `\n...and ${data.errors.length - 3} more errors`;
          }
        }
      }

      Alert.alert(
        data.error_count > 0 ? 'Import Completed with Errors' : 'Success',
        message
      );

      // Refresh the list
      fetchOfficials();

    } catch (error: any) {
      console.error('CSV import error:', error);
      Alert.alert(
        'Import Failed',
        error.response?.data?.detail || 'Failed to import CSV file. Admin authentication required.'
      );
    } finally {
      setImporting(false);
    }
  };

  const downloadCSVTemplate = () => {
    const templateText = `CSV Template Format:

name,email,phone,designation,department,hierarchy_level,area,categories

Example:
Rajesh Kumar,rajesh@mcd.gov.in,+919876543210,Ward Councillor,Municipal Corporation,1,Dwarka,"roads,sanitation"

Hierarchy Levels:
1 = Parshad, 2 = MCD, 3 = IAS, 4 = MLA, 5 = MP, 6 = CM, 7 = PM

Available Categories:
roads, sanitation, water, electricity, encroachment, parks, public_safety, health, education, transport, housing, general`;

    Alert.alert('CSV Template', templateText, [
      { text: 'OK' }
    ]);
  };

  const renderOfficialItem = ({ item }: { item: GovtOfficial }) => (
    <View style={styles.officialCard}>
      <View style={styles.officialHeader}>
        <View style={styles.officialAvatar}>
          <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.officialInfo}>
          <Text style={styles.officialName}>{item.name}</Text>
          <Text style={styles.officialDesignation}>{item.designation}</Text>
        </View>
        <View style={[styles.levelBadge, { backgroundColor: `hsl(${item.hierarchy_level * 40}, 70%, 90%)` }]}>
          <Text style={styles.levelText}>L{item.hierarchy_level}</Text>
        </View>
      </View>
      <Text style={styles.officialDept}>{item.department}</Text>
      {item.area && <Text style={styles.officialArea}>Area: {item.area}</Text>}
      <View style={styles.categoriesRow}>
        {item.categories.slice(0, 3).map(cat => (
          <View key={cat} style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{cat}</Text>
          </View>
        ))}
        {item.categories.length > 3 && (
          <Text style={styles.moreCategories}>+{item.categories.length - 3}</Text>
        )}
      </View>
    </View>
  );

  const renderForm = () => (
    <View style={styles.formContainer}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>Add New Official</Text>
        <TouchableOpacity onPress={() => setShowForm(false)}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.formScroll}>
        <Text style={styles.inputLabel}>Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
        />

        <Text style={styles.inputLabel}>Hierarchy Level *</Text>
        <View style={styles.hierarchyGrid}>
          {hierarchyOptions.map(opt => (
            <TouchableOpacity
              key={opt.level}
              style={[
                styles.hierarchyOption,
                formData.hierarchy_level === opt.level && styles.hierarchyOptionSelected
              ]}
              onPress={() => {
                setFormData({ ...formData, hierarchy_level: opt.level, designation: opt.label.split(' ')[0] });
              }}
            >
              <Text style={[
                styles.hierarchyOptionText,
                formData.hierarchy_level === opt.level && styles.hierarchyOptionTextSelected
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>Designation *</Text>
        <TextInput
          style={styles.input}
          placeholder="Designation"
          value={formData.designation}
          onChangeText={(text) => setFormData({ ...formData, designation: text })}
        />

        <Text style={styles.inputLabel}>Department *</Text>
        <TextInput
          style={styles.input}
          placeholder="Department/Organization"
          value={formData.department}
          onChangeText={(text) => setFormData({ ...formData, department: text })}
        />

        <Text style={styles.inputLabel}>Area/Constituency</Text>
        <TextInput
          style={styles.input}
          placeholder="Ward/Area/Constituency"
          value={formData.area}
          onChangeText={(text) => setFormData({ ...formData, area: text })}
        />

        <Text style={styles.inputLabel}>City</Text>
        <TextInput
          style={styles.input}
          placeholder="City"
          value={formData.city}
          onChangeText={(text) => setFormData({ ...formData, city: text })}
        />

        <Text style={styles.inputLabel}>Contact Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={formData.contact_email}
          onChangeText={(text) => setFormData({ ...formData, contact_email: text })}
          keyboardType="email-address"
        />

        <Text style={styles.inputLabel}>Contact Phone</Text>
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          value={formData.contact_phone}
          onChangeText={(text) => setFormData({ ...formData, contact_phone: text })}
          keyboardType="phone-pad"
        />

        <Text style={styles.inputLabel}>Categories (handles)</Text>
        <View style={styles.categoriesGrid}>
          {categoryOptions.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryOption,
                formData.categories.includes(cat) && styles.categoryOptionSelected
              ]}
              onPress={() => toggleCategory(cat)}
            >
              <Text style={[
                styles.categoryOptionText,
                formData.categories.includes(cat) && styles.categoryOptionTextSelected
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Add Official</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <Text style={styles.headerSubtitle}>Manage Government Officials</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{officials.length}</Text>
          <Text style={styles.statLabel}>Total Officials</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{officials.filter(o => o.hierarchy_level <= 2).length}</Text>
          <Text style={styles.statLabel}>Local Level</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{officials.filter(o => o.hierarchy_level >= 4).length}</Text>
          <Text style={styles.statLabel}>State/National</Text>
        </View>
      </View>

      {/* Action Buttons */}
      {!showForm && (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add New Official</Text>
          </TouchableOpacity>

          <View style={styles.csvButtonsRow}>
            <TouchableOpacity
              style={[styles.csvButton, importing && styles.csvButtonDisabled]}
              onPress={handleCSVImport}
              disabled={importing}
            >
              {importing ? (
                <ActivityIndicator color="#FF5722" size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color="#FF5722" />
                  <Text style={styles.csvButtonText}>Import CSV</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.csvButton}
              onPress={downloadCSVTemplate}
            >
              <Ionicons name="document-text-outline" size={18} color="#FF5722" />
              <Text style={styles.csvButtonText}>Template</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Form or List */}
      {showForm ? (
        renderForm()
      ) : (
        <FlatList
          data={officials}
          keyExtractor={(item) => item.id}
          renderItem={renderOfficialItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No officials added yet</Text>
            </View>
          }
        />
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF5722',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  actionButtonsContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF5722',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  csvButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  csvButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF5722',
  },
  csvButtonDisabled: {
    opacity: 0.5,
  },
  csvButtonText: {
    color: '#FF5722',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  officialCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  officialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  officialInfo: {
    flex: 1,
  },
  officialName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  officialDesignation: {
    fontSize: 12,
    color: '#999',
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  officialDept: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  officialArea: {
    fontSize: 12,
    color: '#999',
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  categoryBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: '#FF5722',
  },
  moreCategories: {
    fontSize: 10,
    color: '#999',
    alignSelf: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  formScroll: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  hierarchyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  hierarchyOption: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  hierarchyOptionSelected: {
    backgroundColor: '#FF5722',
  },
  hierarchyOptionText: {
    fontSize: 12,
    color: '#666',
  },
  hierarchyOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryOption: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryOptionSelected: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  categoryOptionText: {
    fontSize: 12,
    color: '#666',
  },
  categoryOptionTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#FF5722',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    backgroundColor: '#FFB299',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
