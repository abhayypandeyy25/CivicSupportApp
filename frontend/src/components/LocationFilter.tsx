import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

interface LocationFilterProps {
  radius: number;
  onRadiusChange: (radius: number) => void;
  locationEnabled: boolean;
  address?: string;
}

export default function LocationFilter({
  radius,
  onRadiusChange,
  locationEnabled,
  address,
}: LocationFilterProps) {
  const [showModal, setShowModal] = useState(false);
  const [tempRadius, setTempRadius] = useState(radius);

  const handleApply = () => {
    onRadiusChange(tempRadius);
    setShowModal(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setShowModal(true)}
      >
        <Ionicons
          name="location-outline"
          size={18}
          color={locationEnabled ? '#FF5722' : '#999'}
        />
        <Text style={[styles.filterText, locationEnabled && styles.filterTextActive]}>
          {locationEnabled ? `${radius} km` : 'Location'}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#666" />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Location</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {locationEnabled ? (
              <>
                <View style={styles.addressContainer}>
                  <Ionicons name="location" size={20} color="#FF5722" />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {address || 'Current Location'}
                  </Text>
                </View>

                <View style={styles.sliderContainer}>
                  <Text style={styles.sliderLabel}>Radius: {tempRadius} km</Text>
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

                <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
                  <Text style={styles.applyButtonText}>Apply Filter</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.disabledContainer}>
                <Ionicons name="location-outline" size={48} color="#ccc" />
                <Text style={styles.disabledText}>
                  Enable location to filter issues by distance
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterText: {
    fontSize: 13,
    color: '#666',
    marginHorizontal: 6,
  },
  filterTextActive: {
    color: '#FF5722',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  addressText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  sliderContainer: {
    marginBottom: 24,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderMinMax: {
    fontSize: 12,
    color: '#999',
  },
  applyButton: {
    backgroundColor: '#FF5722',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  disabledText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
  },
});
