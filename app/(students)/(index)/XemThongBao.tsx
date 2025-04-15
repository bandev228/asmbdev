import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator, 
  StatusBar,
  RefreshControl,
  Alert
} from 'react-native';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  read: boolean;
  isRead: boolean;
  activityId?: string;
}

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

// Declare __DEV__ if it's not already defined (e.g., in a testing environment)
const __DEV__ = process.env.NODE_ENV === 'development';

const ThongBao = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Sử dụng useFocusEffect để tải lại thông báo khi màn hình được focus
  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
      return () => {
      };
    }, [])
  );

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const notificationsRef = firestore().collection('notifications');
      const querySnapshot = await notificationsRef.orderBy('createdAt', 'desc').get();
      
      if (querySnapshot.empty) {
        console.log("No notifications found");
        setNotifications([]);
        setUnreadCount(0);
      } else {
        
        const notificationsList: Notification[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          
          // Kiểm tra trạng thái đã đọc
          const isRead = data.read === true;
          
          return {
            id: doc.id,
            ...data,
            isRead: isRead,
            // Đảm bảo các trường luôn có giá trị
            title: data.title || "Không có tiêu đề",
            message: data.message || "Không có nội dung",
            createdAt: data.createdAt || firestore.Timestamp.now(),
            read: isRead
          } as Notification;
        });
        
        // Đếm số thông báo chưa đọc
        const unread = notificationsList.filter(notification => !notification.isRead).length;
        setUnreadCount(unread);
        setNotifications(notificationsList);
        
        console.log(`Processed ${notificationsList.length} notifications, ${unread} unread`);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setError("Không thể tải thông báo. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (notificationId: string) => {
    try {
      console.log(`Marking notification ${notificationId} as read`);
      const notificationRef = firestore().collection('notifications').doc(notificationId);
      
      // Cập nhật trạng thái đã đọc
      await notificationRef.update({
        read: true
      });
      
      // Cập nhật state để hiển thị thông báo đã đọc ngay lập tức
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => 
          notification.id === notificationId 
            ? {...notification, isRead: true, read: true} 
            : notification
        )
      );
      
      // Cập nhật số lượng thông báo chưa đọc
      setUnreadCount(prevCount => Math.max(0, prevCount - 1));
      
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Hiển thị chi tiết thông báo
    Alert.alert(
      notification.title,
      notification.message,
      [{ text: 'OK' }]
    );
    
    // Đánh dấu đã đọc nếu chưa đọc
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    
    if (notification.activityId) {
      router.push({
        pathname: "./ChiTietHD/[id]",
        params: { id: notification.activityId }
      });
    }
  };

  const getTimeAgo = (timestamp: FirebaseFirestoreTypes.Timestamp) => {
    if (!timestamp) return 'Không có ngày';
    
    try {
      const now = new Date();
      const notificationDate = timestamp.toDate();
      const diffInSeconds = Math.floor((now.getTime() - notificationDate.getTime()) / 1000);
      
      if (diffInSeconds < 60) {
        return 'Vừa xong';
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} phút trước`;
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} giờ trước`;
      } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} ngày trước`;
      } else {
        return notificationDate.toLocaleDateString('vi-VN');
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Không xác định';
    }
  };

  const getNotificationIcon = (notification: Notification) => {
    // Dựa vào activityId để xác định loại thông báo
    if (notification.activityId) {
      return 'calendar-outline';
    }
    return 'notifications-outline';
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const icon = getNotificationIcon(item);
    
    return (
      <TouchableOpacity 
        style={[
          styles.notificationItem, 
          !item.isRead && styles.unreadNotification
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationHeader}>
          <Ionicons 
            name={icon} 
            size={screenWidth * 0.06} 
            color={item.activityId ? "#4CAF50" : "#007AFF"} 
          />
          <Text style={[
            styles.notificationTitle,
            !item.isRead && styles.unreadText
          ]}>
            {item.title}
          </Text>
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        <Text style={styles.notificationDate}>
          {getTimeAgo(item.createdAt)}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => {
    if (unreadCount > 0) {
      return (
        <View style={styles.unreadHeader}>
          <Ionicons name="mail-unread-outline" size={screenWidth * 0.05} color="#007AFF" />
          <Text style={styles.unreadHeaderText}>Bạn có {unreadCount} thông báo chưa đọc</Text>
        </View>
      );
    }
    return null;
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={screenWidth * 0.06} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Thông báo</Text>
            <TouchableOpacity onPress={fetchNotifications} style={styles.refreshButton}>
              <Ionicons name="refresh-outline" size={screenWidth * 0.06} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Đang tải thông báo...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={screenWidth * 0.06} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thông báo</Text>
          <TouchableOpacity onPress={fetchNotifications} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={screenWidth * 0.06} color="#007AFF" />
          </TouchableOpacity>
        </View>
        
        {/* Debug info - chỉ hiển thị trong môi trường phát triển */}
        {__DEV__ && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>
              Số lượng thông báo: {notifications.length}
            </Text>
            <Text style={styles.debugText}>
              Thông báo chưa đọc: {unreadCount}
            </Text>
            {error && <Text style={styles.errorText}>Lỗi: {error}</Text>}
          </View>
        )}
        
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#007AFF']}
              tintColor="#007AFF"
            />
          }
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={screenWidth * 0.15} color="#666666" />
              <Text style={styles.emptyTitle}>Không có thông báo</Text>
              <Text style={styles.emptyText}>
                {error ? error : 'Bạn chưa có thông báo nào'}
              </Text>
              <TouchableOpacity 
                style={styles.refreshEmptyButton}
                onPress={fetchNotifications}
              >
                <Text style={styles.refreshEmptyText}>Làm mới</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F0F0F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenWidth * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    padding: screenWidth * 0.02,
    marginRight: screenWidth * 0.02,
  },
  headerTitle: {
    fontSize: screenWidth * 0.055,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: screenWidth * 0.02,
    marginLeft: screenWidth * 0.02,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: screenWidth * 0.04,
    paddingBottom: screenHeight * 0.1,
  },
  notificationItem: {
    backgroundColor: '#FFFFFF',
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.015,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 3,
  },
  unreadNotification: {
    backgroundColor: '#F0F7FF',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: screenHeight * 0.01,
  },
  notificationTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: '600',
    color: '#333333',
    marginLeft: screenWidth * 0.03,
    flex: 1,
  },
  unreadText: {
    fontWeight: '700',
    color: '#007AFF',
  },
  notificationMessage: {
    fontSize: screenWidth * 0.04,
    color: '#666666',
    marginBottom: screenHeight * 0.01,
    lineHeight: screenWidth * 0.055,
  },
  notificationDate: {
    fontSize: screenWidth * 0.035,
    color: '#999999',
    textAlign: 'right',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
    marginLeft: 10,
  },
  unreadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7FF',
    padding: screenWidth * 0.03,
    borderRadius: 8,
    marginBottom: screenHeight * 0.02,
  },
  unreadHeaderText: {
    fontSize: screenWidth * 0.04,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: screenWidth * 0.02,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: screenHeight * 0.2,
  },
  emptyTitle: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    color: '#333',
    marginTop: screenHeight * 0.02,
    marginBottom: screenHeight * 0.01,
  },
  emptyText: {
    fontSize: screenWidth * 0.04,
    color: '#666666',
    marginBottom: screenHeight * 0.03,
  },
  refreshEmptyButton: {
    paddingVertical: screenHeight * 0.015,
    paddingHorizontal: screenWidth * 0.08,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  refreshEmptyText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: screenWidth * 0.04,
  },
  debugContainer: {
    backgroundColor: '#FFECB3',
    padding: 10,
    margin: 10,
    borderRadius: 5,
  },
  debugText: {
    fontSize: 12,
    color: '#333',
  },
  errorText: {
    fontSize: 12,
    color: 'red',
    fontWeight: 'bold',
  },
});

export default ThongBao;