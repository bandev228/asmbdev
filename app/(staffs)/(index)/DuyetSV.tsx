import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, ViewStyle, TextStyle, Image, ImageStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from '@react-native-firebase/firestore';
import { getStorage, ref as storageRef, getDownloadURL } from '@react-native-firebase/storage';
import { useRouter } from 'expo-router';
import { Timestamp } from '@react-native-firebase/firestore';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { getDatabase, ref, orderByChild, equalTo, get } from '@react-native-firebase/database';

interface StudentInfo {
  displayName: string;
  photoURL?: string;
}

interface Activity {
  id: string;
  name: string;
  notes?: string;
  location?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  activityType?: string;
  points?: number;
  pendingParticipants: string[];
  maxParticipants?: number;
  participants?: string[];
}

interface UserData {
  displayName: string;
  photoURL?: string;
}

interface Styles {
  container: ViewStyle;
  header: ViewStyle;
  backButton: ViewStyle;
  title: TextStyle;
  refreshButton: ViewStyle;
  listContainer: ViewStyle;
  activityItem: ViewStyle;
  activityHeader: ViewStyle;
  activityTypeContainer: ViewStyle;
  activityType: TextStyle;
  pointsContainer: ViewStyle;
  pointsText: TextStyle;
  activityName: TextStyle;
  activityDetails: ViewStyle;
  detailRow: ViewStyle;
  detailText: TextStyle;
  studentItem: ViewStyle;
  studentProfile: ViewStyle;
  studentAvatar: ImageStyle;
  avatarPlaceholder: ViewStyle;
  studentInfo: ViewStyle;
  studentName: TextStyle;
  studentId: TextStyle;
  studentClass: TextStyle;
  actionButtons: ViewStyle;
  actionButton: ViewStyle;
  approveButton: ViewStyle;
  rejectButton: ViewStyle;
  loader: ViewStyle;
  emptyState: ViewStyle;
  emptyStateText: TextStyle;
  separator: ViewStyle;
  buttonText: TextStyle;
}

