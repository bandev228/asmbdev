import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, doc, getDoc, Timestamp } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Activity {
  id: string;
  name: string;
  description?: string;
  location?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  activityType?: string;
  points?: number;
  maxParticipants?: number;
  participants?: string[];
  pendingParticipants?: string[];
  status: 'pending' | 'approved' | 'completed' | 'cancelled';
  imageUrl?: string;
  organizerInfo?: {
    name: string;
    contact: string;
    email: string;
  };
}

const ChiTietHD = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const auth = getAuth();
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    fetchActivityDetails();
  }, [id]);

  const fetchActivityDetails = async () => {
    try {
      const db = getFirestore();
      const activityDoc = await getDoc(doc(db, 'activities', id as string));
      
      if (activityDoc && activityDoc.data()) {
        const activityData = { id: activityDoc.id, ...activityDoc.data() } as Activity;
        setActivity(activityData);
        
        // Kiểm tra trạng thái tham gia của sinh viên
        if (userId) {
          setIsParticipant(activityData.participants?.includes(userId) || false);
          setIsPending(activityData.pendingParticipants?.includes(userId) || false);
        }
      }
    } catch (error) {
      console.error('Error fetching activity details:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin hoạt động. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'cancelled':
        return '#F44336';
      default:
        return '#666666';
    }
  };

  // const getStatusText = (status: string) => {
  //   switch (status) {
  //     case 'completed':
  //       return 'Hoàn thành';
  //     case 'pending':
  //       return 'Đang chờ';
  //     case 'cancelled':
  //       return 'Đã hủy';
  //     default:
  //       return 'Không xác định';
  //   }
  // };

  const handleOpenMap = () => {
    if (activity?.location) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}`;
      Linking.openURL(url);
    }
  };

  const handleContactOrganizer = () => {
    if (activity?.organizerInfo?.email) {
      Linking.openURL(`mailto:${activity.organizerInfo.email}`);
    } else if (activity?.organizerInfo?.contact) {
      Linking.openURL(`tel:${activity.organizerInfo.contact}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>Không tìm thấy hoạt động</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết hoạt động</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activity.imageUrl && (
          <Image
            source={{ uri: activity.imageUrl }}
            style={styles.activityImage}
            resizeMode="cover"
          />
        )}

        <View style={styles.infoContainer}>
          <View style={styles.titleContainer}>
            <Text style={styles.activityName}>{activity.name}</Text>
            <View style={{ backgroundColor: getStatusColor(activity.status) }}>
              {/* <Text style={styles.statusText}>{getStatusText(activity.status)}</Text> */}
            </View>
          </View>

          {activity.description && (
            <Text style={styles.description}>{activity.description}</Text>
          )}

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color="#666666" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Thời gian</Text>
                <Text style={styles.detailText}>
                  Bắt Đầu: {format(activity.startDate.toDate(), 'HH:mm - dd/MM/yyyy', { locale: vi })}
                </Text>
                <Text style={styles.detailText}>
                  Kết Thúc: {format(activity.endDate.toDate(), 'HH:mm - dd/MM/yyyy', { locale: vi })}
                </Text>
              </View>
            </View>

            {activity.location && (
              <TouchableOpacity style={styles.detailRow} onPress={handleOpenMap}>
                <Ionicons name="location-outline" size={20} color="#666666" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Địa điểm</Text>
                  <Text style={[styles.detailText, styles.linkText]}>{activity.location}</Text>
                </View>
              </TouchableOpacity>
            )}

            {activity.points !== undefined && (
              <View style={styles.detailRow}>
                <Ionicons name="star-outline" size={20} color="#666666" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Điểm rèn luyện</Text>
                  <Text style={styles.detailText}>{activity.points} điểm</Text>
                </View>
              </View>
            )}

            <View style={styles.detailRow}>
              <Ionicons name="people-outline" size={20} color="#666666" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Số người tham gia</Text>
                <Text style={styles.detailText}>
                  {activity.participants?.length || 0}
                  {activity.maxParticipants ? ` / ${activity.maxParticipants}` : ''}
                </Text>
              </View>
            </View>

            {activity.organizerInfo && (
              <TouchableOpacity style={styles.detailRow} onPress={handleContactOrganizer}>
                <Ionicons name="person-outline" size={20} color="#666666" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Người tổ chức</Text>
                  <Text style={styles.detailText}>{activity.organizerInfo.name}</Text>
                  {activity.organizerInfo.contact && (
                    <Text style={[styles.detailText, styles.linkText]}>
                      {activity.organizerInfo.contact}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.participationStatus}>
          {isParticipant ? (
            <View style={styles.statusContainer}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={[styles.statusMessage, { color: '#4CAF50' }]}>
                Bạn đã đăng ký tham gia hoạt động này
              </Text>
            </View>
          ) : isPending ? (
            <View style={styles.statusContainer}>
              <Ionicons name="time" size={24} color="#FF9800" />
              <Text style={[styles.statusMessage, { color: '#FF9800' }]}>
                Đang chờ phê duyệt
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ChiTietHD;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  activityImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F0F0F5',
  },
  infoContainer: {
    padding: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  activityName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    marginRight: 12,
  },
  // statusBadge: {
  //   paddingHorizontal: 12,
  //   paddingVertical: 4,
  //   borderRadius: 12,
  // },
    // statusText: {
    //   color: '#FFFFFF',
    //   fontSize: 12,
    //   fontWeight: '500',
    // },
  description: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 24,
    marginBottom: 20,
  },
  detailsContainer: {
    backgroundColor: '#F8F9FC',
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 16,
    color: '#333333',
  },
  linkText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  participationStatus: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    padding: 12,
    borderRadius: 8,
  },
  statusMessage: {
    fontSize: 16,
    marginLeft: 8,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 12,
  },
});