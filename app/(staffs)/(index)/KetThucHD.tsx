import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  FlatList,
  Animated,
  Dimensions,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { 
  getFirestore, 
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc
} from "@react-native-firebase/firestore"
import { useRouter } from "expo-router"
import { LinearGradient } from 'expo-linear-gradient'

interface CompletedActivity {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  location: string;
  creatorName: string;
  participantsCount: number;
  bannerImageId?: string;
  bannerImage?: string;
}

const { width } = Dimensions.get('window')

const KetThucHD = () => {
  const router = useRouter()
  const [activities, setActivities] = useState<CompletedActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedActivity, setSelectedActivity] = useState<CompletedActivity | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const fadeAnim = new Animated.Value(0)

  useEffect(() => {
    loadCompletedActivities()
  }, [])

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

          let bannerImage = undefined
          if (data.bannerImageId) {
            const imageDoc = await getDoc(doc(db, 'activity_images', data.bannerImageId))
            if (imageDoc.exists) {
              const imageData = imageDoc.data()
              if (imageData && imageData.imageData) {
                bannerImage = `data:image/jpeg;base64,${imageData.imageData}`
              }
            }
          }

          return {
            id: docSnapshot.id,
            name: data.name,
            startDate: data.startDate.toDate(),
            endDate: data.endDate.toDate(),
            location: data.location,
            creatorName: creatorData?.displayName || 'Không xác định',
            participantsCount: data.participants?.length || 0,
            bannerImageId: data.bannerImageId,
            bannerImage
          }
        })
      )

      setActivities(activitiesData)
    } catch (error) {
      console.error('Error loading completed activities:', error)
    } finally {
      setLoading(false)
    }
  }

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
        {item.bannerImage ? (
          <Image source={{ uri: item.bannerImage }} style={styles.activityImage} />
        ) : (
          <View style={[styles.activityImage, styles.placeholderImage]}>
            <Ionicons name="image-outline" size={40} color="#ccc" />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.gradientOverlay}
        />
        <View style={styles.activityInfo}>
          <Text style={styles.activityTitle} numberOfLines={2}>{item.name}</Text>
          <View style={styles.activityMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color="#fff" />
              <Text style={styles.metaText}>
                {item.startDate.toLocaleDateString('vi-VN')}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={16} color="#fff" />
              <Text style={styles.metaText}>{item.location}</Text>
            </View>
          </View>
          <View style={styles.participantInfo}>
            <Ionicons name="people-outline" size={16} color="#fff" />
            <Text style={styles.participantCount}>{item.participantsCount} sinh viên</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )

  const renderActivityDetails = () => {
    if (!selectedActivity) return null

    return (
      <Animated.View 
        style={[
          styles.detailsContainer,
          { opacity: fadeAnim }
        ]}
      >
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => setShowDetails(false)}
        >
          <Ionicons name="close-circle" size={32} color="#fff" />
        </TouchableOpacity>

        {selectedActivity.bannerImage ? (
          <Image 
            source={{ uri: selectedActivity.bannerImage }} 
            style={styles.detailsImage}
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
                  {selectedActivity.startDate.toLocaleDateString('vi-VN')} - {selectedActivity.endDate.toLocaleDateString('vi-VN')}
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Hoạt động đã diễn ra</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivityItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          numColumns={2}
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 8,
  },
  activityItem: {
    width: (width - 24) / 2,
    margin: 4,
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
    position: 'relative',
  },
  activityImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  activityInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  activityMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 4,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantCount: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 4,
  },
  detailsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
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
    height: 250,
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
    marginBottom: 24,
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