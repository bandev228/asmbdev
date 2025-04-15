import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Activity {
  id: string;
  name: string;
  location: string;
  startDate: FirebaseFirestoreTypes.Timestamp;
  participants?: string[];
  pendingParticipants?: string[];
  status: 'Đã duyệt' | 'Chờ duyệt' | 'Không xác định';
}

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const HoatDongThamGia = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchParticipatedActivities();
  }, []);

  const fetchParticipatedActivities = async () => {
    setLoading(true);
    const user = auth().currentUser;
    if (user) {
      try {
        const activitiesSnapshot = await firestore().collection('activities').get();
        const participatedActivities = activitiesSnapshot.docs
          .filter(doc => {
            const data = doc.data();
            return (data.participants && data.participants.includes(user.uid)) ||
                   (data.pendingParticipants && data.pendingParticipants.includes(user.uid));
          })
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              status: data.participants && data.participants.includes(user.uid) 
                ? 'Đã duyệt' 
                : data.pendingParticipants && data.pendingParticipants.includes(user.uid)
                  ? 'Chờ duyệt'
                  : 'Không xác định'
            } as Activity;
          });
        setActivities(participatedActivities);
      } catch (error) {
        console.error('Error fetching participated activities:', error);
        alert('Không thể lấy danh sách hoạt động tham gia. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    }
  };

  const renderActivityItem = ({ item }: { item: Activity }) => (
    <View style={styles.activityItem}>
      <View style={styles.activityContent}>
        <Text style={styles.activityName}>{item.name}</Text>
        <Text style={styles.activityLocation}>
          <Ionicons name="location-outline" size={16} color="#666666" /> {item.location}
        </Text>
        <Text style={styles.activityDate}>
          <Ionicons name="calendar-outline" size={16} color="#666666" /> {item.startDate?.toDate().toLocaleDateString()}
        </Text>
      </View>
      <Text style={[
        styles.activityStatus, 
        { color: item.status === 'Đã duyệt' ? '#4CAF50' : '#FFA500' }
      ]}>
        {item.status}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Hoạt động đã đăng ký</Text>
        <TouchableOpacity onPress={fetchParticipatedActivities} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivityItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={screenWidth * 0.15} color="#CCC" />
              <Text style={styles.emptyText}>Bạn chưa đăng ký hoạt động nào</Text>
            </View>
          }
        />
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
    justifyContent: 'space-between',
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
  activityLocation: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
    marginBottom: screenHeight * 0.005,
  },
  activityDate: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
  },
  activityStatus: {
    fontSize: screenWidth * 0.035,
    fontWeight: 'bold',
    marginLeft: screenWidth * 0.02,
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

export default HoatDongThamGia;
