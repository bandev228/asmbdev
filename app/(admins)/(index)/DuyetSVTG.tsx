import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Dimensions } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Activity {
  id: string;
  name: string;
  pendingCount: number;
  pendingParticipants?: string[];
}

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const DuyetSVTGHD = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const activitiesSnapshot = await firestore().collection('activities').get();
      const activitiesList = await Promise.all(activitiesSnapshot.docs.map(async doc => {
        const data = doc.data();
        const pendingParticipants = data.pendingParticipants || [];
        const pendingCount = pendingParticipants.length;

        return {
          id: doc.id,
          name: data.name,
          pendingCount: pendingCount,
          pendingParticipants
        };
      }));

      setActivities(activitiesList.filter(activity => activity.pendingCount > 0));
    } catch (error) {
      console.error('Error fetching activities:', error);
      alert('Không thể lấy danh sách hoạt động. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const renderActivityItem = ({ item }: { item: Activity }) => (
    <TouchableOpacity
      style={styles.activityItem}
      onPress={() => router.push({
        pathname: './DuyetSV',
        params: { activityId: item.id, activityName: item.name }
      })}
    >
      <Text style={styles.activityName}>{item.name}</Text>
      <Text style={styles.pendingCount}>Sinh viên chờ duyệt: {item.pendingCount}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Danh sách sinh viên chờ duyệt</Text>
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
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <Text style={styles.noActivitiesText}>Không có hoạt động nào có sinh viên chờ duyệt.</Text>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityName: {
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    marginBottom: screenHeight * 0.01,
    color: '#333333',
  },
  pendingCount: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
  },
  noActivitiesText: {
    fontSize: screenWidth * 0.04,
    textAlign: 'center',
    padding: screenWidth * 0.04,
    color: '#666666',
  },
});

export default DuyetSVTGHD;