const DuyetSinhVien = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentsInfo, setStudentsInfo] = useState<{[key: string]: StudentInfo}>({});
  const router = useRouter();
  const db = getFirestore();
  const database = getDatabase();

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchStudentInfo = async (studentId: string) => {
    try {
      const userDocRef = doc(db, 'users', studentId);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.data() as UserData | undefined;
      
      if (userData?.displayName) {
        let photoURL = userData.photoURL;

        // Nếu không có photoURL trực tiếp, thử lấy từ storage
        if (!photoURL) {
          try {
            const storage = getStorage();
            const avatarRef = storageRef(storage, `avatars/${studentId}`);
            photoURL = await getDownloadURL(avatarRef);
            console.log('Found avatar in storage:', studentId);
          } catch (error) {
            console.log('No avatar in storage for:', studentId);
          }
        }

        console.log('Found user:', {
          id: studentId,
          name: userData.displayName,
          hasPhoto: !!photoURL
        });
        
        setStudentsInfo(prev => ({
          ...prev,
          [studentId]: { 
            displayName: userData.displayName,
            photoURL: photoURL
          }
        }));
      } else {
        console.log('No display name found for user:', studentId);
      }
    } catch (error) {
      console.error('Error fetching user info:', studentId, error);
    }
  };

  const fetchActivities = async () => {
    setLoading(true);
    try {
      // 1. Lấy tất cả hoạt động
      const activitiesRef = collection(db, 'activities');
      const activitiesSnapshot = await getDocs(activitiesRef);
      
      const activitiesList: Activity[] = [];
      
      // 2. Lọc và xử lý từng hoạt động
      for (const doc of activitiesSnapshot.docs) {
        const data = doc.data();
        // Chỉ xử lý hoạt động có pendingParticipants
        if (data.pendingParticipants && Array.isArray(data.pendingParticipants) && data.pendingParticipants.length > 0) {
          console.log('Found activity with pending participants:', {
            id: doc.id,
            name: data.name,
            pendingCount: data.pendingParticipants.length,
            participants: data.pendingParticipants
          });
          
          activitiesList.push({
            id: doc.id,
            name: data.name || '',
            activityType: data.activityType || '',
            points: data.points || 0,
            pendingParticipants: data.pendingParticipants,
            participants: data.participants || [],
            startDate: data.startDate,
            endDate: data.endDate,
            location: data.location,
            notes: data.notes
          });

          // 3. Lấy thông tin của từng sinh viên
          for (const studentId of data.pendingParticipants) {
            await fetchStudentInfo(studentId);
          }
        }
      }

      console.log('Total activities with pending students:', activitiesList.length);
      setActivities(activitiesList);

    } catch (error) {
      console.error('Error fetching activities:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách hoạt động. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (activityId: string, userId: string) => {
    try {
      const activityRef = doc(db, 'activities', activityId);
      
      const activityDoc = await getDoc(activityRef);
      if (!activityDoc.exists) {
        throw new Error('Hoạt động không tồn tại');
      }

      const activityData = activityDoc.data();
      if (!activityData) {
        throw new Error('Dữ liệu hoạt động không tồn tại');
      }

      const updatedPendingParticipants = (activityData.pendingParticipants || []).filter(
        (id: string) => id !== userId
      );
      const updatedParticipants = [...(activityData.participants || []), userId];

      await updateDoc(activityRef, {
        pendingParticipants: updatedPendingParticipants,
        participants: updatedParticipants,
      });

      await fetchActivities();
      Alert.alert('Thành công', 'Đã phê duyệt sinh viên tham gia hoạt động.');
    } catch (error) {
      console.error('Error approving student:', error);
      Alert.alert('Lỗi', 'Không thể phê duyệt sinh viên. Vui lòng thử lại.');
    }
  };

  const handleReject = async (activityId: string, userId: string) => {
    try {
      const activityRef = doc(db, 'activities', activityId);
      
      const activityDoc = await getDoc(activityRef);
      if (!activityDoc.exists) {
        throw new Error('Hoạt động không tồn tại');
      }

      const activityData = activityDoc.data();
      if (!activityData) {
        throw new Error('Dữ liệu hoạt động không tồn tại');
      }

      const updatedPendingParticipants = (activityData.pendingParticipants || []).filter(
        (id: string) => id !== userId
      );

      await updateDoc(activityRef, {
        pendingParticipants: updatedPendingParticipants,
      });

      await fetchActivities();
      Alert.alert('Thành công', 'Đã từ chối sinh viên tham gia hoạt động.');
    } catch (error) {
      console.error('Error rejecting student:', error);
      Alert.alert('Lỗi', 'Không thể từ chối sinh viên. Vui lòng thử lại.');
    }
  };

  const renderActivityItem = ({ item }: { item: Activity }) => {
    return (
      <View style={styles.activityItem}>
        <View style={styles.activityHeader}>
          <View style={styles.activityTypeContainer}>
            <Text style={styles.activityType}>
              {item.activityType === 'softskill' ? 'Kỹ năng mềm' : item.activityType || 'Hoạt động'}
            </Text>
            {(item.points ?? 0) > 0 && (
              <View style={styles.pointsContainer}>
                <Text style={styles.pointsText}>{item.points} điểm</Text>
              </View>
            )}
          </View>
          <Text style={styles.activityName}>{item.name}</Text>
        </View>

        <View style={styles.activityDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="people" size={16} color="#666" />
            <Text style={styles.detailText}>
              Chờ duyệt: {item.pendingParticipants.length}
            </Text>
          </View>
        </View>

        <FlatList
          data={item.pendingParticipants}
          keyExtractor={(studentId) => studentId}
          renderItem={({ item: studentId }) => {
            const studentInfo = studentsInfo[studentId];

            return (
              <View style={styles.studentItem}>
                <View style={styles.studentProfile}>
                  {studentInfo?.photoURL ? (
                    <Image
                      source={{ uri: studentInfo.photoURL }}
                      style={styles.studentAvatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={24} color="#CCC" />
                    </View>
                  )}
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>
                      {studentInfo ? studentInfo.displayName : 'Đang tải...'}
                    </Text>
                  </View>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleApprove(item.id, studentId)}
                  >
                    <Text style={styles.buttonText}>Duyệt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleReject(item.id, studentId)}
                  >
                    <Text style={styles.buttonText}>Từ chối</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Duyệt sinh viên tham gia</Text>
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
          <Ionicons name="people-outline" size={64} color="#CCC" />
          <Text style={styles.emptyStateText}>Không có sinh viên nào chờ duyệt.</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create<Styles>({
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
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  activityHeader: {
    marginBottom: 8,
  },
  activityTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activityType: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  pointsContainer: {
    backgroundColor: '#FFF4E5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pointsText: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '500',
  },
  activityName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333333',
  },
  activityDetails: {
    backgroundColor: '#F8F9FC',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  studentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  studentProfile: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  } as ImageStyle,
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#F0F0F5',
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2138',
    marginBottom: 4,
  },
  studentId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  studentClass: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
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
  separator: {
    height: 1,
    backgroundColor: '#E5E9F0',
    marginVertical: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default DuyetSinhVien;
