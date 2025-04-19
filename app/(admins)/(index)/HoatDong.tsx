import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, collection, query, where, orderBy, getDocs, doc, updateDoc, Timestamp, getDoc } from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

interface Activity {
  id: string;
  name: string;
  description?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  isHidden?: boolean;
  participants?: string[];
  pendingParticipants?: string[];
  status: 'pending' | 'approved' | 'rejected';
}

const HoatDong = () => {
  const router = useRouter();
  const { theme, isDarkMode } = useTheme();
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localActivities, setLocalActivities] = useState<Activity[]>([]);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const db = getFirestore();
      const now = Timestamp.fromDate(new Date());
      console.log('Current time:', now.toDate());

      const activitiesQuery = query(
        collection(db, 'activities'),
        where('status', '==', 'approved'),
        where('endDate', '>=', now),
        orderBy('endDate', 'asc')
      );

      const activitiesSnapshot = await getDocs(activitiesQuery);
      console.log('Query snapshot:', activitiesSnapshot.size);

      const activitiesList = activitiesSnapshot.docs
        .map(doc => {
          const data = doc.data();
          return { 
            id: doc.id, 
            ...data
          } as Activity;
        })
        .filter(activity => !activity.isHidden && activity.startDate.toDate() <= now.toDate());

      setLocalActivities(activitiesList);
    } catch (error) {
      console.error('Error fetching activities:', error);
      alert('Không thể lấy danh sách hoạt động. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleActivityPress = (activity: Activity) => {
    setSelectedActivity(activity);
    setModalVisible(true);
  };

  const handleRegister = async () => {
    if (selectedActivity) {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        try {
          const db = getFirestore();
          const activityRef = doc(db, 'activities', selectedActivity.id);
          
          const activityDoc = await getDoc(activityRef);
          const activityData = activityDoc.data() as Activity | undefined;
          
          if (activityData?.participants?.includes(user.uid)) {
            alert('Bạn đã đăng ký tham gia hoạt động này.');
            return;
          }
          
          if (activityData?.pendingParticipants?.includes(user.uid)) {
            alert('Bạn đã đăng ký và đang chờ phê duyệt cho hoạt động này.');
            return;
          }
          
          await updateDoc(activityRef, {
            pendingParticipants: [...(activityData?.pendingParticipants || []), user.uid]
          });
          
          alert('Đăng ký thành công! Vui lòng chờ phê duyệt.');
          setModalVisible(false);
        } catch (error) {
          console.error('Lỗi khi đăng ký:', error);
          alert('Đã có lỗi xảy ra khi đăng ký.');
        }
      }
    }
  };

  const formatDate = (date: Timestamp | undefined) => {
    if (!date) return 'N/A';
    try {
      return date.toDate().toLocaleDateString();
    } catch (error) {
      return 'N/A';
    }
  };

  const renderActivityItem = ({ item }: { item: Activity }) => {
    if (!item) return null;

    return (
      <TouchableOpacity 
        style={[styles.activityItem, { backgroundColor: theme.colors.surface }]} 
        onPress={() => handleActivityPress(item)}
      >
        <View style={styles.activityContent}>
          <Text style={[styles.activityName, { color: theme.colors.text }]}>{item.name || 'Unnamed Activity'}</Text>
          <View style={styles.activityDetails}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
            <Text style={[styles.activityDate, { color: theme.colors.text }]}>
              {formatDate(item.startDate)}
            </Text>
          </View>
          <View style={styles.activityDetails}>
            <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
            <Text style={[styles.activityDate, { color: theme.colors.text }]}>
              {formatDate(item.endDate)}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward-outline" size={24} color={theme.colors.primary} />
      </TouchableOpacity>
    );
  };

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
      padding: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    refreshButton: {
      padding: 5,
    },
    listContainer: {
      paddingBottom: 20,
    },
    activityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 15,
      padding: 15,
      borderRadius: 12,
      shadowColor: isDarkMode ? '#000' : '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: isDarkMode ? 0.3 : 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
    activityContent: {
      flex: 1,
    },
    activityName: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 5,
    },
    activityDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 5,
    },
    activityDate: {
      fontSize: 14,
      marginLeft: 5,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    noActivitiesText: {
      fontSize: 18,
      color: theme.colors.text,
      marginTop: 10,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalView: {
      width: '90%',
      backgroundColor: theme.colors.surface,
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
      color: theme.colors.text,
      marginBottom: 15,
    },
    modalDescription: {
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    modalDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    modalDetailText: {
      fontSize: 16,
      color: theme.colors.text,
      marginLeft: 10,
    },
    registerButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      padding: 15,
      width: '100%',
      alignItems: 'center',
      marginTop: 20,
    },
    registerButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    closeButton: {
      marginTop: 15,
      padding: 10,
    },
    closeButtonText: {
      color: theme.colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    backButton: {
      padding: 10,
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={theme.colors.background} 
      />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Đang diễn ra</Text>
          <TouchableOpacity onPress={fetchActivities} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : localActivities.length > 0 ? (
          <FlatList
            data={localActivities}
            keyExtractor={(item) => item.id}
            renderItem={renderActivityItem}
            refreshing={loading}
            onRefresh={fetchActivities}
            contentContainerStyle={styles.listContainer}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={theme.colors.primary} />
            <Text style={styles.noActivitiesText}>Không có hoạt động nào đang diễn ra.</Text>
          </View>
        )}
      </View>
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
                <Text style={styles.modalTitle}>{selectedActivity.name || 'Unnamed Activity'}</Text>
                <Text style={styles.modalDescription}>{selectedActivity.description || 'No description available'}</Text>
                <View style={styles.modalDetails}>
                  <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                  <Text style={styles.modalDetailText}>
                    Bắt đầu: {formatDate(selectedActivity.startDate)}
                  </Text>
                </View>
                <View style={styles.modalDetails}>
                  <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
                  <Text style={styles.modalDetailText}>
                    Kết thúc: {formatDate(selectedActivity.endDate)}
                  </Text>
                </View>
                <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
                  <Text style={styles.registerButtonText}>Đăng ký tham gia</Text>
                </TouchableOpacity>
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

export default HoatDong;
