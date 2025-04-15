import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

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
  createdAt: FirebaseFirestoreTypes.FieldValue;
  read: boolean;
}

interface FirestoreError extends Error {
  code?: string;
}

interface ActivityUpdateData {
  pendingParticipants: FirebaseFirestoreTypes.FieldValue;
  participants: FirebaseFirestoreTypes.FieldValue;
}

const ApproveStudentsForActivityScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<RouteParams>();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

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
    try {
      const activityDoc = await firestore().collection('activities').doc(activityId).get();
      const activityData = activityDoc.data() as ActivityData | undefined;
      
      if (!activityData) {
        throw new Error('Không tìm thấy thông tin hoạt động');
      }

      const pendingStudents = activityData.pendingParticipants || [];
      
      const studentsData = await Promise.all(
        pendingStudents.map(async (studentId: string) => {
          const studentDoc = await firestore().collection('users').doc(studentId).get();
          const data = studentDoc.data();
          return {
            id: studentId,
            fullname: data?.fullname || 'Không có tên',
            email: data?.email || 'Không có email',
            fcmToken: data?.fcmToken
          } as Student;
        })
      );
      
      setStudents(studentsData);
    } catch (error) {
      console.error('Error fetching students:', error);
      Alert.alert('Lỗi', 'Không thể lấy danh sách sinh viên. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const sendPushNotification = async (token: string, title: string, body: string) => {
    try {
      // Implement your push notification logic here
      // This is a placeholder for the actual implementation
      console.log('Sending push notification:', { token, title, body });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  };

  const approveStudent = async (studentId: string) => {
    try {
      const activityRef = firestore().collection('activities').doc(activityId);
      
      const updateData: ActivityUpdateData = {
        pendingParticipants: firestore.FieldValue.arrayRemove(studentId),
        participants: firestore.FieldValue.arrayUnion(studentId)
      };
      
      await activityRef.update(updateData);

      const studentDoc = await firestore().collection('users').doc(studentId).get();
      const studentData = studentDoc.data() as Student | undefined;
      
      if (studentData?.fcmToken) {
        await sendPushNotification(
          studentData.fcmToken,
          'Đăng ký hoạt động được duyệt',
          `Bạn đã được duyệt tham gia hoạt động "${activityName}"`
        );
      }

      const notificationData: NotificationData = {
        userId: studentId,
        title: 'Đăng ký hoạt động được duyệt',
        message: `Bạn đã được duyệt tham gia hoạt động "${activityName}"`,
        activityId: activityId,
        createdAt: firestore.FieldValue.serverTimestamp(),
        read: false
      };

      await firestore().collection('notifications').add(notificationData);

      Alert.alert('Thành công', 'Sinh viên đã được phê duyệt');
      fetchPendingStudents();
    } catch (error) {
      const firestoreError = error as FirestoreError;
      console.error('Error approving student:', firestoreError);
      Alert.alert('Lỗi', `Không thể phê duyệt sinh viên. ${firestoreError.message}`);
    }
  };

  const renderStudentItem = ({ item }: { item: Student }) => (
    <View style={styles.studentItem}>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName} numberOfLines={2} ellipsizeMode="tail">{item.fullname}</Text>
        <Text style={styles.studentEmail} numberOfLines={1} ellipsizeMode="tail">{item.email}</Text>
      </View>
      <TouchableOpacity
        style={styles.approveButton}
        onPress={() => approveStudent(item.id)}
      >
        <Text style={styles.approveButtonText}>Phê duyệt</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>{activityName}</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : students.length > 0 ? (
        <FlatList
          data={students}
          renderItem={renderStudentItem}
          keyExtractor={(item) => item.id}
        />
      ) : (
        <Text style={styles.noStudentsText}>Không có sinh viên nào chờ duyệt cho hoạt động này.</Text>
      )}
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
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  studentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  studentInfo: {
    flex: 1,
    marginRight: 16,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 14,
    color: '#666',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    minWidth: 100,
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  noStudentsText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 16,
    color: '#666',
  },
});

export default ApproveStudentsForActivityScreen;
