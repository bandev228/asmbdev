import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView, StatusBar, Modal, Dimensions } from 'react-native';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

interface Activity {
  id: string;
  name: string;
  status: 'pending' | 'approved';
  isHidden: boolean;
  createdBy: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  [key: string]: any; // for other potential fields
}

const HDDaTao = () => {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchCreatedActivities();
  }, []);

  const fetchCreatedActivities = async () => {
    setLoading(true);
    try {
      const user = auth().currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const activitiesSnapshot = await firestore()
        .collection('activities')
        .where('createdBy', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .get();

      const activitiesList = activitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isHidden: doc.data().isHidden || false
      })) as Activity[];

      setActivities(activitiesList);
    } catch (error) {
      console.error('Error fetching created activities:', error);
      alert('Không thể lấy danh sách hoạt động đã tạo. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleActivityPress = (activity: Activity) => {
    setSelectedActivity(activity);
    setModalVisible(true);
  };

  const handleEditActivity = (activity: Activity) => {
    router.push({
      pathname: "./SuaHD",
      params: { id: activity.id }
    });
  };

  const handleDeleteActivity = async () => {
    setModalVisible(false);
    if (selectedActivity) {
      try {
        await firestore().collection('activities').doc(selectedActivity.id).delete();
        alert('Hoạt động đã được xóa thành công');
        fetchCreatedActivities();
      } catch (error) {
        console.error('Error deleting activity:', error);
        alert('Không thể xóa hoạt động. Vui lòng thử lại.');
      }
    }
  };

  const handleHideActivity = async () => {
    setModalVisible(false);
    if (selectedActivity) {
      try {
        await firestore().collection('activities').doc(selectedActivity.id).update({
          isHidden: true
        });
        alert('Hoạt động đã được ẩn');
        fetchCreatedActivities();
      } catch (error) {
        console.error('Error hiding activity:', error);
        alert('Không thể ẩn hoạt động. Vui lòng thử lại.');
      }
    }
  };

  const handleToggleVisibility = async () => {
    setModalVisible(false);
    if (selectedActivity) {
      try {
        const newVisibility = !selectedActivity.isHidden;
        await firestore().collection('activities').doc(selectedActivity.id).update({
          isHidden: newVisibility
        });
        alert(newVisibility ? 'Hoạt động đã được ẩn' : 'Hoạt động đã được hiển thị');
        fetchCreatedActivities();
      } catch (error) {
        console.error('Error toggling activity visibility:', error);
        alert('Không thể thay đổi trạng thái hiển thị của hoạt động. Vui lòng thử lại.');
      }
    }
  };

  const renderActivityItem = ({ item }: { item: Activity }) => (
    <TouchableOpacity
      style={styles.activityItem}
      onPress={() => handleActivityPress(item)}
    >
      <View>
        <Text style={styles.activityName}>{item.name}</Text>
        <Text style={styles.activityStatus}>
          Trạng thái: {item.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}
        </Text>
        <Text style={[styles.activityVisibility, { color: item.isHidden ? '#FF9500' : '#34C759' }]}>
          {item.isHidden ? 'Trạng thái: Đang ẩn' : 'Trạng thái: Hiển thị'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F0F5" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Hoạt động đã tạo</Text>
          <TouchableOpacity onPress={fetchCreatedActivities} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        ) : activities.length > 0 ? (
          <FlatList
            data={activities}
            keyExtractor={(item) => item.id}
            renderItem={renderActivityItem}
            refreshing={loading}
            onRefresh={fetchCreatedActivities}
            contentContainerStyle={styles.listContainer}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={screenWidth * 0.15} color="#CCC" />
            <Text style={styles.noActivitiesText}>Bạn chưa tạo hoạt động nào.</Text>
          </View>
        )}
      </View>
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity onPress={() => selectedActivity && handleEditActivity(selectedActivity)}>
              <Text style={styles.modalOption}>Chỉnh sửa hoạt động</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleToggleVisibility}>
              <Text style={styles.modalOption}>
                {selectedActivity?.isHidden ? 'Hiển thị hoạt động' : 'Ẩn hoạt động'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteActivity}>
              <Text style={[styles.modalOption, styles.deleteOption]}>Xóa hoạt động</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalOption}>Hủy</Text>
            </TouchableOpacity>
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
    padding: screenWidth * 0.04,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: screenWidth * 0.02,
  },
  title: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: screenWidth * 0.02,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: screenWidth * 0.04,
  },
  activityItem: {
    backgroundColor: '#FFFFFF',
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.02,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activityName: {
    fontSize: screenWidth * 0.045,
    fontWeight: '600',
    color: '#333333',
    marginBottom: screenHeight * 0.01,
  },
  activityStatus: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
    marginBottom: screenHeight * 0.005,
  },
  activityVisibility: {
    fontSize: screenWidth * 0.035,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: screenWidth * 0.04,
  },
  noActivitiesText: {
    fontSize: screenWidth * 0.04,
    color: '#666666',
    marginTop: screenHeight * 0.02,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: screenWidth * 0.8,
    backgroundColor: 'white',
    borderRadius: screenWidth * 0.05,
    padding: screenWidth * 0.06,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  modalOption: {
    fontSize: screenWidth * 0.04,
    color: '#007AFF',
    paddingVertical: screenHeight * 0.015,
    fontWeight: '500',
  },
  deleteOption: {
    color: '#FF3B30',
  }
});

export default HDDaTao;
