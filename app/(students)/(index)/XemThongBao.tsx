import React, { useState, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useNotifications, Notification } from './hooks/useNotifications';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const ThongBao = () => {
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { 
    notifications, 
    loading, 
    error, 
    unreadCount, 
    markAsRead, 
    refetch 
  } = useNotifications();

  useFocusEffect(
    useCallback(() => {
      refetch();
      return () => {};
    }, [refetch])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  }, [refetch]);

  const handleNotificationPress = async (notification: Notification) => {
    // Hiển thị chi tiết thông báo
    Alert.alert(
      notification.title,
      notification.message,
      [{ text: 'OK' }]
    );
    
    // Đánh dấu đã đọc nếu chưa đọc
    if (!notification.isRead) {
      try {
        await markAsRead(notification.id);
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    }
    
    if (notification.activityId) {
      router.push({
        pathname: "./ChiTietHD/[id]",
        params: { id: notification.activityId }
      });
    }
  };

  const getTimeAgo = (timestamp: Date) => {
    if (!timestamp) return 'Không có ngày';
    
    try {
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
      
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
        return timestamp.toLocaleDateString('vi-VN');
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Không xác định';
    }
  };

  const getNotificationIcon = (notification: Notification): keyof typeof Ionicons.glyphMap => {
    if (notification.type === 'activity') {
      return 'calendar-outline';
    }
    return 'notifications-outline';
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const icon = getNotificationIcon(item);
    const iconColor = item.type === 'activity' ? "#4CAF50" : "#007AFF";
    const MAX_CONTENT_LENGTH = 150;
    const isContentLong = item.message.length > MAX_CONTENT_LENGTH;
    const truncatedContent = isContentLong 
      ? item.message.substring(0, MAX_CONTENT_LENGTH) + '...' 
      : item.message;
    
    return (
      <TouchableOpacity 
        style={[
          styles.notificationItem, 
          !item.isRead && styles.unreadNotification
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <View style={styles.iconContainer}>
              <Ionicons 
                name={icon} 
                size={screenWidth * 0.05} 
                color={iconColor} 
              />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[
                styles.notificationTitle,
                !item.isRead && styles.unreadText
              ]}>
                {item.title}
              </Text>
              <Text style={styles.notificationTime}>
                {getTimeAgo(item.createdAt)}
              </Text>
            </View>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>

          <View style={styles.messageContainer}>
            <Text style={styles.notificationMessage}>{truncatedContent}</Text>
            {isContentLong && (
              <TouchableOpacity 
                style={styles.viewMoreButton}
                onPress={() => handleNotificationPress(item)}
              >
                <Text style={styles.viewMoreText}>Xem thêm</Text>
              </TouchableOpacity>
            )}
          </View>

          {item.senderName && (
            <View style={styles.footerContainer}>
              <Text style={styles.senderText}>
                Người gửi: {item.senderName}
              </Text>
              {item.activityId && (
                <TouchableOpacity 
                  style={styles.activityButton}
                  onPress={() => handleNotificationPress(item)}
                >
                  <Ionicons name="arrow-forward" size={screenWidth * 0.04} color="#007AFF" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
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
            <TouchableOpacity onPress={refetch} style={styles.refreshButton}>
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
          <TouchableOpacity onPress={refetch} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={screenWidth * 0.06} color="#007AFF" />
          </TouchableOpacity>
        </View>
        
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
                onPress={refetch}
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
    borderRadius: 12,
    marginBottom: screenHeight * 0.015,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 3,
  },
  notificationContent: {
    padding: screenWidth * 0.04,
  },
  unreadNotification: {
    backgroundColor: '#F8FAFF',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: screenHeight * 0.012,
  },
  iconContainer: {
    width: screenWidth * 0.1,
    height: screenWidth * 0.1,
    borderRadius: screenWidth * 0.05,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: screenWidth * 0.03,
  },
  headerTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: screenWidth * 0.042,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  unreadText: {
    color: '#007AFF',
    fontWeight: '700',
  },
  notificationTime: {
    fontSize: screenWidth * 0.035,
    color: '#999999',
  },
  messageContainer: {
    marginBottom: screenHeight * 0.01,
  },
  notificationMessage: {
    fontSize: screenWidth * 0.038,
    color: '#666666',
    lineHeight: screenWidth * 0.052,
  },
  viewMoreButton: {
    marginTop: screenHeight * 0.005,
  },
  viewMoreText: {
    color: '#007AFF',
    fontSize: screenWidth * 0.035,
    fontWeight: '500',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: screenHeight * 0.01,
    paddingTop: screenHeight * 0.01,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  senderText: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
    fontStyle: 'italic',
    flex: 1,
  },
  activityButton: {
    padding: screenWidth * 0.02,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    marginLeft: screenWidth * 0.02,
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
});

export default ThongBao;