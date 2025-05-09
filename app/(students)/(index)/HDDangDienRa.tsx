import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator, Alert, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, arrayUnion, Timestamp, getDoc } from '@react-native-firebase/firestore';
import { useAuth } from '@/app/_layout';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useIsFocused } from '@react-navigation/native';

interface AttendanceRouteParams {
  activityId: string;
  activityName: string;
  onAttendanceComplete: () => Promise<void>;
}

interface Activity {
  id: string;
  name: string;
  notes: string;
  location: string;
  startDate: Timestamp;
  endDate: Timestamp;
  startTime: string;
  endTime: string;
  activityType: string;
  points: number;
  bannerImageUrl: string;
  participants: string[];
  pendingParticipants: string[];
  isAttendanceEnabled?: boolean;
  maxParticipants?: number;
  status?: string;
  organizer?: string;
  requirements?: string;
  attendanceStatus?: {
    [userId: string]: {
      status: 'attended' | 'not_attended';
      timestamp: Timestamp;
    }
  };
  hasAttended: boolean;
}

interface AttendanceRecord {
  activityId: string;
  userId: string;
  status: 'verified' | 'pending' | 'failed';
  timestamp: Timestamp;
  imageData: string;
  verificationMethod: string;
  verificationScore: number;
  verifiedByAI: boolean;
}

const formatParticipantCount = (participants: string[] = [], maxParticipants?: number) => {
  const currentCount = participants.length;
  if (maxParticipants) {
    return `${currentCount}/${maxParticipants} người tham gia`;
  }
  return `${currentCount} người tham gia`;
};

const formatDateTime = (date: Timestamp, time: string) => {
  const formattedDate = format(date.toDate(), 'dd/MM/yyyy', { locale: vi });
  return `${formattedDate} lúc ${time}`;
};

