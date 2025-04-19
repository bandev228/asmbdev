import React, { useState, useEffect, useRef } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, FlatList, Animated, Dimensions, TextInput, Modal } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { getFirestore, collection, query, where, orderBy, getDocs, doc, getDoc } from "@react-native-firebase/firestore"
import { useRouter } from "expo-router"
import { LinearGradient } from 'expo-linear-gradient'
import { formatDate, format } from "date-fns"
import { vi } from "date-fns/locale"
import DateTimePicker from '@react-native-community/datetimepicker'

interface CompletedActivity {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  location: string;
  creatorName: string;
  participantsCount: number;
  bannerImageUrl?: string;
}

const { width } = Dimensions.get('window')

const KetThucHD = () => {
  const router = useRouter()
  const [activities, setActivities] = useState<CompletedActivity[]>([])
  const [filteredActivities, setFilteredActivities] = useState<CompletedActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedActivity, setSelectedActivity] = useState<CompletedActivity | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [filterType, setFilterType] = useState<'day' | 'month' | 'year'>('day')

  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    loadCompletedActivities()
  }, [])

  useEffect(() => {
    filterActivities()
  }, [searchQuery, selectedDate, filterType, activities])

  useEffect(() => {
    if (showDetails) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start()
    } else {
      fadeAnim.setValue(0)
    }
  }, [showDetails])

  const filterActivities = () => {
    let filtered = [...activities]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(activity => 
        activity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.location.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter(activity => {
        const activityDate = new Date(activity.endDate)
        switch (filterType) {
          case 'day':
            return activityDate.toDateString() === selectedDate.toDateString()
          case 'month':
            return activityDate.getMonth() === selectedDate.getMonth() &&
                   activityDate.getFullYear() === selectedDate.getFullYear()
          case 'year':
            return activityDate.getFullYear() === selectedDate.getFullYear()
          default:
            return true
        }
      })
    }

    setFilteredActivities(filtered)
  }

  const loadCompletedActivities = async () => {
    try {
      setLoading(true)
      const db = getFirestore()
      const now = new Date()
      
      const activitiesRef = collection(db, 'activities')
      const activitiesQuery = query(
        activitiesRef,
        where('status', '==', 'approved'),
        where('endDate', '<', now),
        orderBy('endDate', 'desc')
      )

      const snapshot = await getDocs(activitiesQuery)
      const activitiesData = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data()
          const creatorDoc = await getDoc(doc(db, 'users', data.createdBy))
          const creatorData = creatorDoc.data()

          return {
            id: docSnapshot.id,
            name: data.name,
            startDate: data.startDate.toDate(),
            endDate: data.endDate.toDate(),
            location: data.location,
            creatorName: creatorData?.displayName || 'Không xác định',
            participantsCount: data.participants?.length || 0,
            bannerImageUrl: data.bannerImageUrl
          }
        })
      )

      setActivities(activitiesData)
      setFilteredActivities(activitiesData)
    } catch (error) {
      console.error('Error loading completed activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#007AFF" />
      </TouchableOpacity>
      <Text style={styles.title}>Hoạt động đã diễn ra</Text>
      <TouchableOpacity 
        style={styles.filterButton} 
        onPress={() => setShowFilterModal(true)}
      >
        <Ionicons name="options-outline" size={24} color="#007AFF" />
      </TouchableOpacity>
    </View>
  )

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Tìm kiếm hoạt động..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#666"
      />
      {searchQuery ? (
        <TouchableOpacity onPress={() => setSearchQuery('')}>
          <Ionicons name="close-circle" size={20} color="#666" />
        </TouchableOpacity>
      ) : null}
    </View>
  )

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Lọc hoạt động</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.filterOptions}>
            <TouchableOpacity
              style={[styles.filterOption, filterType === 'day' && styles.selectedFilter]}
              onPress={() => setFilterType('day')}
            >
              <Text style={[styles.filterOptionText, filterType === 'day' && styles.selectedFilterText]}>
                Theo ngày
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterOption, filterType === 'month' && styles.selectedFilter]}
              onPress={() => setFilterType('month')}
            >
              <Text style={[styles.filterOptionText, filterType === 'month' && styles.selectedFilterText]}>
                Theo tháng
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterOption, filterType === 'year' && styles.selectedFilter]}
              onPress={() => setFilterType('year')}
            >
              <Text style={[styles.filterOptionText, filterType === 'year' && styles.selectedFilterText]}>
                Theo năm
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar" size={20} color="#007AFF" />
            <Text style={styles.datePickerText}>
              {selectedDate
                ? format(selectedDate, 'dd/MM/yyyy', { locale: vi })
                : 'Chọn ngày'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.applyFilterButton}
            onPress={() => setShowFilterModal(false)}
          >
            <Text style={styles.applyFilterText}>Áp dụng</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )

  const renderActivityItem = ({ item }: { item: CompletedActivity }) => (
    <TouchableOpacity
      style={styles.activityItem}
      onPress={() => {
        setSelectedActivity(item)
        setShowDetails(true)
      }}
      activeOpacity={0.8}
    >
      <View style={styles.activityItemContent}>
        {item.bannerImageUrl ? (
          <Image 
            source={{ uri: item.bannerImageUrl }} 
            style={styles.activityImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.activityImage, styles.placeholderImage]}>
            <Ionicons name="image-outline" size={40} color="#ccc" />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.85)']}
          style={styles.gradientOverlay}
        />
        <View style={styles.activityInfo}>
          <Text style={styles.activityTitle} numberOfLines={2}>{item.name}</Text>
          <View style={styles.activityMeta}>
            <View style={styles.metaItem}>
              <Ionicons 
                name="calendar-outline" 
                size={16} 
                color="#fff" 
                style={styles.metaIcon}
              />
              <View style={styles.dateTimeContainer}>
                <Text style={styles.metaText} numberOfLines={1}>
                  {formatDate(item.startDate, 'dd/MM/yyyy', { locale: vi })}
                </Text>
                <Text style={styles.timeText} numberOfLines={1}>
                  {formatDate(item.startDate, 'HH:mm', { locale: vi })}
                </Text>
              </View>
            </View>
            <View style={styles.metaItem}>
              <Ionicons 
                name="location-outline" 
                size={16} 
                color="#fff" 
                style={styles.metaIcon}
              />
              <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
            </View>
            <View style={styles.participantInfo}>
              <Ionicons 
                name="people-outline" 
                size={16} 
                color="#fff" 
                style={styles.metaIcon}
              />
              <Text style={styles.participantCount}>{item.participantsCount} sinh viên</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )

  const renderActivityDetails = () => {
    if (!selectedActivity) return null

    return (
      <Animated.View style={[styles.detailsContainer, { opacity: fadeAnim }]}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => setShowDetails(false)}
        >
          <Ionicons name="close-circle" size={32} color="#fff" />
        </TouchableOpacity>

        {selectedActivity.bannerImageUrl ? (
          <Image 
            source={{ uri: selectedActivity.bannerImageUrl }} 
            style={styles.detailsImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.detailsImage, styles.placeholderImage]}>
            <Ionicons name="image-outline" size={60} color="#ccc" />
          </View>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.detailsGradient}
        />

        <ScrollView style={styles.detailsContent}>
          <Text style={styles.detailsTitle}>{selectedActivity.name}</Text>
          
          <View style={styles.detailsSection}>
            <View style={styles.detailsRow}>
              <Ionicons name="calendar-outline" size={24} color="#007AFF" />
              <View style={styles.detailsTextContainer}>
                <Text style={styles.detailsLabel}>Thời gian</Text>
                <Text style={styles.detailsText}>
                  {formatDate(selectedActivity.startDate, 'dd/MM/yyyy HH:mm', { locale: vi })} - 
                  {formatDate(selectedActivity.endDate, 'dd/MM/yyyy HH:mm', { locale: vi })}
                </Text>
              </View>
            </View>

            <View style={styles.detailsRow}>
              <Ionicons name="location-outline" size={24} color="#007AFF" />
              <View style={styles.detailsTextContainer}>
                <Text style={styles.detailsLabel}>Địa điểm</Text>
                <Text style={styles.detailsText}>{selectedActivity.location}</Text>
              </View>
            </View>

            <View style={styles.detailsRow}>
              <Ionicons name="person-outline" size={24} color="#007AFF" />
              <View style={styles.detailsTextContainer}>
                <Text style={styles.detailsLabel}>Người tổ chức</Text>
                <Text style={styles.detailsText}>{selectedActivity.creatorName}</Text>
              </View>
            </View>
          </View>

          <View style={styles.participantSection}>
            <Text style={styles.participantTitle}>Thống kê tham gia</Text>
            <View style={styles.participantStats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{selectedActivity.participantsCount}</Text>
                <Text style={styles.statLabel}>Sinh viên tham gia</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderSearchBar()}
      
      <FlatList
        data={filteredActivities}
        renderItem={renderActivityItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        numColumns={2}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>Không tìm thấy hoạt động</Text>
            <Text style={styles.emptyText}>Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</Text>
          </View>
        )}
      />

      {renderFilterModal()}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(false)
            if (date) setSelectedDate(date)
          }}
        />
      )}
      {showDetails && renderActivityDetails()}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E9F0',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A2138',
    flex: 1,
    textAlign: 'center',
  },
  filterButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#1A2138',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 8,
    paddingBottom: 20,
  },
  activityItem: {
    width: (width - 32) / 2,
    height: 175,
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activityItemContent: {
    flex: 1,
    position: 'relative',
  },
  activityImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '85%',
    backgroundColor: 'rgba(255, 255, 255, 0)',
  },
  activityInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    textAlign: 'center',
  },
  activityMeta: {
    flexDirection: 'column',
    gap: 6,
    backgroundColor: 'rgba(62, 121, 230, 0.4)',
    padding: 8,
    borderRadius: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dateTimeContainer: {
    marginLeft: 4,
    flex: 1,
  },
  metaText: {
    fontSize: 11,
    color: '#fff',
    flex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  timeText: {
    fontSize: 10,
    color: '#fff',
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  participantCount: {
    fontSize: 11,
    color: '#fff',
    marginLeft: 4,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A2138',
  },
  filterOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  filterOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F5F7FA',
  },
  selectedFilter: {
    backgroundColor: '#007AFF',
  },
  filterOptionText: {
    color: '#666',
  },
  selectedFilterText: {
    color: '#FFFFFF',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    marginBottom: 20,
  },
  datePickerText: {
    marginLeft: 8,
    color: '#1A2138',
  },
  applyFilterButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyFilterText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A2138',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  detailsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 1000,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
  detailsImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  detailsGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  detailsContent: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
    marginTop: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  detailsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A2138',
    marginBottom: 24,
  },
  detailsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailsTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  detailsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  detailsText: {
    fontSize: 16,
    color: '#1A2138',
  },
  participantSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  participantTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A2138',
    marginBottom: 16,
  },
  participantStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
})

export default KetThucHD 