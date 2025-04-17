import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator, 
  Alert, 
  Modal,
  Image,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
  Timestamp,
  getFirestore,
  FirebaseFirestoreTypes
} from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';
import { getApp } from '@react-native-firebase/app';

const { width } = Dimensions.get('window');

interface Activity {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  createdBy: string;
  creatorName: string;
  status: string;
  participantLimit: number;
  bannerImageId?: string;
  bannerUrl?: string;
}

interface ActivityImage {
  imageData: string;
  metadata?: {
    contentType: string;
    uploadedBy: string;
    uploadedAt: string;
  };
}

const QuanLyHoatDong = () => {
  const router = useRouter();
  const app = getApp();
  const db = getFirestore(app);
  const [approvedActivities, setApprovedActivities] = useState<Activity[]>([]);
  const [pendingActivities, setPendingActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchActivities = async () => {
    try {
      setLoading(true);

      // Fetch approved activities
      const approvedRef = collection(db, 'activities');
      const approvedQ = query(
        approvedRef,
        where('status', '==', 'approved'),
        where('endDate', '>=', Timestamp.fromDate(new Date())),
        orderBy('endDate', 'asc')
      );
      const approvedSnapshot = await getDocs(approvedQ);

      // Fetch pending activities
      const pendingRef = collection(db, 'activities');
      const pendingQ = query(
        pendingRef,
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      const pendingSnapshot = await getDocs(pendingQ);

      // Get users data
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const usersMap = new Map(usersSnapshot.docs.map(doc => [doc.id, doc.data()]));

      // Process approved activities
      const approved = await Promise.all(approvedSnapshot.docs.map(async (docSnapshot) => {
        const data = docSnapshot.data();
        const userData = usersMap.get(data.createdBy);
        let bannerUrl = undefined;

        if (data.bannerImageId) {
          const imageRef = doc(db, 'activity_images', data.bannerImageId);
          const imageDoc = await getDoc(imageRef);
          if (imageDoc.exists) {
            const imageData = imageDoc.data() as ActivityImage;
            if (imageData?.imageData) {
              bannerUrl = `data:image/jpeg;base64,${imageData.imageData}`;
            }
          }
        }

        return {
          id: docSnapshot.id,
          ...data,
          startDate: data.startDate.toDate(),
          endDate: data.endDate.toDate(),
          creatorName: userData?.displayName || 'Không xác định',
          bannerUrl
        } as Activity;
      }));

      // Process pending activities
      const pending = await Promise.all(pendingSnapshot.docs.map(async (docSnapshot) => {
        const data = docSnapshot.data();
        const userData = usersMap.get(data.createdBy);
        let bannerUrl = undefined;

        if (data.bannerImageId) {
          const imageRef = doc(db, 'activity_images', data.bannerImageId);
          const imageDoc = await getDoc(imageRef);
          if (imageDoc.exists) {
            const imageData = imageDoc.data() as ActivityImage;
            if (imageData?.imageData) {
              bannerUrl = `data:image/jpeg;base64,${imageData.imageData}`;
            }
          }
        }

        return {
          id: docSnapshot.id,
          ...data,
          startDate: data.startDate.toDate(),
          endDate: data.endDate.toDate(),
          creatorName: userData?.displayName || 'Không xác định',
          bannerUrl
        } as Activity;
      }));

      setApprovedActivities(approved);
      setPendingActivities(pending);
    } catch (error) {
      console.error('Error fetching activities:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách hoạt động. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivities();
  };

  const handleEditActivity = (activity: Activity) => {
    router.push({
      pathname: '/(staffs)/(index)/ChinhSuaHD',
      params: { activityId: activity.id }
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderActivityItem = ({ item }: { item: Activity }) => (
    <TouchableOpacity 
      style={styles.activityItem} 
      onPress={() => {
        setSelectedActivity(item);
        setModalVisible(true);
      }}
    >
      {item.bannerUrl ? (
        <Image 
          source={{ uri: item.bannerUrl }} 
          style={styles.banner}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.bannerPlaceholder}>
          <Ionicons name="image-outline" size={40} color="#CCC" />
        </View>
      )}
      
      <View style={styles.activityContent}>
        <Text style={styles.activityName} numberOfLines={2}>{item.name}</Text>
        
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{item.creatorName}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color="#666" />
          <Text style={styles.infoText} numberOfLines={1}>{item.location || 'Chưa cập nhật'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{formatDate(item.startDate)}</Text>
        </View>

        <View style={styles.statusContainer}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: item.status === 'approved' ? '#4CAF50' : '#FFC107' }
          ]}>
            <Text style={styles.statusText}>
              {item.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}
            </Text>
          </View>
          <Text style={styles.participantCount}>
            <Ionicons name="people-outline" size={14} color="#666" /> {item.participantLimit}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSection = (title: string, data: Activity[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <FlatList
        data={data}
        renderItem={renderActivityItem}
        keyExtractor={(item) => item.id}
        horizontal={false}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#CCC" />
            <Text style={styles.emptyStateText}>Không có hoạt động nào</Text>
          </View>
        }
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Quản lý hoạt động</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : (
        <FlatList
          data={[
            { title: 'Hoạt động chờ duyệt', data: pendingActivities },
            { title: 'Hoạt động đã duyệt', data: approvedActivities }
          ]}
          renderItem={({ item }) => renderSection(item.title, item.data)}
          keyExtractor={(item) => item.title}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedActivity && (
              <>
                {selectedActivity.bannerUrl && (
                  <Image 
                    source={{ uri: selectedActivity.bannerUrl }} 
                    style={styles.modalBanner}
                    resizeMode="cover"
                  />
                )}
                
                <Text style={styles.modalTitle}>{selectedActivity.name}</Text>
                <Text style={styles.modalDescription}>
                  {selectedActivity.description || 'Không có mô tả'}
                </Text>

                <View style={styles.modalInfo}>
                  <View style={styles.infoRow}>
                    <Ionicons name="person-outline" size={18} color="#666" />
                    <Text style={styles.modalInfoText}>
                      Người tổ chức: {selectedActivity.creatorName}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={18} color="#666" />
                    <Text style={styles.modalInfoText}>
                      Địa điểm: {selectedActivity.location || 'Chưa cập nhật'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={18} color="#666" />
                    <Text style={styles.modalInfoText}>
                      Bắt đầu: {formatDate(selectedActivity.startDate)}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={18} color="#666" />
                    <Text style={styles.modalInfoText}>
                      Kết thúc: {formatDate(selectedActivity.endDate)}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Ionicons name="people-outline" size={18} color="#666" />
                    <Text style={styles.modalInfoText}>
                      Số lượng tuyển: {selectedActivity.participantLimit} người
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.editButton]}
                    onPress={() => {
                      setModalVisible(false);
                      handleEditActivity(selectedActivity);
                    }}
                  >
                    <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.modalButtonText}>Chỉnh sửa</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modalButton, styles.closeButton]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Ionicons name="close-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.modalButtonText}>Đóng</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  headerRight: {
    width: 40,
  },
  section: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginVertical: 12,
  },
  activityItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  banner: {
    width: '100%',
    height: 150,
  },
  bannerPlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    padding: 16,
  },
  activityName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  participantCount: {
    fontSize: 14,
    color: '#666666',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: width * 0.9,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalBanner: {
    width: '100%',
    height: 200,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    margin: 16,
  },
  modalDescription: {
    fontSize: 16,
    color: '#666666',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  modalInfo: {
    padding: 16,
    backgroundColor: '#F5F5F5',
  },
  modalInfoText: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 8,
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  closeButton: {
    backgroundColor: '#FF3B30',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default QuanLyHoatDong;