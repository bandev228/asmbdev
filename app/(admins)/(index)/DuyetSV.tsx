import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { getFirestore, doc, getDoc, updateDoc, collection, addDoc, Timestamp } from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

interface Student {
  id: string;
  fullname: string;
  email: string;
  fcmToken?: string;
}

type RouteParams = {
  activityId: string;
  activityName: string;
}

interface ActivityData {
  pendingParticipants?: string[];
  participants?: string[];
  name: string;
}

interface NotificationData {
  userId: string;
  title: string;
  message: string;
  activityId: string;
  createdAt: Timestamp;
  read: boolean;
}

const ApproveStudentsForActivityScreen = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<RouteParams>();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { activityId, activityName } = params;

  useEffect(() => {
    if (!activityId) {
      Alert.alert('Lỗi', 'Không tìm thấy ID hoạt động');
      router.back();
      return;
    }
    fetchPendingStudents();
  }, [activityId]);

  const fetchPendingStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getFirestore();
      const activityDoc = await getDoc(doc(db, 'activities', activityId));
      const activityData = activityDoc.data() as ActivityData | undefined;
      
      if (!activityData) {
        throw new Error('Không tìm thấy thông tin hoạt động');
      }

      const pendingStudents = activityData.pendingParticipants || [];
      
      const studentsData = await Promise.all(
        pendingStudents.map(async (studentId: string) => {
          try {
            const studentDoc = await getDoc(doc(db, 'users', studentId));
            const data = studentDoc.data();
            return {
              id: studentId,
              fullname: data?.fullname || 'Không có tên',
              email: data?.email || 'Không có email',
              fcmToken: data?.fcmToken
            } as Student;
          } catch (err) {
            console.error('Error fetching student data:', err);
            return {
              id: studentId,
              fullname: 'Không có tên',
              email: 'Không có email',
              fcmToken: undefined
            } as Student;
          }
        })
      );
      
      setStudents(studentsData);
    } catch (error) {
      console.error('Error fetching students:', error);
      setError('Không thể lấy danh sách sinh viên. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const sendPushNotification = async (token: string, title: string, body: string) => {
    try {
      // Implement your push notification logic here
      console.log('Sending push notification:', { token, title, body });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  };

  const approveStudent = async (studentId: string) => {
    try {
      const db = getFirestore();
      const activityRef = doc(db, 'activities', activityId);
      const activityDoc = await getDoc(activityRef);
      
      if (!activityDoc.exists) {
        throw new Error('Không tìm thấy hoạt động');
      }

      const currentData = activityDoc.data();
      if (!currentData) {
        throw new Error('Dữ liệu hoạt động trống');
      }

      const pendingParticipants = currentData.pendingParticipants || [];
      const participants = currentData.participants || [];
      
      if (!pendingParticipants.includes(studentId)) {
        throw new Error('Sinh viên không có trong danh sách chờ duyệt');
      }

      const updatedPendingParticipants = pendingParticipants.filter((id: string) => id !== studentId);
      const updatedParticipants = [...participants, studentId];
      
      await updateDoc(activityRef, {
        pendingParticipants: updatedPendingParticipants,
        participants: updatedParticipants
      });

      // Get student data
      const studentRef = doc(db, 'users', studentId);
      const studentDoc = await getDoc(studentRef);
      
      if (!studentDoc.exists) {
        throw new Error('Không tìm thấy thông tin sinh viên');
      }

      const studentData = studentDoc.data() as Student | undefined;
      
      if (studentData?.fcmToken) {
        try {
          await sendPushNotification(
            studentData.fcmToken,
            'Đăng ký hoạt động được duyệt',
            `Bạn đã được duyệt tham gia hoạt động "${activityName}"`
          );
        } catch (error) {
          console.error('Error sending notification:', error);
          // Continue with the rest of the process even if notification fails
        }
      }

      // Create notification
      const notificationData: NotificationData = {
        userId: studentId,
        title: 'Đăng ký hoạt động được duyệt',
        message: `Bạn đã được duyệt tham gia hoạt động "${activityName}"`,
        activityId: activityId,
        createdAt: Timestamp.now(),
        read: false
      };

      try {
        await addDoc(collection(db, 'notifications'), notificationData);
      } catch (error) {
        console.error('Error creating notification:', error);
        // Continue with the rest of the process even if notification creation fails
      }

      // Update UI state
      setStudents(prev => prev.filter(student => student.id !== studentId));

    } catch (error) {
      console.error('Error approving student:', error);
      Alert.alert(
        'Lỗi',
        error instanceof Error ? error.message : 'Không thể duyệt sinh viên. Vui lòng thử lại sau.'
      );
    }
  };

  const renderStudentItem = ({ item }: { item: Student }) => (
    <View style={[styles.studentItem, { backgroundColor: theme.colors.card }]}>
      <View style={styles.studentInfo}>
        <Text style={[styles.studentName, { color: theme.colors.text }]} numberOfLines={2} ellipsizeMode="tail">
          {item.fullname}
        </Text>
        <Text style={[styles.studentEmail, { color: theme.colors.secondary }]} numberOfLines={1} ellipsizeMode="tail">
          {item.email}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.approveButton, { backgroundColor: theme.colors.primary }]}
        onPress={() => approveStudent(item.id)}
      >
        <Text style={styles.approveButtonText}>Phê duyệt</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>{activityName}</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={fetchPendingStudents}
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : students.length > 0 ? (
        <FlatList
          data={students}
          renderItem={renderStudentItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <Text style={[styles.noStudentsText, { color: theme.colors.secondary }]}>
          Không có sinh viên nào chờ duyệt cho hoạt động này.
        </Text>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  studentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  studentInfo: {
    flex: 1,
    marginRight: 16,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 14,
  },
  approveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  noStudentsText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ApproveStudentsForActivityScreen;
