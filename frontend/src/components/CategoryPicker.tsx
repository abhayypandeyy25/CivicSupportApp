import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface CategoryPickerProps {
  categories: Category[];
  selectedCategory: string;
  onSelect: (categoryId: string) => void;
}

const iconMap: { [key: string]: string } = {
  road: 'car-outline',
  trash: 'trash-outline',
  water: 'water-outline',
  bolt: 'flash-outline',
  building: 'business-outline',
  tree: 'leaf-outline',
  shield: 'shield-outline',
  medkit: 'medkit-outline',
  school: 'school-outline',
  bus: 'bus-outline',
  home: 'home-outline',
  'info-circle': 'information-circle-outline',
};

export default function CategoryPicker({ categories, selectedCategory, onSelect }: CategoryPickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {categories.map((category) => (
        <TouchableOpacity
          key={category.id}
          style={[
            styles.categoryItem,
            selectedCategory === category.id && styles.categoryItemSelected,
          ]}
          onPress={() => onSelect(category.id)}
        >
          <View style={[
            styles.iconContainer,
            selectedCategory === category.id && styles.iconContainerSelected,
          ]}>
            <Ionicons
              name={iconMap[category.icon] as any || 'information-circle-outline'}
              size={24}
              color={selectedCategory === category.id ? '#fff' : '#FF5722'}
            />
          </View>
          <Text style={[
            styles.categoryText,
            selectedCategory === category.id && styles.categoryTextSelected,
          ]}>
            {category.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 80,
  },
  categoryItemSelected: {},
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainerSelected: {
    backgroundColor: '#FF5722',
  },
  categoryText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  categoryTextSelected: {
    color: '#FF5722',
    fontWeight: '600',
  },
});
