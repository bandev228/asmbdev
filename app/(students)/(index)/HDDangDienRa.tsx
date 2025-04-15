import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, SafeAreaView, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useRouter } from 'expo-router';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

interface Activity {
  id: string;
  name: string;
  location: string;
  startDate: FirebaseFirestoreTypes.Timestamp;
  endDate: FirebaseFirestoreTypes.Timestamp;
  participants?: string[];
  pendingParticipants?: string[];
  [key: string]: any;
}

const HoatDongDangDienRa = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const currentUser = auth().currentUser;
    if (currentUser) {
      setUserId(currentUser.uid);
    }
    fetchOngoingActivities();
  }, []);

  const fetchOngoingActivities = async () => {
    setLoading(true);
    try {
      const now = firestore.Timestamp.now();
      const snapshot = await firestore()
        .collection('activities')
        .where('startDate', '<=', now)
        .where('endDate', '>=', now)
        .get();
      const activitiesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Activity));
      setActivities(activitiesList);
    } catch (error) {
      console.error('Error fetching ongoing activities:', error);
      Alert.alert('Error', 'Failed to fetch ongoing activities');
    } finally {
      setLoading(false);
    }
  };

  const registerForActivity = async (activityId: string) => {
    if (!userId) {
      Alert.alert('Lỗi', 'Người dùng chưa đăng nhập');
      return;
    }

    try {
      const activityRef = firestore().collection('activities').doc(activityId);
      const activityDoc = await activityRef.get();
      const activityData = activityDoc.data() as Activity | undefined;

      if (!activityData) {
        Alert.alert('Lỗi', 'Không tìm thấy thông tin hoạt động');
        return;
      }

      if (activityData.participants?.includes(userId)) {
        Alert.alert('Đã đăng ký', 'Bạn đã đăng ký tham gia hoạt động này');
        return;
      }

      if (activityData.pendingParticipants?.includes(userId)) {
        Alert.alert('Đang chờ duyệt', 'Bạn đã đăng ký và đang chờ phê duyệt cho hoạt động này');
        return;
      }

      await activityRef.update({
        pendingParticipants: firestore.FieldValue.arrayUnion(userId)
      });
      Alert.alert('Thành công', 'Đăng ký thành công! Vui lòng chờ phê duyệt.');
      fetchOngoingActivities();
    } catch (error) {
      console.error('Lỗi khi đăng ký hoạt động:', error);
      Alert.alert('Lỗi', 'Không thể đăng ký hoạt động');
    }
  };

  const handleAttendance = (activityId: string) => {
    router.push({
      pathname: './DiemDanhHD',
      params: { activityId }
    });
  };

  const renderActivityItem = ({ item }: { item: Activity }) => (
    <View style={styles.activityItem}>
      <View style={styles.activityContent}>
        <Text style={styles.activityName}>{item.name}</Text>
        <View style={styles.infoContainer}>
          <Ionicons name="location-outline" size={16} color="#666666" />
          <Text style={styles.activityInfo}>{item.location}</Text>
        </View>
        <View style={styles.infoContainer}>
          <Ionicons name="calendar-outline" size={16} color="#666666" />
          <Text style={styles.activityInfo}>
            {item.startDate.toDate().toLocaleDateString()} - {item.endDate.toDate().toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.infoContainer}>
          <Ionicons name="people-outline" size={16} color="#666666" />
          <Text style={styles.activityInfo}>
            {(item.participants && item.participants.length) || 0} người tham gia
          </Text>
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => registerForActivity(item.id)}
        >
          <Text style={styles.buttonText}>Đăng ký</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.attendanceButton}
          onPress={() => handleAttendance(item.id)}
        >
          <Text style={styles.buttonText}>Điểm danh</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Hoạt động đang diễn ra</Text>
        <TouchableOpacity onPress={fetchOngoingActivities} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : activities.length > 0 ? (
        <FlatList
          data={activities}
          renderItem={renderActivityItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={screenWidth * 0.15} color="#CCC" />
          <Text style={styles.emptyText}>Không có hoạt động nào đang diễn ra</Text>
        </View>
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
  refreshButton: {
    padding: screenWidth * 0.02,
  },
  title: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: screenWidth * 0.04,
  },
  activityItem: {
    backgroundColor: '#FFFFFF',
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.02,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: screenHeight * 0.01,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: screenHeight * 0.005,
  },
  activityInfo: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
    marginLeft: screenWidth * 0.02,
  },
  buttonContainer: {
    marginLeft: screenWidth * 0.04,
  },
  registerButton: {
    backgroundColor: '#4CAF50',
    padding: screenWidth * 0.03,
    borderRadius: 8,
    marginBottom: screenHeight * 0.01,
    minWidth: screenWidth * 0.2,
  },
  attendanceButton: {
    backgroundColor: '#FFA000',
    padding: screenWidth * 0.03,
    borderRadius: 8,
    minWidth: screenWidth * 0.2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: screenWidth * 0.035,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: screenWidth * 0.04,
  },
  emptyText: {
    fontSize: screenWidth * 0.04,
    color: '#666666',
    marginTop: screenHeight * 0.02,
    textAlign: 'center',
  },
});

export default HoatDongDangDienRa;
