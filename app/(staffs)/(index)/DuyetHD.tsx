// SamApp/src/view/screens/manager/ApproveActivitiesScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';

const DuyetHoatDong = ({ }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState(null);
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
        };
      });

      setActivities(activitiesList);
    } catch (error) {
      console.error('Error fetching activities:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách hoạt động. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (activityId) => {
    try {
      await firestore().collection('activities').doc(activityId).update({
        status: 'approved'
      });
      Alert.alert('Thành công', 'Hoạt động đã được phê duyệt.');
      fetchActivities();
    } catch (error) {
      console.error('Error approving activity:', error);
      Alert.alert('Lỗi', 'Không thể phê duyệt hoạt động. Vui lòng thử lại.');
    }
  };

  const handleReject = async (activityId) => {
    try {
      await firestore().collection('activities').doc(activityId).update({
        status: 'rejected'
      });
      Alert.alert('Thành công', 'Hoạt động đã bị từ chối.');
      fetchActivities();
    } catch (error) {
      console.error('Error rejecting activity:', error);
      Alert.alert('Lỗi', 'Không thể từ chối hoạt động. Vui lòng thử lại.');
    }
  };

  const handleViewDetails = (activity) => {
    setSelectedActivity(activity);
    setModalVisible(true);
  };

  const formatDate = (date) => {
    if (date && typeof date.toDate === 'function') {
      return date.toDate().toLocaleString();
    }
    return 'N/A';
  };

  const renderActivityItem = ({ item }) => (
    <TouchableOpacity style={styles.activityItem} onPress={() => handleViewDetails(item)}>
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
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
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
            {selectedActivity && (
              <>
                <Text style={styles.modalTitle}>{selectedActivity.name}</Text>
                <Text style={styles.modalDescription}>{selectedActivity.description || 'Không có mô tả'}</Text>
                <Text style={styles.modalInfo}>Người tổ chức: {selectedActivity.creatorName}</Text>
                <Text style={styles.modalInfo}>Bắt đầu: {formatDate(selectedActivity.startDate)}</Text>
                <Text style={styles.modalInfo}>Kết thúc: {formatDate(selectedActivity.endDate)}</Text>
                <Text style={styles.modalInfo}>Địa điểm: {selectedActivity.location || 'Chưa xác định'}</Text>
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
  activityName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
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
    marginBottom: 15
  },
  modalDescription: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 15
  },
  modalInfo: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 15
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
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
    borderRadius: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold'
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginRight: 5,
  },
  rejectButton: {
    backgroundColor: '#F44336',
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginLeft: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

export default DuyetHoatDong;
