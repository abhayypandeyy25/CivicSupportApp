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
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { apiService, Category, Location as LocationType, AIClassificationResponse } from '../../src/services/api';
import { useRouter } from 'expo-router';

export default function UploadScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [location, setLocation] = useState<LocationType | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AIClassificationResponse | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchCategories();
    getLocation();
  }, []);

  // Auto-generate description when title or photos change
  useEffect(() => {
    if (title.length > 5 && photos.length > 0 && !description) {
      generateDescription();
    }
  }, [title, photos]);

  const fetchCategories = async () => {
    try {
      const response = await apiService.getCategories();
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const getLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const [address] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });

        const locationData: LocationType = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          address: address ? `${address.street || ''}, ${address.district || ''}, ${address.city || ''}`.replace(/^, |, $/g, '') : undefined,
          area: address?.district || address?.subregion || address?.name || undefined,
          city: address?.city || 'Delhi',
        };

        setLocation(locationData);
        console.log('Location obtained:', locationData);
      } else {
        Alert.alert(
          'Location Required',
          'Location permission is needed to report issues. Please enable it in settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Try Again', onPress: getLocation }
          ]
        );
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Could not get your location. Please try again.');
    } finally {
      setLoadingLocation(false);
    }
  };

  const generateDescription = async () => {
    if (!title || photos.length === 0) return;
    
    setGeneratingDescription(true);
    try {
      // Use AI to classify and generate description
      const response = await apiService.classifyIssue({
        title,
        description: `Photo uploaded for: ${title}`,
        location: location || undefined,
      });
      
      setAiSuggestion(response.data);
      
      // Set category if not already set
      if (!category && response.data.category) {
        setCategory(response.data.category);
      }
      
      // Generate a description based on title and category
      const categoryName = response.data.category?.replace('_', ' ') || 'civic';
      const locationText = location?.area ? ` in ${location.area}` : '';
      const generatedDesc = `Reporting a ${categoryName} issue${locationText}: ${title}. This issue requires immediate attention from the concerned authorities. The photo evidence has been attached for verification.`;
      
      if (!description) {
        setDescription(generatedDesc);
      }
    } catch (error) {
      console.error('Error generating description:', error);
    } finally {
      setGeneratingDescription(false);
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
        const newPhoto = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setPhotos([...photos, newPhoto]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
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
      getLocation();
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
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit issue. Please login first.');
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

          {/* Location Status */}
          <View style={styles.locationStatus}>
            {loadingLocation ? (
              <View style={styles.locationLoading}>
                <ActivityIndicator size="small" color="#FF5722" />
                <Text style={styles.locationLoadingText}>Getting your location...</Text>
              </View>
            ) : location ? (
              <View style={styles.locationSuccess}>
                <Ionicons name="location" size={18} color="#4CAF50" />
                <Text style={styles.locationSuccessText} numberOfLines={1}>
                  {location.address || `${location.area}, ${location.city}`}
                </Text>
                <TouchableOpacity onPress={getLocation}>
                  <Ionicons name="refresh" size={18} color="#666" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.locationError} onPress={getLocation}>
                <Ionicons name="location-outline" size={18} color="#F44336" />
                <Text style={styles.locationErrorText}>Enable location to continue</Text>
              </TouchableOpacity>
            )}
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
              placeholder="Brief title of the issue (e.g., Pothole on main road)"
              placeholderTextColor="#999"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Description <Text style={styles.required}>*</Text>
              </Text>
              {generatingDescription && (
                <View style={styles.generatingBadge}>
                  <ActivityIndicator size="small" color="#FF5722" />
                  <Text style={styles.generatingText}>AI generating...</Text>
                </View>
              )}
            </View>
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
            {!description && title && photos.length > 0 && !generatingDescription && (
              <TouchableOpacity style={styles.generateButton} onPress={generateDescription}>
                <Ionicons name="sparkles" size={16} color="#FF5722" />
                <Text style={styles.generateButtonText}>Generate description with AI</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* AI Suggestion */}
          {aiSuggestion && (
            <View style={styles.aiSuggestionBox}>
              <View style={styles.aiSuggestionHeader}>
                <Ionicons name="sparkles" size={18} color="#4CAF50" />
                <Text style={styles.aiSuggestionTitle}>AI Analysis</Text>
                <Text style={styles.confidenceBadge}>
                  {Math.round(aiSuggestion.confidence * 100)}% confident
                </Text>
              </View>
              <Text style={styles.aiSuggestionText}>
                Suggested Category: <Text style={styles.bold}>{aiSuggestion.category?.replace('_', ' ')}</Text>
              </Text>
              {aiSuggestion.suggested_officials?.length > 0 && (
                <Text style={styles.aiSuggestionText}>
                  Will be assigned to: {aiSuggestion.suggested_officials.map(o => o.designation).join(', ')}
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

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, (loading || !location) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading || !location}
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
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  keyboardView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  headerSubtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  locationStatus: { marginBottom: 16 },
  locationLoading: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', padding: 12, borderRadius: 12 },
  locationLoadingText: { marginLeft: 10, color: '#FF5722', fontSize: 14 },
  locationSuccess: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', padding: 12, borderRadius: 12 },
  locationSuccessText: { flex: 1, marginLeft: 8, color: '#333', fontSize: 14 },
  locationError: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE', padding: 12, borderRadius: 12 },
  locationErrorText: { marginLeft: 8, color: '#F44336', fontSize: 14 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 10 },
  required: { color: '#FF5722' },
  hint: { fontSize: 12, color: '#999', fontWeight: 'normal' },
  generatingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  generatingText: { fontSize: 12, color: '#FF5722', marginLeft: 6 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  photoContainer: { width: 100, height: 100, marginRight: 10, marginBottom: 10, borderRadius: 12, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  removePhotoButton: { position: 'absolute', top: 4, right: 4, backgroundColor: '#fff', borderRadius: 12 },
  addPhotoContainer: { flexDirection: 'row' },
  addPhotoButton: { width: 80, height: 100, backgroundColor: '#FFF3E0', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 2, borderColor: '#FF5722', borderStyle: 'dashed' },
  addPhotoText: { fontSize: 11, color: '#FF5722', marginTop: 4 },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#333', borderWidth: 1, borderColor: '#e0e0e0' },
  textArea: { height: 120, textAlignVertical: 'top' },
  generateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, padding: 10, backgroundColor: '#FFF3E0', borderRadius: 8 },
  generateButtonText: { color: '#FF5722', fontSize: 13, marginLeft: 6 },
  aiSuggestionBox: { backgroundColor: '#E8F5E9', padding: 16, borderRadius: 12, marginBottom: 20 },
  aiSuggestionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  aiSuggestionTitle: { fontSize: 14, fontWeight: '600', color: '#4CAF50', marginLeft: 6, flex: 1 },
  confidenceBadge: { fontSize: 11, color: '#4CAF50', backgroundColor: '#C8E6C9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  aiSuggestionText: { fontSize: 13, color: '#333', marginTop: 4 },
  bold: { fontWeight: '600' },
  categoryRow: { flexDirection: 'row', paddingVertical: 4 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  categoryChipSelected: { backgroundColor: '#FF5722', borderColor: '#FF5722' },
  categoryChipText: { fontSize: 13, color: '#666' },
  categoryChipTextSelected: { color: '#fff', fontWeight: '600' },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF5722', paddingVertical: 16, borderRadius: 12, marginTop: 10 },
  submitButtonDisabled: { backgroundColor: '#FFB299' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
});
