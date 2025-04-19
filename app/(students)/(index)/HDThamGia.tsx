import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator, Dimensions, Image } from 'react-native';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, arrayRemove, increment, Timestamp } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Activity {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: string;
  participantLimit: number;
  participants: number;
  status: 'pending' | 'approved' | 'rejected';
  imageUrl?: string;
  category?: string;
  organizer?: string;
  hasAttended?: boolean;
}

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const HoatDongThamGia = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const auth = getAuth();
  const db = getFirestore();

  const checkAttendanceStatus = async (activityId: string, userId: string): Promise<boolean> => {
    try {
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('activityId', '==', activityId),
        where('userId', '==', userId),
        where('status', '==', 'verified')
      );
      
      const querySnapshot = await getDocs(attendanceQuery);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking attendance status:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const activitiesQuery = query(
        collection(db, "activities"),
        where("participants", "array-contains", userId)
      );

      const snapshot = await getDocs(activitiesQuery);
      const activitiesData = await Promise.all(snapshot.docs.map(async doc => {
        const data = doc.data();
        const hasAttended = await checkAttendanceStatus(doc.id, userId);
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate?.toDate(),
          endDate: data.endDate?.toDate(),
          participants: Array.isArray(data.participants) ? data.participants.length : 0,
          hasAttended
        }
      })) as Activity[];

      setActivities(activitiesData);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching activities:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setLoading(false);
    }
  };

  const handleLeaveActivity = async (activityId: string) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      await updateDoc(doc(db, "activities", activityId), {
        participants: arrayRemove(userId),
        currentParticipants: increment(-1)
      });

      // Refresh activities list
      fetchActivities();
    } catch (err) {
      console.error("Error leaving activity:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    }
  };

  const renderActivityItem = ({ item }: { item: Activity }) => (
    <TouchableOpacity
      style={styles.activityItem}
      onPress={() => router.push({
        pathname: './ChiTietHD',
        params: { id: item.id }
      })}
    >
      {item.imageUrl && (
        <Image 
          source={{ uri: item.imageUrl }} 
          style={styles.activityImage}
          resizeMode="cover"
        />
      )}
      <View style={styles.activityContent}>
        <View style={styles.titleContainer}>
          <Text style={styles.activityTitle} numberOfLines={2}>{item.name}</Text>
          <View style={styles.participantCount}>
            <Ionicons name="people" size={16} color="#007AFF" />
            <Text style={styles.participantCountText}>
              {item.participants}/{item.participantLimit}
            </Text>
          </View>
        </View>
        <View style={styles.participantInfo}>
          <Text style={styles.participantInfoText}>
            Số người đã được duyệt: {item.participants} người
          </Text>
          <Text style={styles.participantInfoText}>
            Số người tối đa: {item.participantLimit} người
          </Text>
        </View>
        <Text style={styles.activityDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.activityInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.infoText}>
              {format(item.startDate, "dd/MM/yyyy HH:mm", { locale: vi })} - {format(item.endDate, "dd/MM/yyyy HH:mm", { locale: vi })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{item.location}</Text>
          </View>
        </View>
        <View style={styles.activityFooter}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: item.hasAttended ? '#4CAF50' : '#FFC107' }
          ]}>
            <Text style={styles.statusText}>
              {item.hasAttended ? 'Đã điểm danh' : 'Chưa điểm danh'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.leaveButton}
            onPress={() => handleLeaveActivity(item.id)}
          >
            <Text style={styles.leaveButtonText}>Rời khỏi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Hoạt động đã đăng ký</Text>
        <TouchableOpacity onPress={fetchActivities} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={activities}
        renderItem={renderActivityItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color="#999" />
            <Text style={styles.emptyText}>Bạn chưa tham gia hoạt động nào</Text>
          </View>
        }
      />
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
  listContainer: {
    padding: screenWidth * 0.04,
  },
  activityItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: screenHeight * 0.02,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activityImage: {
    width: '100%',
    height: screenHeight * 0.2,
  },
  activityContent: {
    padding: screenWidth * 0.04,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: screenHeight * 0.01,
  },
  activityTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    marginRight: screenWidth * 0.02,
  },
  participantCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: screenWidth * 0.02,
    paddingVertical: screenWidth * 0.01,
    borderRadius: 12,
  },
  participantCountText: {
    fontSize: screenWidth * 0.035,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: screenWidth * 0.01,
  },
  activityDescription: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
    marginBottom: screenHeight * 0.02,
  },
  activityInfo: {
    marginBottom: screenHeight * 0.02,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: screenHeight * 0.01,
  },
  infoText: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
    marginLeft: screenWidth * 0.02,
  },
  activityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: screenWidth * 0.03,
    paddingVertical: screenWidth * 0.015,
    borderRadius: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: screenWidth * 0.03,
    fontWeight: '500',
  },
  leaveButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenWidth * 0.02,
    borderRadius: 20,
  },
  leaveButtonText: {
    color: '#FFFFFF',
    fontSize: screenWidth * 0.035,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: screenWidth * 0.1,
  },
  emptyText: {
    fontSize: screenWidth * 0.04,
    color: '#999999',
    marginTop: screenHeight * 0.02,
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: screenHeight * 0.02,
  },
  participantInfo: {
    backgroundColor: '#F5F5F5',
    padding: screenWidth * 0.03,
    borderRadius: 8,
    marginBottom: screenHeight * 0.02,
  },
  participantInfoText: {
    fontSize: screenWidth * 0.035,
    color: '#333',
    marginBottom: screenHeight * 0.005,
  },
});

export default HoatDongThamGia;
