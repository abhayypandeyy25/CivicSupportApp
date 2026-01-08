import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { apiService, Category, Location as LocationType, AIClassificationResponse } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'expo-router';

export default function UploadScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [location, setLocation] = useState<LocationType | null>(null);
  const [loading, setLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AIClassificationResponse | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchCategories();
    getLocation();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await apiService.getCategories();
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        const [address] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });

        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          address: address ? `${address.street || ''}, ${address.city || ''}, ${address.region || ''}` : undefined,
          area: address?.district || address?.subregion || undefined,
          city: address?.city || 'Delhi',
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const pickImage = async (useCamera: boolean) => {
    if (photos.length >= 5) {
      Alert.alert('Limit Reached', 'Maximum 5 photos allowed per issue');
      return;
    }

    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera permission is needed to take photos');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
          base64: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Gallery permission is needed to select photos');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0].base64) {
        setPhotos([...photos, `data:image/jpeg;base64,${result.assets[0].base64}`]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const classifyWithAI = async () => {
    if (!title || !description) {
      Alert.alert('Missing Info', 'Please enter title and description to get AI suggestion');
      return;
    }

    setClassifying(true);
    try {
      const response = await apiService.classifyIssue({
        title,
        description,
        location: location || undefined,
      });
      setAiSuggestion(response.data);
      if (response.data.category && !category) {
        setCategory(response.data.category);
      }
    } catch (error) {
      console.error('Error classifying:', error);
    } finally {
      setClassifying(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for the issue');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please describe the issue');
      return;
    }
    if (photos.length === 0) {
      Alert.alert('Missing Photo', 'Please add at least one photo of the issue');
      return;
    }
    if (!category) {
      Alert.alert('Missing Category', 'Please select a category for the issue');
      return;
    }
    if (!location) {
      Alert.alert('Missing Location', 'Please enable location to report the issue');
      return;
    }

    setLoading(true);
    try {
      await apiService.createIssue({
        title: title.trim(),
        description: description.trim(),
        category,
        photos,
        location,
      });

      Alert.alert('Success', 'Your issue has been reported successfully!', [
        {
          text: 'OK',
          onPress: () => {
            // Reset form
            setTitle('');
            setDescription('');
            setPhotos([]);
            setCategory('');
            setAiSuggestion(null);
            router.replace('/(tabs)');
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error submitting issue:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit issue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Report an Issue</Text>
            <Text style={styles.headerSubtitle}>
              Help improve your community by reporting civic issues
            </Text>
          </View>

          {/* Photo Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Photos <Text style={styles.required}>*</Text>
              <Text style={styles.hint}> ({photos.length}/5)</Text>
            </Text>
            <View style={styles.photoGrid}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri: photo }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#FF5722" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 5 && (
                <View style={styles.addPhotoContainer}>
                  <TouchableOpacity
                    style={styles.addPhotoButton}
                    onPress={() => pickImage(true)}
                  >
                    <Ionicons name="camera" size={28} color="#FF5722" />
                    <Text style={styles.addPhotoText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addPhotoButton}
                    onPress={() => pickImage(false)}
                  >
                    <Ionicons name="images" size={28} color="#FF5722" />
                    <Text style={styles.addPhotoText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Title <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Brief title of the issue"
              placeholderTextColor="#999"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Description <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the issue in detail..."
              placeholderTextColor="#999"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
          </View>

          {/* AI Suggestion */}
          <TouchableOpacity
            style={styles.aiButton}
            onPress={classifyWithAI}
            disabled={classifying}
          >
            {classifying ? (
              <ActivityIndicator size="small" color="#FF5722" />
            ) : (
              <Ionicons name="sparkles" size={20} color="#FF5722" />
            )}
            <Text style={styles.aiButtonText}>
              {classifying ? 'Analyzing...' : 'Get AI Suggestion'}
            </Text>
          </TouchableOpacity>

          {aiSuggestion && (
            <View style={styles.aiSuggestionBox}>
              <View style={styles.aiSuggestionHeader}>
                <Ionicons name="sparkles" size={18} color="#4CAF50" />
                <Text style={styles.aiSuggestionTitle}>AI Suggestion</Text>
                <Text style={styles.confidenceBadge}>
                  {Math.round(aiSuggestion.confidence * 100)}% confident
                </Text>
              </View>
              <Text style={styles.aiSuggestionText}>
                Category: <Text style={styles.bold}>{aiSuggestion.category}</Text>
              </Text>
              {aiSuggestion.suggested_officials.length > 0 && (
                <Text style={styles.aiSuggestionText}>
                  Suggested: {aiSuggestion.suggested_officials.map(o => o.name).join(', ')}
                </Text>
              )}
            </View>
          )}

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Category <Text style={styles.required}>*</Text>
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.categoryRow}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      category === cat.id && styles.categoryChipSelected,
                    ]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === cat.id && styles.categoryChipTextSelected,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            {location ? (
              <View style={styles.locationBox}>
                <Ionicons name="location" size={20} color="#FF5722" />
                <Text style={styles.locationText} numberOfLines={2}>
                  {location.address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                </Text>
                <TouchableOpacity onPress={getLocation}>
                  <Ionicons name="refresh" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.enableLocationButton} onPress={getLocation}>
                <Ionicons name="location-outline" size={20} color="#FF5722" />
                <Text style={styles.enableLocationText}>Enable Location</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Submit Issue</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  required: {
    color: '#FF5722',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    fontWeight: 'normal',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  photoContainer: {
    width: 100,
    height: 100,
    marginRight: 10,
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  addPhotoContainer: {
    flexDirection: 'row',
  },
  addPhotoButton: {
    width: 80,
    height: 100,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#FF5722',
    borderStyle: 'dashed',
  },
  addPhotoText: {
    fontSize: 11,
    color: '#FF5722',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  aiButtonText: {
    color: '#FF5722',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  aiSuggestionBox: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  aiSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiSuggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 6,
    flex: 1,
  },
  confidenceBadge: {
    fontSize: 11,
    color: '#4CAF50',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  aiSuggestionText: {
    fontSize: 13,
    color: '#333',
    marginTop: 4,
  },
  bold: {
    fontWeight: '600',
  },
  categoryRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryChipSelected: {
    backgroundColor: '#FF5722',
    borderColor: '#FF5722',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#666',
  },
  categoryChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
  },
  enableLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    padding: 14,
    borderRadius: 12,
  },
  enableLocationText: {
    color: '#FF5722',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF5722',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#FFB299',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
