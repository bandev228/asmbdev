import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView, StatusBar, Modal, Dimensions, Image } from 'react-native';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc, Timestamp } from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

interface Activity {
  id: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  isHidden: boolean;
  createdBy: string;
  creatorDisplayName?: string;
  createdAt: Timestamp;
  bannerImageUrl?: string;
  location: string;
  startDate: Timestamp;
  endDate: Timestamp;
  participants?: string[];
  pendingParticipants?: string[];
}

const HDDaTao = () => {
  const router = useRouter();
  const { theme, isDarkMode } = useTheme();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const db = getFirestore();
      const activitiesQuery = query(
        collection(db, 'activities'),
        where('status', '==', 'approved')
      );

      const snapshot = await getDocs(activitiesQuery);
      const activitiesList = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();
          try {
            const creatorRef = doc(db, 'users', data.createdBy);
            const creatorDoc = await getDoc(creatorRef);
            const creatorData = creatorDoc.data();
            
            return {
              id: docSnapshot.id,
              ...data,
              creatorDisplayName: creatorData?.displayName || 'Người dùng ' + data.createdBy.slice(0, 6)
            } as Activity;
          } catch (err) {
            console.error('Error fetching creator data:', err);
            return {
              id: docSnapshot.id,
              ...data,
              creatorDisplayName: 'Người dùng ' + data.createdBy.slice(0, 6)
            } as Activity;
          }
        })
      );

      setActivities(activitiesList);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError('Không thể tải danh sách hoạt động. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const handleActivityPress = (activity: Activity) => {
    setSelectedActivity(activity);
    setModalVisible(true);
  };

  const handleEditActivity = (activity: Activity) => {
    setModalVisible(false);
    router.push({
      pathname: "./ChinhSuaHD",
      params: { id: activity.id }
    });
  };

  const handleDeleteActivity = async () => {
    setModalVisible(false);
    if (selectedActivity) {
      try {
        const db = getFirestore();
        await deleteDoc(doc(db, 'activities', selectedActivity.id));
        alert('Hoạt động đã được xóa thành công');
        fetchActivities();
      } catch (error) {
        console.error('Error deleting activity:', error);
        alert('Không thể xóa hoạt động. Vui lòng thử lại.');
      }
    }
  };

  const handleToggleVisibility = async () => {
    setModalVisible(false);
    if (selectedActivity) {
      try {
        const db = getFirestore();
        await updateDoc(doc(db, 'activities', selectedActivity.id), {
          isHidden: !selectedActivity.isHidden
        });
        alert(!selectedActivity.isHidden ? 'Hoạt động đã được ẩn' : 'Hoạt động đã được hiển thị');
        fetchActivities();
      } catch (error) {
        console.error('Error toggling activity visibility:', error);
        alert('Không thể thay đổi trạng thái hiển thị của hoạt động. Vui lòng thử lại.');
      }
    }
  };

  const formatDate = (date: Timestamp) => {
    if (!date) return 'N/A';
    try {
      return date.toDate().toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#34C759';
      case 'pending':
        return '#FF9500';
      case 'rejected':
        return '#FF3B30';
      default:
        return '#666666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Đã duyệt';
      case 'pending':
        return 'Chờ duyệt';
      case 'rejected':
        return 'Đã từ chối';
      default:
        return 'Không xác định';
    }
  };

  const renderActivityItem = ({ item }: { item: Activity }) => (
    <TouchableOpacity
      style={styles.activityItem}
      onPress={() => handleActivityPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.activityImageContainer}>
        {item.bannerImageUrl ? (
          <Image source={{ uri: item.bannerImageUrl }} style={styles.activityImage} />
        ) : (
          <View style={styles.activityImagePlaceholder}>
            <Ionicons name="image-outline" size={30} color="#CBD5E1" />
          </View>
        )}
      </View>

      <View style={styles.activityContent}>
        <Text style={styles.activityName} numberOfLines={2}>
          {item.name}
        </Text>

        <View style={styles.activityMeta}>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.creatorDisplayName}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.metaText}>
              {formatDate(item.startDate)}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
        </View>

        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </Text>
          </View>

          {item.isHidden && (
            <View style={[styles.statusBadge, { backgroundColor: '#64748B20' }]}>
              <Ionicons name="eye-off-outline" size={14} color="#64748B" />
              <Text style={[styles.statusText, { color: '#64748B' }]}>Đã ẩn</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: theme.colors.card }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>Quản lý hoạt động</Text>
          <TouchableOpacity onPress={fetchActivities} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        ) : activities.length > 0 ? (
          <FlatList
            data={activities}
            keyExtractor={(item) => item.id}
            renderItem={renderActivityItem}
            refreshing={loading}
            onRefresh={fetchActivities}
            contentContainerStyle={styles.listContainer}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#CBD5E1" />
            <Text style={[styles.noActivitiesText, { color: theme.colors.text }]}>
              Chưa có hoạt động nào được tạo
            </Text>
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
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => selectedActivity && handleEditActivity(selectedActivity)}
            >
              <Ionicons name="create-outline" size={24} color={theme.colors.primary} />
              <Text style={[styles.modalOptionText, { color: theme.colors.primary }]}>
                Chỉnh sửa hoạt động
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOption} onPress={handleToggleVisibility}>
              <Ionicons 
                name={selectedActivity?.isHidden ? "eye-outline" : "eye-off-outline"} 
                size={24} 
                color={theme.colors.primary} 
              />
              <Text style={[styles.modalOptionText, { color: theme.colors.primary }]}>
                {selectedActivity?.isHidden ? 'Hiển thị hoạt động' : 'Ẩn hoạt động'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOption} onPress={handleDeleteActivity}>
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
              <Text style={[styles.modalOptionText, { color: '#FF3B30' }]}>
                Xóa hoạt động
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalOption, styles.cancelOption]} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.modalOptionText, { color: theme.colors.text }]}>Hủy</Text>
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
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 8,
  },
  loader: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
  },
  activityItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  activityImageContainer: {
    height: 120,
    backgroundColor: '#F1F5F9',
  },
  activityImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  activityImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    padding: 12,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  activityMeta: {
    gap: 4,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#64748B',
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noActivitiesText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelOption: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 8,
    paddingTop: 16,
  },
});

export default HDDaTao;
