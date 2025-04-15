import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, collection, query, where, orderBy, getDocs, Timestamp } from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';

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
}

const QuanLyHoatDong = () => {
  const router = useRouter();
  const db = getFirestore();
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
      const now = Timestamp.fromDate(new Date());
      const activitiesSnapshot = await getDocs(query(
        collection(db, 'activities'),
        where('status', '==', 'approved'),
        where('endDate', '>=', now),
        orderBy('endDate', 'asc')
      ));

      const usersSnapshot = await getDocs(collection(db, 'users'));
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

  const handleViewDetails = (activity: Activity) => {
    setSelectedActivity(activity);
    setModalVisible(true);
  };

  const formatDate = (date: Date | { toDate: () => Date }) => {
    if (date && typeof (date as any).toDate === 'function') {
      return (date as any).toDate().toLocaleString();
    }
    return 'N/A';
  };

  const renderActivityItem = ({ item }: { item: Activity }) => (
    <TouchableOpacity style={styles.activityItem} onPress={() => handleViewDetails(item)}>
      <Text style={styles.activityName}>{item.name}</Text>
      <Text style={styles.activityInfo}>Người tổ chức: {item.creatorName}</Text>
      <Text style={styles.activityInfo}>Thời gian: {formatDate(item.startDate)}</Text>
      <Text style={styles.activityStatus}>Trạng thái: Đã duyệt</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Hoạt động đã duyệt</Text>
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
          <Text style={styles.emptyStateText}>Không có hoạt động nào đã được duyệt.</Text>
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
                <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#F0F0F5',
  },
  container: {
    flex: 1,
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
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
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
  activityStatus: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 4,
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
    width: '90%',
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  modalDescription: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInfo: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  closeButton: {
    marginTop: 20,
    padding: 10,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default QuanLyHoatDong;