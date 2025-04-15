import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';

interface Activity {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  creatorName?: string;
  startDate: FirebaseFirestoreTypes.Timestamp;
  endDate: FirebaseFirestoreTypes.Timestamp;
  location: string;
  status: 'pending' | 'approved' | 'rejected';
}

const DuyetHD = () => {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const activitiesSnapshot = await firestore()
        .collection('activities')
        .where('status', '==', 'pending')
        .get();

      const usersSnapshot = await firestore().collection('users').get();
      const usersMap = new Map(usersSnapshot.docs.map(doc => [doc.id, doc.data().fullname]));

      const activitiesList = activitiesSnapshot.docs.map(doc => {
        const activityData = doc.data();
        return {
          id: doc.id,
          ...activityData,
          creatorName: usersMap.get(activityData.createdBy) || 'Không xác định'
        } as Activity;
      });

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
      await firestore().collection('activities').doc(activityId).update({
        status: 'approved'
      });
      fetchActivities();
      Alert.alert('Thành công', 'Hoạt động đã được phê duyệt.');
    } catch (error) {
      console.error('Error approving activity:', error);
      Alert.alert('Lỗi', 'Không thể phê duyệt hoạt động. Vui lòng thử lại.');
    }
  };

  const handleReject = async (activityId: string) => {
    try {
      await firestore().collection('activities').doc(activityId).update({
        status: 'rejected'
      });
      fetchActivities();
      Alert.alert('Thành công', 'Hoạt động đã bị từ chối.');
    } catch (error) {
      console.error('Error rejecting activity:', error);
      Alert.alert('Lỗi', 'Không thể từ chối hoạt động. Vui lòng thử lại.');
    }
  };

  const renderActivityItem = ({ item }: { item: Activity }) => (
    <TouchableOpacity 
      style={styles.activityItem}
      onPress={() => {
        setSelectedActivity(item);
        setModalVisible(true);
      }}
    >
      <View style={styles.activityHeader}>
        <Text style={styles.activityName}>{item.name || 'Hoạt động không tên'}</Text>
        <Text style={styles.activityStatus}>Chờ duyệt</Text>
      </View>
      <Text style={styles.activityOrganizer}>Người tổ chức: {item.creatorName}</Text>
      <Text style={styles.activityDate}>
        {formatDate(item.startDate)} - {formatDate(item.endDate)}
      </Text>
    </TouchableOpacity>
  );

  const formatDate = (date: FirebaseFirestoreTypes.Timestamp) => {
    if (date && typeof date.toDate === 'function') {
      return date.toDate().toLocaleDateString();
    }
    return 'Chưa xác định';
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
          <Text style={styles.emptyStateText}>Không có hoạt động nào chờ duyệt.</Text>
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
            {selectedActivity && (
              <>
                <Text style={styles.modalTitle}>{selectedActivity.name}</Text>
                <Text style={styles.modalDescription}>{selectedActivity.description || 'Không có mô tả'}</Text>
                <Text style={styles.modalInfo}>Người tổ chức: {selectedActivity.creatorName}</Text>
                <Text style={styles.modalInfo}>Bắt đầu: {formatDate(selectedActivity.startDate)}</Text>
                <Text style={styles.modalInfo}>Kết thúc: {formatDate(selectedActivity.endDate)}</Text>
                <Text style={styles.modalInfo}>Địa điểm: {selectedActivity.location || 'Chưa xác định'}</Text>
                <View style={styles.modalActions}>
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
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>Đóng</Text>
                </TouchableOpacity>
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
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
  },
  activityStatus: {
    fontSize: 14,
    color: '#FFA000',
    fontWeight: '500',
  },
  activityOrganizer: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  activityDate: {
    fontSize: 14,
    color: '#666666',
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
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInfo: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  modalButton: {
    padding: 10,
    borderRadius: 8,
    width: '48%',
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  closeButton: {
    marginTop: 20,
    padding: 10,
  },
  closeButtonText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
});

export default DuyetHD;
