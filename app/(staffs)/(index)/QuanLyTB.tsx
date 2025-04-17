import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getFirestore, collection, query, orderBy, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, deleteField } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { useRouter } from 'expo-router';
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Timestamp } from '@react-native-firebase/firestore'

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

// Declare __DEV__ if it's not already defined
const __DEV__ = process.env.NODE_ENV === 'development';

type RootStackParamList = {
  QuanLyThongBao: undefined
  // Add other screen params as needed
}

type NotificationType = 'activity' | 'approval' | 'announcement' | 'system'

interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: Timestamp;
  read: boolean;
  type: NotificationType;
  relatedId?: string;
  activityId?: string;
  isRead?: boolean;
}

interface QuanLyThongBaoProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'QuanLyThongBao'>
}

const QuanLyThongBao: React.FC<QuanLyThongBaoProps> = ({ navigation }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [activityId, setActivityId] = useState('');
  const [notificationType, setNotificationType] = useState<'general' | 'activity'>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Animation values
  const fadeAnim = new Animated.Value(1);
  const translateY = new Animated.Value(0);

  const router = useRouter();
  const auth = getAuth();
  const db = getFirestore();

  useFocusEffect(
    useCallback(() => {
      // console.log("QuanLyThongBao screen focused, fetching notifications...");
      fetchNotifications();
      return () => {
        // Cleanup khi màn hình mất focus
      };
    }, [])
  );

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredNotifications(notifications);
    } else {
      const filtered = notifications.filter(
        notification =>
          notification.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          notification.message?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredNotifications(filtered);
    }
  }, [searchQuery, notifications]);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      // console.log("Fetching notifications for management...");
      
      const notificationsQuery = query(
        collection(db, 'notifications'),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(notificationsQuery);
      
      if (querySnapshot.empty) {
        // console.log("No notifications found");
        setNotifications([]);
        setFilteredNotifications([]);
      } else {
        // console.log(`Found ${querySnapshot.size} notifications`);
        
        const notificationsList: Notification[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          // console.log("Notification data:", data);
          
          return {
            id: doc.id,
            title: data.title || "Không có tiêu đề",
            message: data.message || "Không có nội dung",
            createdAt: data.createdAt as Timestamp,
            read: data.read || false,
            type: data.type || 'announcement',
            activityId: data.activityId,
            isRead: data.read || false
          };
        });
        
        setNotifications(notificationsList);
        setFilteredNotifications(notificationsList);
        // console.log(`Processed ${notificationsList.length} notifications`);
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

  const handleSendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo');
      return;
    }

    setIsSending(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Lỗi', 'Bạn cần đăng nhập để gửi thông báo');
        setIsSending(false);
        return;
      }
      
      const newNotification = {
        title: title.trim(),
        message: message.trim(),
        createdAt: serverTimestamp(),
        read: false,
        type: (notificationType === 'activity' ? 'activity' : 'announcement') as NotificationType,
        activityId: notificationType === 'activity' ? activityId.trim() : undefined
      };
      
      const docRef = await addDoc(collection(db, 'notifications'), newNotification);
      console.log("Notification created with ID:", docRef.id);

      const createdNotification: Notification = {
        id: docRef.id,
        ...newNotification,
        createdAt: Timestamp.fromDate(new Date()),
        isRead: false
      };
      
      setNotifications(prev => [createdNotification, ...prev]);
      setFilteredNotifications(prev => [createdNotification, ...prev]);

      setTitle('');
      setMessage('');
      setActivityId('');
      setNotificationType('general');
      setModalVisible(false);
      
      Alert.alert('Thành công', 'Đã gửi thông báo thành công');
    } catch (error) {
      console.error('Error sending notification:', error);
      Alert.alert('Lỗi', 'Không thể gửi thông báo. Vui lòng thử lại sau.');
    } finally {
      setIsSending(false);
    }
  };

  const handleEditNotification = async () => {
    if (!title.trim() || !message.trim() || !currentNotification) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo');
      return;
    }

    setIsEditing(true);
    try {
      const updatedData = {
        title: title.trim(),
        message: message.trim(),
        updatedAt: serverTimestamp(),
        type: (notificationType === 'activity' ? 'activity' : 'announcement') as NotificationType,
        activityId: notificationType === 'activity' ? activityId.trim() : undefined
      };
      
      if (notificationType === 'general' && currentNotification.activityId) {
        await updateDoc(doc(db, 'notifications', currentNotification.id), {
          activityId: deleteField()
        });
      }
      
      await updateDoc(doc(db, 'notifications', currentNotification.id), updatedData);
      console.log("Notification updated:", currentNotification.id);

      setNotifications(prev => 
        prev.map(notification => 
          notification.id === currentNotification.id 
            ? {
                ...notification, 
                ...updatedData,
                activityId: notificationType === 'activity' ? activityId.trim() : undefined
              } 
            : notification
        )
      );

      setTitle('');
      setMessage('');
      setActivityId('');
      setNotificationType('general');
      setCurrentNotification(null);
      setEditModalVisible(false);
      
      Alert.alert('Thành công', 'Đã cập nhật thông báo thành công');
    } catch (error) {
      console.error('Error updating notification:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật thông báo. Vui lòng thử lại sau.');
    } finally {
      setIsEditing(false);
    }
  };

  const deleteNotification = async (id: string, notification: Notification) => {
    try {
      const notificationRef = doc(db, 'notifications', id)
      await deleteDoc(notificationRef)
      return true
    } catch (error) {
      console.error('Error deleting notification:', error)
      return false
    }
  }

  const handleDeleteNotification = (notification: Notification) => {
    Alert.alert(
      'Xác nhận xóa',
      'Bạn có chắc chắn muốn xóa thông báo này không?',
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await deleteNotification(notification.id, notification)
              if (success) {
                fetchNotifications() // Refresh the list after deletion
              }
            } catch (error) {
              console.error('Error in handleDeleteNotification:', error)
            }
          },
        },
      ]
    )
  }

  const openEditModal = (id: string, notification: Notification) => {
    setCurrentNotification(notification);
    setTitle(notification.title || '');
    setMessage(notification.message || '');
    setNotificationType(notification.activityId ? 'activity' : 'general');
    setActivityId(notification.activityId || '');
    setEditModalVisible(true);
  };

  const formatTimestamp = (timestamp: Timestamp): string => {
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
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ngày trước`;
    }
  };

  const getNotificationIcon = (notification: Notification): string => {
    if (notification.activityId) {
      return '📝';
    } else if (notification.type === 'approval') {
      return '✅';
    } else if (notification.type === 'announcement') {
      return '📢';
    } else {
      return '🔔';
    }
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <View style={styles.notificationItem}>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        <Text style={styles.notificationTime}>
          {formatTimestamp(item.createdAt)}
        </Text>
      </View>
      <View style={styles.notificationActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => openEditModal(item.id, item)}
        >
          <Text style={styles.buttonText}>Sửa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteNotification(item)}
        >
          <Text style={styles.buttonText}>Xóa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDebugInfo = () => {
    if (__DEV__) {
      return (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            Số lượng thông báo: {notifications.length}
          </Text>
          <Text style={styles.debugText}>
            Thông báo đã lọc: {filteredNotifications.length}
          </Text>
          {error && <Text style={styles.errorText}>Lỗi: {error}</Text>}
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
            <Text style={styles.headerTitle}>Quản lý thông báo</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="add" size={screenWidth * 0.06} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={screenWidth * 0.05} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm thông báo..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={screenWidth * 0.05} color="#999" />
              </TouchableOpacity>
            )}
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
          <Text style={styles.headerTitle}>Quản lý thông báo</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={screenWidth * 0.06} color="#007AFF" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={screenWidth * 0.05} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm thông báo..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={screenWidth * 0.05} color="#999" />
            </TouchableOpacity>
          )}
        </View>
        
        {renderDebugInfo()}
        
        <FlatList
          data={filteredNotifications}
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={screenWidth * 0.15} color="#666666" />
              <Text style={styles.emptyTitle}>Không có thông báo</Text>
              <Text style={styles.emptyText}>
                {searchQuery 
                  ? 'Không tìm thấy thông báo phù hợp' 
                  : error 
                    ? error 
                    : 'Chưa có thông báo nào được tạo'}
              </Text>
              <TouchableOpacity 
                style={styles.createButton}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.createButtonText}>Tạo thông báo mới</Text>
              </TouchableOpacity>
            </View>
          }
        />
        
        {/* Modal tạo thông báo mới */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Tạo thông báo mới</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={screenWidth * 0.06} color="#333" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody}>
                <Text style={styles.inputLabel}>Loại thông báo</Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity 
                    style={[
                      styles.typeOption, 
                      notificationType === 'general' && styles.selectedType,
                      notificationType === 'general' && { backgroundColor: '#FF9800' }
                    ]}
                    onPress={() => setNotificationType('general')}
                  >
                    <Ionicons 
                      name="megaphone-outline" 
                      size={screenWidth * 0.05} 
                      color={notificationType === 'general' ? '#FFF' : '#FF9800'} 
                    />
                    <Text style={[
                      styles.typeOptionText,
                      notificationType === 'general' && styles.selectedTypeText
                    ]}>Thông báo chung</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.typeOption, 
                      notificationType === 'activity' && styles.selectedType,
                      notificationType === 'activity' && { backgroundColor: '#4CAF50' }
                    ]}
                    onPress={() => setNotificationType('activity')}
                  >
                    <Ionicons 
                      name="calendar-outline" 
                      size={screenWidth * 0.05} 
                      color={notificationType === 'activity' ? '#FFF' : '#4CAF50'} 
                    />
                    <Text style={[
                      styles.typeOptionText,
                      notificationType === 'activity' && styles.selectedTypeText
                    ]}>Thông báo hoạt động</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.inputLabel}>Tiêu đề</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập tiêu đề thông báo"
                  value={title}
                  onChangeText={setTitle}
                />
                
                <Text style={styles.inputLabel}>Nội dung</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Nhập nội dung thông báo"
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  textAlignVertical="top"
                />
                
                {notificationType === 'activity' && (
                  <>
                    <Text style={styles.inputLabel}>ID Hoạt động</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Nhập ID hoạt động"
                      value={activityId}
                      onChangeText={setActivityId}
                    />
                  </>
                )}
              </ScrollView>
              
              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.sendButton}
                  onPress={handleSendNotification}
                  disabled={isSending}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.sendButtonText}>Gửi thông báo</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        
        {/* Modal chỉnh sửa thông báo */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={editModalVisible}
          onRequestClose={() => setEditModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Chỉnh sửa thông báo</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Ionicons name="close" size={screenWidth * 0.06} color="#333" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody}>
                <Text style={styles.inputLabel}>Loại thông báo</Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity 
                    style={[
                      styles.typeOption, 
                      notificationType === 'general' && styles.selectedType,
                      notificationType === 'general' && { backgroundColor: '#FF9800' }
                    ]}
                    onPress={() => setNotificationType('general')}
                  >
                    <Ionicons 
                      name="megaphone-outline" 
                      size={screenWidth * 0.05} 
                      color={notificationType === 'general' ? '#FFF' : '#FF9800'} 
                    />
                    <Text style={[
                      styles.typeOptionText,
                      notificationType === 'general' && styles.selectedTypeText
                    ]}>Thông báo chung</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.typeOption, 
                      notificationType === 'activity' && styles.selectedType,
                      notificationType === 'activity' && { backgroundColor: '#4CAF50' }
                    ]}
                    onPress={() => setNotificationType('activity')}
                  >
                    <Ionicons 
                      name="calendar-outline" 
                      size={screenWidth * 0.05} 
                      color={notificationType === 'activity' ? '#FFF' : '#4CAF50'} 
                    />
                    <Text style={[
                      styles.typeOptionText,
                      notificationType === 'activity' && styles.selectedTypeText
                    ]}>Thông báo hoạt động</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.inputLabel}>Tiêu đề</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập tiêu đề thông báo"
                  value={title}
                  onChangeText={setTitle}
                />
                
                <Text style={styles.inputLabel}>Nội dung</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Nhập nội dung thông báo"
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  textAlignVertical="top"
                />
                
                {notificationType === 'activity' && (
                  <>
                    <Text style={styles.inputLabel}>ID Hoạt động</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Nhập ID hoạt động"
                      value={activityId}
                      onChangeText={setActivityId}
                    />
                  </>
                )}
              </ScrollView>
              
              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.sendButton}
                  onPress={handleEditNotification}
                  disabled={isEditing}
                >
                  {isEditing ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.sendButtonText}>Cập nhật</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
  addButton: {
    padding: screenWidth * 0.02,
    marginLeft: screenWidth * 0.02,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: screenWidth * 0.04,
    paddingHorizontal: screenWidth * 0.03,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: screenWidth * 0.02,
  },
  searchInput: {
    flex: 1,
    height: screenHeight * 0.05,
    fontSize: screenWidth * 0.04,
    color: '#333',
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
  notificationContent: {
    flexDirection: 'column',
  },
  notificationTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: '600',
    color: '#333333',
    marginBottom: screenHeight * 0.01,
  },
  notificationMessage: {
    fontSize: screenWidth * 0.04,
    color: '#666666',
    marginBottom: screenHeight * 0.01,
    lineHeight: screenWidth * 0.055,
  },
  notificationTime: {
    fontSize: screenWidth * 0.035,
    color: '#999999',
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  notificationDate: {
    fontSize: screenWidth * 0.035,
    color: '#999999',
  },
  activityIdContainer: {
    marginTop: screenHeight * 0.01,
    paddingTop: screenHeight * 0.01,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  activityIdText: {
    fontSize: screenWidth * 0.035,
    color: '#666',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: screenWidth * 0.02,
    borderRadius: 5,
    marginLeft: screenWidth * 0.02,
  },
  editButton: {
    backgroundColor: '#E3F2FD',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: screenHeight * 0.1,
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
    textAlign: 'center',
  },
  createButton: {
    paddingVertical: screenHeight * 0.015,
    paddingHorizontal: screenWidth * 0.08,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: screenWidth * 0.04,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: screenWidth * 0.04,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: screenWidth * 0.04,
    maxHeight: screenHeight * 0.6,
  },
  inputLabel: {
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
    color: '#333',
    marginBottom: screenHeight * 0.01,
  },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: screenWidth * 0.04,
    fontSize: screenWidth * 0.04,
    marginBottom: screenHeight * 0.02,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    height: screenHeight * 0.15,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: screenHeight * 0.02,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: screenWidth * 0.03,
    borderRadius: 8,
    marginRight: screenWidth * 0.03,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F7FA',
  },
  selectedType: {
    borderColor: 'transparent',
  },
  typeOptionText: {
    marginLeft: screenWidth * 0.02,
    fontSize: screenWidth * 0.035,
    color: '#333',
  },
  selectedTypeText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: screenWidth * 0.04,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  cancelButton: {
    padding: screenWidth * 0.04,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    flex: 1,
    marginRight: screenWidth * 0.02,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: screenWidth * 0.04,
  },
  sendButton: {
    padding: screenWidth * 0.04,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    flex: 1,
    marginLeft: screenWidth * 0.02,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
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
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default QuanLyThongBao;