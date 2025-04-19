import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  StatusBar,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getDatabase, ref, onValue, update, push } from '@react-native-firebase/database';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface StudentInfo {
  displayName: string;
  studentId: string;
  class?: string;
  faculty?: string;
  email?: string;
}

interface Feedback {
  id: string;
  title: string;
  content: string;
  category: string;
  userId: string;
  userEmail: string;
  status: 'pending' | 'in-progress' | 'resolved';
  createdAt: number;
  updatedAt?: number;
  response?: string;
}

const TiepNhanPH = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [studentInfo, setStudentInfo] = useState<Record<string, StudentInfo>>({});

  const categories = [
    { label: 'Tất cả', value: 'all' },
    { label: 'Cơ sở vật chất', value: 'facilities' },
    { label: 'Học tập', value: 'academic' },
    { label: 'Hoạt động sinh viên', value: 'activities' },
    { label: 'Dịch vụ sinh viên', value: 'services' },
    { label: 'Khác', value: 'other' },
  ];

  const statuses = [
    { label: 'Tất cả', value: 'all' },
    { label: 'Chờ xử lý', value: 'pending' },
    { label: 'Đang xử lý', value: 'in-progress' },
    { label: 'Đã giải quyết', value: 'resolved' },
  ];

  const fetchStudentInfo = async (userId: string) => {
    if (studentInfo[userId]) return;

    try {
      const firestore = getFirestore();
      const studentDoc = await getDoc(doc(firestore, 'users', userId));
      
      if (studentDoc.exists) {
        const data = studentDoc.data();
        if (data) {
          // Extract student ID from email
          const studentId = data.email?.split('@')[0] || '';
          // console.log('Student ID:', studentId); // Debug log
          
          setStudentInfo(prev => ({
            ...prev,
            [userId]: {
              displayName: data.displayName || '',
              studentId: studentId,
              class: data.class || '',
              faculty: data.faculty || '',
              email: data.email || '',
            },
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching student info:', error);
    }
  };

  const fetchFeedbacks = () => {
    const database = getDatabase();
    const feedbackRef = ref(database, 'feedback');
    
    onValue(feedbackRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const feedbackList = Object.entries(data).map(([id, value]: [string, any]) => ({
          id,
          ...value,
        }));
        setFeedbacks(feedbackList);
        
        // Fetch student info for each feedback
        feedbackList.forEach(feedback => {
          fetchStudentInfo(feedback.userId);
        });
      } else {
        setFeedbacks([]);
      }
      setLoading(false);
      setRefreshing(false);
    });
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFeedbacks();
  };

  const handleStatusChange = async (feedbackId: string, newStatus: Feedback['status']) => {
    try {
      const database = getDatabase();
      const feedbackRef = ref(database, `feedback/${feedbackId}`);
      
      await update(feedbackRef, {
        status: newStatus,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Error updating feedback status:', error);
    }
  };

  const handleResponseSubmit = async () => {
    if (!selectedFeedback || !responseText.trim()) return;

    try {
      const database = getDatabase();
      const feedbackRef = ref(database, `feedback/${selectedFeedback.id}`);
      
      // Update feedback with response
      await update(feedbackRef, {
        status: 'resolved',
        response: responseText.trim(),
        updatedAt: Date.now(),
      });

      // Create notification for student
      const notificationRef = ref(database, `notifications/${selectedFeedback.userId}`);
      await push(notificationRef, {
        type: 'feedback_response',
        feedbackId: selectedFeedback.id,
        title: 'Phản hồi mới',
        message: 'Phản hồi của bạn đã được trả lời',
        createdAt: Date.now(),
        read: false
      });

      setResponseModalVisible(false);
      setResponseText('');
      setSelectedFeedback(null);
      Alert.alert('Thành công', 'Đã gửi phản hồi cho sinh viên');
    } catch (error) {
      console.error('Error submitting response:', error);
      Alert.alert('Lỗi', 'Không thể gửi phản hồi. Vui lòng thử lại sau.');
    }
  };

  const filteredFeedbacks = feedbacks.filter(feedback => {
    const categoryMatch = selectedCategory === 'all' || feedback.category === selectedCategory;
    const statusMatch = selectedStatus === 'all' || feedback.status === selectedStatus;
    return categoryMatch && statusMatch;
  });

  const getStatusColor = (status: Feedback['status']) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'in-progress':
        return '#007AFF';
      case 'resolved':
        return '#34C759';
      default:
        return '#8E8E93';
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const renderFeedbackItem = ({ item }: { item: Feedback }) => (
    <TouchableOpacity
      style={styles.feedbackItem}
      onPress={() => {
        setSelectedFeedback(item);
        setResponseModalVisible(true);
      }}
    >
      <View style={styles.feedbackHeader}>
        <View style={styles.titleContainer}>
          <Text style={styles.feedbackTitle}>{truncateText(item.title, 50)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>
              {statuses.find(s => s.value === item.status)?.label}
            </Text>
          </View>
        </View>
      </View>
      
      <Text style={styles.feedbackContent}>{truncateText(item.content, 100)}</Text>
      
      <View style={styles.feedbackMeta}>
        <View style={styles.studentInfo}>
          <Ionicons name="person-outline" size={16} color="#666666" />
          <View style={styles.studentDetails}>
            <Text style={styles.studentName}>
              {studentInfo[item.userId]?.displayName || 'Đang tải...'}
            </Text>
            <Text style={styles.studentId}>
              MSSV: {studentInfo[item.userId]?.studentId || 'Đang tải...'}
            </Text>
          </View>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={16} color="#666666" />
          <Text style={styles.metaText}>
            {format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
          </Text>
        </View>
      </View>

      {item.response && (
        <View style={styles.responseContainer}>
          <Text style={styles.responseLabel}>Phản hồi:</Text>
          <Text style={styles.responseText}>{truncateText(item.response, 80)}</Text>
        </View>
      )}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, item.status !== 'pending' && styles.disabledButton]}
          onPress={() => handleStatusChange(item.id, 'in-progress')}
          disabled={item.status !== 'pending'}
        >
          <Ionicons name="time-outline" size={20} color="#007AFF" />
          <Text style={styles.actionButtonText}>Xử lý</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, item.status === 'resolved' && styles.disabledButton]}
          onPress={() => {
            setSelectedFeedback(item);
            setResponseModalVisible(true);
          }}
          disabled={item.status === 'resolved'}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#34C759" />
          <Text style={styles.actionButtonText}>Phản hồi</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tiếp nhận phản hồi</Text>
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Danh mục:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category.value}
                style={[
                  styles.filterButton,
                  selectedCategory === category.value && styles.selectedFilterButton,
                ]}
                onPress={() => setSelectedCategory(category.value)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    selectedCategory === category.value && styles.selectedFilterButtonText,
                  ]}
                >
                  {category.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Trạng thái:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
          >
            {statuses.map((status) => (
              <TouchableOpacity
                key={status.value}
                style={[
                  styles.filterButton,
                  selectedStatus === status.value && styles.selectedFilterButton,
                ]}
                onPress={() => setSelectedStatus(status.value)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    selectedStatus === status.value && styles.selectedFilterButtonText,
                  ]}
                >
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <FlatList
        data={filteredFeedbacks}
        renderItem={renderFeedbackItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyStateText}>Không có phản hồi nào</Text>
          </View>
        }
      />

      <Modal
        visible={responseModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setResponseModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết phản hồi</Text>
              <TouchableOpacity
                onPress={() => setResponseModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {selectedFeedback && (
                <>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Tiêu đề</Text>
                    <Text style={styles.detailTitle}>{selectedFeedback.title}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Nội dung phản hồi</Text>
                    <Text style={styles.detailContent}>{selectedFeedback.content}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Thông tin sinh viên</Text>
                    <View style={styles.detailMeta}>
                      <Text style={styles.detailMetaText}>
                        Họ tên: {studentInfo[selectedFeedback.userId]?.displayName}
                      </Text>
                      <Text style={styles.detailMetaText}>
                        MSSV: {studentInfo[selectedFeedback.userId]?.studentId}
                      </Text>
                      <Text style={styles.detailMetaText}>
                        Lớp: {studentInfo[selectedFeedback.userId]?.class}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Thông tin thêm</Text>
                    <View style={styles.detailMeta}>
                      <Text style={styles.detailMetaText}>
                        Thời gian: {format(new Date(selectedFeedback.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </Text>
                      <Text style={styles.detailMetaText}>
                        Danh mục: {categories.find(cat => cat.value === selectedFeedback.category)?.label}
                      </Text>
                      <Text style={styles.detailMetaText}>
                        Trạng thái: {statuses.find(s => s.value === selectedFeedback.status)?.label}
                      </Text>
                    </View>
                  </View>

                  {selectedFeedback.response && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Phản hồi đã gửi</Text>
                      <View style={styles.responseDetail}>
                        <Text style={styles.responseDetailText}>{selectedFeedback.response}</Text>
                        <Text style={styles.responseDetailTime}>
                          {selectedFeedback.updatedAt && 
                            format(new Date(selectedFeedback.updatedAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
                        </Text>
                      </View>
                    </View>
                  )}

                  {selectedFeedback.status !== 'resolved' && (
                    <>
                      <View style={styles.responseInputSection}>
                        <Text style={styles.detailLabel}>Gửi phản hồi mới</Text>
                        <TextInput
                          style={styles.responseInput}
                          placeholder="Nhập nội dung phản hồi..."
                          value={responseText}
                          onChangeText={setResponseText}
                          multiline
                          numberOfLines={6}
                          textAlignVertical="top"
                        />
                      </View>

                      <TouchableOpacity
                        style={[styles.submitButton, !responseText.trim() && styles.submitButtonDisabled]}
                        onPress={handleResponseSubmit}
                        disabled={!responseText.trim()}
                      >
                        <Text style={styles.submitButtonText}>Gửi phản hồi</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  filterContainer: {
    padding: 16,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterSection: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectedFilterButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666666',
  },
  selectedFilterButtonText: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
  },
  feedbackItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  feedbackHeader: {
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  feedbackContent: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
    lineHeight: 20,
  },
  feedbackMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  studentDetails: {
    marginLeft: 8,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  studentId: {
    fontSize: 12,
    color: '#666666',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 4,
  },
  responseContainer: {
    backgroundColor: '#F8F8F8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  responseLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  responseText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8F8F8',
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '90%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollView: {
    padding: 16,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  detailContent: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 24,
  },
  detailMeta: {
    backgroundColor: '#F8F8F8',
    padding: 12,
    borderRadius: 8,
  },
  detailMetaText: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 4,
  },
  responseDetail: {
    backgroundColor: '#F0F7FF',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  responseDetailText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
  },
  responseDetailTime: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
    textAlign: 'right',
  },
  responseInputSection: {
    marginBottom: 16,
  },
  responseInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TiepNhanPH;