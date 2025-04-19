import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Modal, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, getDoc } from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';
import { Timestamp } from '@react-native-firebase/firestore';

interface Activity {
  id: string;
  name: string;
  description: string;
  location: string;
  startDate: Timestamp;
  endDate: Timestamp;
  createdBy: string;
  creatorName: string;
  creatorEmail: string;
  creatorRole: string;
  status: 'pending' | 'approved' | 'rejected';
  bannerImageId?: string;
  bannerImage?: string | null;
  participantLimit: number;
  duration: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

const DuyetHoatDong = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const router = useRouter();
  const db = getFirestore();

  useEffect(() => {
    fetchActivities();
  }, []);

  const getBannerImage = async (imageId: string) => {
    try {
      const imageDoc = await getDoc(doc(db, 'activity_images', imageId));
      if (imageDoc.exists) {
        const imageData = imageDoc.data();
        if (imageData && imageData.imageData) {
          return `data:image/jpeg;base64,${imageData.imageData}`;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting banner image:', error);
      return null;
    }
  };

  const fetchActivities = async () => {
    setLoading(true);
    try {
      // Lấy danh sách người dùng trước
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      
      // console.log('Users count:', usersSnapshot.size);
      
      // Tạo map lưu thông tin người dùng
      const usersMap = new Map();
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        // console.log('User data:', doc.id, userData);
        if (userData) {
          usersMap.set(doc.id, {
            displayName: userData.displayName || 'Không xác định',
            email: userData.email || '',
            role: userData.role || 'student'
          });
        }
      });

      // console.log('Users Map after processing:', Array.from(usersMap.entries()));

      // Lấy danh sách hoạt động
      const activitiesQuery = query(
        collection(db, 'activities'),
        where('status', '==', 'pending')
      );
      const activitiesSnapshot = await getDocs(activitiesQuery);

      const activitiesList = await Promise.all(activitiesSnapshot.docs.map(async doc => {
        const activityData = doc.data();
        let bannerImage = null;
        if (activityData.bannerImageId) {
          bannerImage = await getBannerImage(activityData.bannerImageId);
        }

        // Lấy thông tin người tổ chức
        const creatorId = activityData.createdBy;
        const creatorInfo = usersMap.get(creatorId);
        
        console.log('Activity:', doc.id);
        console.log('Creator ID:', creatorId);
        console.log('Creator Info:', creatorInfo);

        return {
          id: doc.id,
          name: activityData.name || '',
          description: activityData.description || '',
          location: activityData.location || '',
          startDate: activityData.startDate,
          endDate: activityData.endDate,
          createdBy: creatorId,
          creatorName: creatorInfo?.displayName || 'Không xác định',
          creatorEmail: creatorInfo?.email || '',
          creatorRole: creatorInfo?.role || 'student',
          status: activityData.status || 'pending',
          bannerImageId: activityData.bannerImageId,
          bannerImage,
          participantLimit: activityData.participantLimit || 0,
          duration: activityData.duration || 0,
          coordinates: activityData.coordinates
        } as Activity;
      }));

      setActivities(activitiesList);
    } catch (error) {
      console.error('Error fetching activities:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách hoạt động. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (activityId: string) => {
    try {
      await updateDoc(doc(db, 'activities', activityId), {
        status: 'approved'
      });
      Alert.alert('Thành công', 'Hoạt động đã được phê duyệt.');
      fetchActivities();
    } catch (error) {
      console.error('Error approving activity:', error);
      Alert.alert('Lỗi', 'Không thể phê duyệt hoạt động. Vui lòng thử lại.');
    }
  };

  const handleReject = async (activityId: string) => {
    try {
      await updateDoc(doc(db, 'activities', activityId), {
        status: 'rejected'
      });
      Alert.alert('Thành công', 'Hoạt động đã bị từ chối.');
      fetchActivities();
    } catch (error) {
      console.error('Error rejecting activity:', error);
      Alert.alert('Lỗi', 'Không thể từ chối hoạt động. Vui lòng thử lại.');
    }
  };

  const handleViewDetails = async (activity: Activity) => {
    if (activity.bannerImageId) {
      const banner = await getBannerImage(activity.bannerImageId);
      setBannerImage(banner);
    }
    setSelectedActivity(activity);
    setModalVisible(true);
  };

  const formatDate = (date: Timestamp | undefined) => {
    if (date && typeof date.toDate === 'function') {
      return date.toDate().toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return 'N/A';
  };

  const renderActivityItem = ({ item }: { item: Activity }) => (
    <TouchableOpacity style={styles.activityItem} onPress={() => handleViewDetails(item)}>
      {item.bannerImage && (
        <Image source={{ uri: item.bannerImage }} style={styles.activityBanner} />
      )}
      <View style={styles.activityContent}>
        <Text style={styles.activityName}>{item.name}</Text>
        <Text style={styles.activityInfo}>Người tổ chức: {item.creatorName}</Text>
        <Text style={styles.activityInfo}>Thời gian: {formatDate(item.startDate)}</Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.approveButton} onPress={() => handleApprove(item.id)}>
            <Text style={styles.buttonText}>Phê duyệt</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectButton} onPress={() => handleReject(item.id)}>
            <Text style={styles.buttonText}>Từ chối</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderModalContent = () => {
    if (!selectedActivity) return null;

    return (
      <ScrollView style={styles.modalScrollView}>
        {bannerImage && (
          <Image source={{ uri: bannerImage }} style={styles.modalBanner} />
        )}
        <Text style={styles.modalTitle}>{selectedActivity.name}</Text>
        <Text style={styles.modalDescription}>{selectedActivity.description || 'Không có mô tả'}</Text>
        <View style={styles.modalInfoContainer}>
          <View style={styles.modalInfoRow}>
            <Ionicons name="person-outline" size={20} color="#666" />
            <View>
              <Text style={styles.modalInfo}>Người tổ chức: {selectedActivity.creatorName}</Text>
              <Text style={styles.modalSubInfo}>{selectedActivity.creatorEmail}</Text>
              <Text style={styles.modalSubInfo}>Vai trò: {selectedActivity.creatorRole}</Text>
            </View>
          </View>
          <View style={styles.modalInfoRow}>
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <Text style={styles.modalInfo}>Bắt đầu: {formatDate(selectedActivity.startDate)}</Text>
          </View>
          <View style={styles.modalInfoRow}>
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <Text style={styles.modalInfo}>Kết thúc: {formatDate(selectedActivity.endDate)}</Text>
          </View>
          <View style={styles.modalInfoRow}>
            <Ionicons name="location-outline" size={20} color="#666" />
            <Text style={styles.modalInfo}>Địa điểm: {selectedActivity.location || 'Chưa xác định'}</Text>
          </View>
          <View style={styles.modalInfoRow}>
            <Ionicons name="people-outline" size={20} color="#666" />
            <Text style={styles.modalInfo}>Số lượng: {selectedActivity.participantLimit} người</Text>
          </View>
          <View style={styles.modalInfoRow}>
            <Ionicons name="time-outline" size={20} color="#666" />
            <Text style={styles.modalInfo}>Thời lượng: {selectedActivity.duration} giờ</Text>
          </View>
        </View>
        <View style={styles.modalButtonContainer}>
          <TouchableOpacity 
            style={[styles.modalButton, styles.approveButton]} 
            onPress={() => {
              handleApprove(selectedActivity.id);
              setModalVisible(false);
            }}
          >
            <Text style={styles.modalButtonText}>Phê duyệt</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.modalButton, styles.rejectButton]} 
            onPress={() => {
              handleReject(selectedActivity.id);
              setModalVisible(false);
            }}
          >
            <Text style={styles.modalButtonText}>Từ chối</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Duyệt hoạt động</Text>
        <TouchableOpacity onPress={fetchActivities} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : activities.length > 0 ? (
        <FlatList
          data={activities}
          renderItem={renderActivityItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color="#CCC" />
          <Text style={styles.emptyStateText}>Không có hoạt động nào cần duyệt.</Text>
        </View>
      )}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            {renderModalContent()}
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>Đóng</Text>
            </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
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
  refreshButton: {
    padding: 8,
  },
  listContainer: {
    padding: 16,
  },
  activityItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  activityBanner: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
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
  activityInfo: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalScrollView: {
    padding: 20,
  },
  modalBanner: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    resizeMode: 'cover',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333333',
  },
  modalDescription: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 15,
    lineHeight: 24,
  },
  modalInfoContainer: {
    marginBottom: 20,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalInfo: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
    flex: 1,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
  },
  modalButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#007AFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginRight: 5,
  },
  rejectButton: {
    backgroundColor: '#F44336',
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginLeft: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  modalSubInfo: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
    marginTop: 2,
  },
});

export default DuyetHoatDong;