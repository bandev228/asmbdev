import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, TextInput, FlatList, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useEvents, Event } from './hooks/useEvents';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const SuKien = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const router = useRouter();
  const { events, loading, error, refetch } = useEvents();

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.notes.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || event.activityType === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(events.map(event => event.activityType || 'Khác')));

  const renderEventCard = ({ item }: { item: Event }) => {
    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => router.push({
          pathname: './ChiTietHD',
          params: { id: item.id }
        })}
      >
        {item.bannerImageUrl ? (
          <Image 
            source={{ uri: item.bannerImageUrl }} 
            style={styles.eventImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.eventImage, styles.placeholderImage]}>
            <Ionicons name="image-outline" size={40} color="#ccc" />
          </View>
        )}
        
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventTitle} numberOfLines={2}>{item.name}</Text>
            <View style={styles.pointsContainer}>
              <Ionicons name="trophy" size={16} color="#FFD700" />
              <Text style={styles.pointsText}>{item.points} điểm</Text>
            </View>
          </View>
          
          <Text style={styles.eventDescription} numberOfLines={2}>
            {item.notes}
          </Text>

          <View style={styles.eventInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text style={styles.infoText}>
                {format(item.startDate.toDate(), "dd/MM/yyyy", { locale: vi })} - {format(item.endDate.toDate(), "dd/MM/yyyy", { locale: vi })}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.infoText}>
                {format(item.startDate.toDate(), "HH:mm", { locale: vi })} - {format(item.endDate.toDate(), "HH:mm", { locale: vi })}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color="#666" />
              <Text style={styles.infoText}>{item.location}</Text>
            </View>
          </View>

          <View style={styles.eventFooter}>
            <View style={[
              styles.categoryBadge,
              { backgroundColor: getCategoryColor(item.activityType) }
            ]}>
              <Text style={styles.categoryText}>{item.activityType}</Text>
            </View>
            <View style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) }
            ]}>
              <Text style={styles.statusText}>
                {getStatusText(item.status)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCategoryButton = (category: string | null) => {
    const isSelected = category === selectedCategory;
    return (
      <TouchableOpacity
        key={category || 'all'}
        style={[styles.categoryButton, isSelected && styles.selectedCategoryButton]}
        onPress={() => setSelectedCategory(category)}
      >
        <Text style={[styles.categoryButtonText, isSelected && styles.selectedCategoryText]}>
          {category || 'Tất cả'}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refetch}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Sự kiện sắp tới</Text>
        <TouchableOpacity onPress={refetch} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm sự kiện..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryContainer}
        contentContainerStyle={styles.categoryContent}
      >
        {[null, ...categories].map(renderCategoryButton)}
      </ScrollView>

      <FlatList
        data={filteredEvents}
        renderItem={renderEventCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color="#999" />
            <Text style={styles.emptyText}>Không có sự kiện nào sắp diễn ra</Text>
    </View>
        }
      />
    </SafeAreaView>
  );
};

const getCategoryColor = (category: string): string => {
  const colors: { [key: string]: string } = {
    'Học tập': '#4CAF50',
    'Thể thao': '#2196F3',
    'Văn nghệ': '#9C27B0',
    'Tình nguyện': '#FF9800',
    'Khác': '#607D8B'
  };
  return colors[category] || '#607D8B';
};

const getStatusColor = (status: string): string => {
  const colors: { [key: string]: string } = {
    'pending': '#FFC107',
    'approved': '#4CAF50',
    'rejected': '#F44336'
  };
  return colors[status] || '#607D8B';
};

const getStatusText = (status: string): string => {
  const texts: { [key: string]: string } = {
    'pending': 'Đang chờ',
    'approved': 'Đã duyệt',
    'rejected': 'Đã từ chối'
  };
  return texts[status] || 'Không xác định';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: screenWidth * 0.04,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: screenWidth * 0.02,
  },
  refreshButton: {
    padding: screenWidth * 0.02,
  },
  title: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: screenWidth * 0.04,
    paddingHorizontal: screenWidth * 0.04,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchIcon: {
    marginRight: screenWidth * 0.02,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: screenWidth * 0.035,
    color: '#333333',
  },
  categoryContainer: {
    marginHorizontal: screenWidth * 0.04,
    marginBottom: screenHeight * 0.02,
  },
  categoryContent: {
    paddingRight: screenWidth * 0.04,
  },
  categoryButton: {
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenWidth * 0.02,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: screenWidth * 0.02,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedCategoryButton: {
    backgroundColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
  },
  selectedCategoryText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  listContainer: {
    padding: screenWidth * 0.04,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: screenHeight * 0.02,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  eventImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  placeholderImage: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventContent: {
    padding: screenWidth * 0.04,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: screenHeight * 0.01,
  },
  eventTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    marginRight: screenWidth * 0.02,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: screenWidth * 0.02,
    paddingVertical: screenWidth * 0.01,
    borderRadius: 12,
  },
  pointsText: {
    fontSize: screenWidth * 0.035,
    color: '#FF9800',
    fontWeight: '500',
    marginLeft: screenWidth * 0.01,
  },
  eventDescription: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
    marginBottom: screenHeight * 0.02,
  },
  eventInfo: {
    marginBottom: screenHeight * 0.02,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: screenHeight * 0.01,
  },
  infoText: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
    marginLeft: screenWidth * 0.02,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    paddingHorizontal: screenWidth * 0.03,
    paddingVertical: screenWidth * 0.015,
    borderRadius: 20,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: screenWidth * 0.03,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: screenWidth * 0.03,
    paddingVertical: screenWidth * 0.015,
    borderRadius: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: screenWidth * 0.03,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: screenWidth * 0.1,
  },
  emptyText: {
    fontSize: screenWidth * 0.04,
    color: '#999999',
    marginTop: screenHeight * 0.02,
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: screenHeight * 0.02,
  },
  retryButton: {
    marginTop: screenHeight * 0.02,
    backgroundColor: '#007AFF',
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.01,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: screenWidth * 0.035,
    fontWeight: '500',
  },
});

export default SuKien;