const HDDangDienRa = () => {
  const router = useRouter();
  const { user, initializing } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused && !initializing && user) {
      fetchActivities();
    }
  }, [isFocused, user, initializing]);

  useEffect(() => {
    if (initializing) {
      return;
    }

    if (!user) {
      Alert.alert(
        "Thông báo",
        "Vui lòng đăng nhập để xem hoạt động",
        [
          {
            text: "OK",
            onPress: () => router.push("/(auth)/login")
          }
        ]
      );
      return;
    }

    fetchActivities();
  }, [user, initializing]);

  const fetchActivities = async () => {
    try {
      const db = getFirestore();
      const now = Timestamp.now();
      
      const activitiesQuery = query(
        collection(db, 'activities'),
        where('startDate', '<=', now),
        where('endDate', '>=', now)
      );

      const querySnapshot = await getDocs(activitiesQuery);
      const fetchedActivities = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Activity[];

      setActivities(fetchedActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách hoạt động');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (activityId: string) => {
    console.log('Registering for activity:', activityId);
    console.log('Current user:', user); // Debug log

    if (!user?.uid) {
      console.error('No user found');
      Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng');
      return;
    }

    try {
      setRegistering(activityId);
      const db = getFirestore();
      const activityRef = doc(db, 'activities', activityId);

      // Check if already registered
      const activityDoc = await getDoc(activityRef);
      const activityData = activityDoc.data() as Activity | undefined;

      if (activityData?.participants?.includes(user.uid)) {
        Alert.alert('Thông báo', 'Bạn đã được duyệt tham gia hoạt động này');
        return;
      }

      if (activityData?.pendingParticipants?.includes(user.uid)) {
        Alert.alert('Thông báo', 'Bạn đã gửi yêu cầu đăng ký và đang chờ duyệt');
        return;
      }

      await updateDoc(activityRef, {
        pendingParticipants: arrayUnion(user.uid)
      });

      Alert.alert('Thành công', 'Đã gửi yêu cầu đăng ký tham gia');
      fetchActivities(); // Refresh activities list
    } catch (error) {
      console.error('Error registering:', error);
      Alert.alert('Lỗi', 'Không thể đăng ký tham gia');
    } finally {
      setRegistering(null);
    }
  };

  const getRegistrationStatus = (activity: Activity) => {
    if (!user) return null;
    
    if (activity.participants?.includes(user.uid)) {
      return 'approved';
    }
    if (activity.pendingParticipants?.includes(user.uid)) {
      return 'pending';
    }
    return null;
  };

  const checkAttendanceStatus = async (activityId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const db = getFirestore();
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('activityId', '==', activityId),
        where('userId', '==', user.uid),
        where('status', '==', 'verified')
      );
      
      const querySnapshot = await getDocs(attendanceQuery);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking attendance status:', error);
      return false;
    }
  };

  const handleAttendance = async (activity: Activity) => {
    if (!user) {
      Alert.alert("Thông báo", "Vui lòng đăng nhập để điểm danh");
      return;
    }

    if (!activity.participants?.includes(user.uid)) {
      Alert.alert(
        "Thông báo", 
        "Bạn chưa được duyệt tham gia hoạt động này. Vui lòng đăng ký và chờ duyệt."
      );
      return;
    }

    // Check if already attended
    const hasAttended = await checkAttendanceStatus(activity.id);
    if (hasAttended) {
      Alert.alert("Thông báo", "Bạn đã điểm danh hoạt động này rồi");
      return;
    }

    // Navigate to attendance screen
    router.push({
      pathname: "/DiemDanhHD",
      params: {
        activityId: activity.id,
        activityName: activity.name
      }
    });
  };

  // Update useEffect to check attendance status and filter ongoing activities
  useEffect(() => {
    const updateAttendanceStatus = async () => {
      if (!user || !isFocused) return;

      try {
        const db = getFirestore();
        const now = Timestamp.now();
        
        // Query for ongoing activities
        const activitiesQuery = query(
          collection(db, 'activities'),
          where('startDate', '<=', now),
          where('endDate', '>=', now)
        );
        const activitiesSnapshot = await getDocs(activitiesQuery);

        // Get attendance records
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('userId', '==', user.uid),
          where('status', '==', 'verified')
        );
        const attendanceSnapshot = await getDocs(attendanceQuery);
        
        const attendedActivityIds = new Set(
          attendanceSnapshot.docs.map(doc => doc.data().activityId)
        );

        const updatedActivities = activitiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          hasAttended: attendedActivityIds.has(doc.id)
        })) as Activity[];

        setActivities(updatedActivities);
      } catch (error) {
        console.error('Error updating attendance status:', error);
      }
    };

    updateAttendanceStatus();
  }, [isFocused, user]);

  const renderRegistrationButton = (activity: Activity | null) => {
    if (!activity || !user) return null;
    
    const status = getRegistrationStatus(activity);
    
    if (status === 'approved') {
      const hasAttended = activity.hasAttended;
      
      return (
        <View style={styles.buttonContainer}>
          <View style={[styles.statusBadge, styles.approvedBadge]}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.statusText}>Đã được duyệt</Text>
          </View>
          {hasAttended ? (
            <View style={[styles.attendanceButton, { backgroundColor: '#34C759' }]}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.attendanceButtonText}>Đã điểm danh</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.attendanceButton}
              onPress={() => handleAttendance(activity)}
            >
              <Ionicons name="qr-code" size={20} color="#fff" />
              <Text style={styles.attendanceButtonText}>Điểm danh</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    
    if (status === 'pending') {
      return (
        <View style={[styles.statusBadge, styles.pendingBadge]}>
          <Ionicons name="time" size={16} color="#fff" />
          <Text style={styles.statusText}>Đang chờ duyệt</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.registerButton}
        onPress={() => handleRegister(activity.id)}
        disabled={registering === activity.id}
      >
        {registering === activity.id ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.registerButtonText}>Đăng ký tham gia</Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const handleActivityPress = (activity: Activity) => {
    // console.log('Selected activity:', activity); // Debug log
    setSelectedActivity(activity);
    setModalVisible(true);
  };

  const renderActivityModal = () => {
    if (!selectedActivity) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          setSelectedActivity(null);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                onPress={() => {
                  setModalVisible(false);
                  setSelectedActivity(null);
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Thông tin chi tiết</Text>
              <View style={styles.closeButton} />
            </View>

            <ScrollView 
              style={styles.modalBody} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalBodyContent}
            >
              {selectedActivity.bannerImageUrl ? (
                <Image
                  source={{ uri: selectedActivity.bannerImageUrl }}
                  style={styles.modalBanner}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.modalBanner, styles.placeholderBanner]}>
                  <Ionicons name="images" size={48} color="#ccc" />
                </View>
              )}

              <View style={styles.modalInfo}>
                <View style={styles.modalInfoHeader}>
                  <Text style={styles.modalActivityName}>{selectedActivity.name}</Text>
                  <View style={styles.modalPoints}>
                    <Ionicons name="star" size={16} color="#FF9500" />
                    <Text style={styles.modalPointsText}>{selectedActivity.points || 0} điểm</Text>
                  </View>
                </View>

                <View style={styles.modalStatusContainer}>
                  <View style={[
                    styles.modalStatusBadge,
                    { backgroundColor: '#34C759' }
                  ]}>
                    <Text style={styles.modalStatusText}>Đang diễn ra</Text>
                  </View>
                  <Text style={styles.modalActivityType}>{selectedActivity.activityType}</Text>
                </View>
                
                <View style={styles.modalDescription}>
                  <Text style={styles.modalDescriptionText}>{selectedActivity.notes || 'Chưa có mô tả'}</Text>
                </View>

                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailItem}>
                    <Ionicons name="location" size={20} color="#007AFF" />
                    <Text style={styles.modalDetailText}>
                      <Text style={styles.modalDetailLabel}>Địa điểm: </Text>
                      {selectedActivity.location || 'Chưa cập nhật'}
                    </Text>
                  </View>

                  <View style={styles.modalDetailItem}>
                    <Ionicons name="calendar" size={20} color="#007AFF" />
                    <Text style={styles.modalDetailText}>
                      <Text style={styles.modalDetailLabel}>Bắt đầu: </Text>
                      {format(selectedActivity.startDate.toDate(), "dd/MM/yyyy HH:mm", { locale: vi })} - {format(selectedActivity.endDate.toDate(), "dd/MM/yyyy HH:mm", { locale: vi })}
                    </Text>
                  </View>

                  <View style={styles.modalDetailItem}>
                    <Ionicons name="calendar" size={20} color="#007AFF" />
                    <Text style={styles.modalDetailText}>
                      <Text style={styles.modalDetailLabel}>Kết thúc: </Text>
                      {format(selectedActivity.endDate.toDate(), "dd/MM/yyyy HH:mm", { locale: vi })}
                    </Text>
                  </View>

                  {selectedActivity.organizer && (
                    <View style={styles.modalDetailItem}>
                      <Ionicons name="people" size={20} color="#007AFF" />
                      <Text style={styles.modalDetailText}>
                        <Text style={styles.modalDetailLabel}>Đơn vị tổ chức: </Text>
                        {selectedActivity.organizer}
                      </Text>
                    </View>
                  )}
                </View>

                {selectedActivity.requirements && (
                  <View style={styles.modalRequirements}>
                    <Text style={styles.modalSectionTitle}>Yêu cầu tham gia</Text>
                    <Text style={styles.modalRequirementsText}>{selectedActivity.requirements}</Text>
                  </View>
                )}

                <View style={styles.modalParticipants}>
                  <Text style={styles.modalSectionTitle}>Thông tin tham gia</Text>
                  <Text style={styles.modalParticipantsCount}>
                    {formatParticipantCount(selectedActivity.participants, selectedActivity.maxParticipants)}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              {renderRegistrationButton(selectedActivity)}
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  if (initializing || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF3B30" />
          <Text style={styles.emptyText}>Vui lòng đăng nhập để xem hoạt động</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.loginButtonText}>Đăng nhập</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hoạt động đang diễn ra</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {activities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Không có hoạt động nào đang diễn ra</Text>
          </View>
        ) : (
          activities.map((activity) => (
            <TouchableOpacity
              key={activity.id}
              style={styles.activityCard}
              onPress={() => handleActivityPress(activity)}
            >
              {activity.bannerImageUrl && (
                <Image
                  source={{ uri: activity.bannerImageUrl }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
              )}
              
              <View style={styles.activityContent}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityType}>{activity.activityType}</Text>
                  <Text style={styles.points}>{activity.points} điểm</Text>
                </View>

                <Text style={styles.activityName}>{activity.name}</Text>
                <Text style={styles.activityDescription} numberOfLines={2}>
                  {activity.notes}
                </Text>

                <View style={styles.activityInfo}>
                  <View style={styles.infoRow}>
                    <Ionicons name="location" size={16} color="#666" />
                    <Text style={styles.infoText}>{activity.location}</Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar" size={16} color="#666" />
                    <Text style={styles.infoText}>
                      {format(activity.startDate.toDate(), 'dd/MM/yyyy', { locale: vi })} - {format(activity.endDate.toDate(), 'dd/MM/yyyy', { locale: vi })}
                    </Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Ionicons name="time" size={16} color="#666" />
                    <Text style={styles.infoText}>
                    {format(activity.startDate.toDate(), "dd/MM/yyyy HH:mm", { locale: vi })} - {format(activity.endDate.toDate(), "dd/MM/yyyy HH:mm", { locale: vi })}
                    </Text>
                  </View>
                </View>

                {renderRegistrationButton(activity)}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      {renderActivityModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E9F0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2138',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerImage: {
    width: '100%',
    height: 160,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  activityContent: {
    padding: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityType: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  points: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
  },
  activityName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2138',
    marginBottom: 8,
  },
  activityDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  activityInfo: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  attendanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  attendanceButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    flex: 1,
  },
  approvedBadge: {
    backgroundColor: '#007AFF',
  },
  pendingBadge: {
    backgroundColor: '#FF9500',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  loginButton: {
    marginTop: 16,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E9F0',
    backgroundColor: '#FFFFFF',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2138',
    flex: 1,
    textAlign: 'center',
  },
  modalBody: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalBodyContent: {
    paddingBottom: 20,
  },
  modalBanner: {
    width: '100%',
    height: 200,
  },
  placeholderBanner: {
    backgroundColor: '#F0F0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalInfo: {
    padding: 16,
  },
  modalInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  modalActivityName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A2138',
    flex: 1,
    marginRight: 16,
  },
  modalPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  modalPointsText: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
    marginLeft: 4,
  },
  modalStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  modalStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  modalActivityType: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  modalDescription: {
    marginBottom: 16,
  },
  modalDescriptionText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  modalDetails: {
    backgroundColor: '#F8F9FC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  modalDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalDetailText: {
    fontSize: 16,
    color: '#1A2138',
    marginLeft: 12,
    flex: 1,
  },
  modalDetailLabel: {
    fontWeight: '500',
    color: '#666',
  },
  modalRequirements: {
    backgroundColor: '#F8F9FC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  modalRequirementsText: {
    fontSize: 14,
    color: '#1A2138',
    lineHeight: 20,
  },
  modalParticipants: {
    backgroundColor: '#F8F9FC',
    borderRadius: 12,
    padding: 16,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2138',
    marginBottom: 8,
  },
  modalParticipantsCount: {
    fontSize: 15,
    color: '#666',
    marginTop: 4,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E9F0',
    backgroundColor: '#FFFFFF',
  },
});

export default HDDangDienRa;
