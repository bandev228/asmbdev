import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, arrayUnion, Timestamp, getDoc } from '@react-native-firebase/firestore';
import { useAuth } from '../../(staffs)/(index)/AuthContext';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

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
}

const HDDangDienRa = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);

  useEffect(() => {
    console.log('Current user:', user); // Debug log
    fetchActivities();
  }, [user]); // Add user to dependency array

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

  const renderRegistrationButton = (activity: Activity) => {
    const status = getRegistrationStatus(activity);
    
    if (status === 'approved') {
      return (
        <View style={[styles.statusBadge, styles.approvedBadge]}>
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.statusText}>Đã được duyệt</Text>
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

  const handleActivityPress = (activityId: string) => {
    router.push({
      pathname: '/(students)/(index)/ChiTietHD',
      params: { id: activityId }
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
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
              onPress={() => handleActivityPress(activity.id)}
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
                      {activity.startTime} - {activity.endTime}
                    </Text>
                  </View>
                </View>

                {renderRegistrationButton(activity)}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  pendingBadge: {
    backgroundColor: '#FF9500',
  },
  approvedBadge: {
    backgroundColor: '#34C759',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default HDDangDienRa;
