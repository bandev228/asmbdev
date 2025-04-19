import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
  FlatList,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAuth } from '@react-native-firebase/auth';
import { getDatabase, ref, push, serverTimestamp, onValue } from '@react-native-firebase/database';
import DropDownPicker from 'react-native-dropdown-picker';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

interface FeedbackForm {
  title: string;
  content: string;
  category: string;
  attachments?: string[];
}

interface SubmittedFeedback extends FeedbackForm {
  id: string;
  userId: string;
  userEmail: string;
  status: 'pending' | 'in-progress' | 'resolved';
  createdAt: number;
  updatedAt?: number;
  response?: string;
}

const PhanHoi = () => {
  const [form, setForm] = useState<FeedbackForm>({
    title: '',
    content: '',
    category: '',
  });

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [submittedFeedbacks, setSubmittedFeedbacks] = useState<SubmittedFeedback[]>([]);
  const [showForm, setShowForm] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<SubmittedFeedback | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const [categories] = useState([
    { label: 'Cơ sở vật chất', value: 'facilities' },
    { label: 'Học tập', value: 'academic' },
    { label: 'Hoạt động sinh viên', value: 'activities' },
    { label: 'Dịch vụ sinh viên', value: 'services' },
    { label: 'Khác', value: 'other' },
  ]);

  const getStatusColor = (status: SubmittedFeedback['status']) => {
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

  const getStatusLabel = (status: SubmittedFeedback['status']) => {
    switch (status) {
      case 'pending':
        return 'Chờ xử lý';
      case 'in-progress':
        return 'Đang xử lý';
      case 'resolved':
        return 'Đã giải quyết';
      default:
        return 'Không xác định';
    }
  };

  const fetchFeedbacks = () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const database = getDatabase();
    const feedbackRef = ref(database, 'feedback');
    
    onValue(feedbackRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const feedbackList = Object.entries(data)
          .map(([id, value]: [string, any]) => ({
            id,
            ...value,
          }))
          .filter((feedback: SubmittedFeedback) => feedback.userId === user.uid)
          .sort((a, b) => b.createdAt - a.createdAt);
        setSubmittedFeedbacks(feedbackList);
      } else {
        setSubmittedFeedbacks([]);
      }
      setRefreshing(false);
    });
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim() || !form.category) {
      Alert.alert('Thông báo', 'Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      setLoading(true);
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        Alert.alert('Lỗi', 'Vui lòng đăng nhập lại');
        return;
      }

      const database = getDatabase();
      const feedbackRef = ref(database, 'feedback');

      await push(feedbackRef, {
        ...form,
        userId: user.uid,
        userEmail: user.email,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        'Thành công',
        'Cảm ơn bạn đã gửi phản hồi. Chúng tôi sẽ xem xét và phản hồi sớm nhất có thể.',
        [
          {
            text: 'OK',
            onPress: () => {
              setForm({ title: '', content: '', category: '' });
              setShowForm(false);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Lỗi khi gửi phản hồi:', error);
      Alert.alert('Lỗi', 'Không thể gửi phản hồi. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const renderFeedbackItem = ({ item }: { item: SubmittedFeedback }) => (
    <TouchableOpacity 
      style={styles.feedbackItem}
      onPress={() => {
        setSelectedFeedback(item);
        setDetailModalVisible(true);
      }}
    >
      <View style={styles.feedbackHeader}>
        <Text style={styles.feedbackTitle}>{truncateText(item.title, 50)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>
      
      <Text style={styles.feedbackContent}>{truncateText(item.content, 150)}</Text>
      
      {item.response && (
        <View style={styles.responseContainer}>
          <View style={styles.responseHeader}>
            <Ionicons name="chatbubble-outline" size={16} color="#666666" />
            <Text style={styles.responseLabel}>Phản hồi từ cán bộ:</Text>
          </View>
          <Text style={styles.responseContent}>{truncateText(item.response, 100)}</Text>
          {item.updatedAt && (
            <Text style={styles.responseTime}>
              {format(new Date(item.updatedAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
            </Text>
          )}
        </View>
      )}
      
      <View style={styles.feedbackMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={16} color="#666666" />
          <Text style={styles.metaText}>
            {format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="folder-outline" size={16} color="#666666" />
          <Text style={styles.metaText}>
            {categories.find(cat => cat.value === item.category)?.label}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Phản hồi</Text>
          <TouchableOpacity
            onPress={() => setShowForm(!showForm)}
            style={styles.toggleButton}
          >
            <Ionicons
              name={showForm ? 'list-outline' : 'add-outline'}
              size={24}
              color="#007AFF"
            />
          </TouchableOpacity>
        </View>

        {showForm ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formContainer}>
              <Text style={styles.label}>Tiêu đề</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập tiêu đề phản hồi"
                value={form.title}
                onChangeText={(text) => setForm({ ...form, title: text })}
                maxLength={100}
              />

              <Text style={styles.label}>Loại phản hồi</Text>
              <DropDownPicker
                open={open}
                value={form.category}
                items={categories}
                setOpen={setOpen}
                setValue={(callback) => setForm({ ...form, category: callback(form.category) })}
                style={styles.dropdown}
                dropDownContainerStyle={styles.dropdownContainer}
                placeholder="Chọn loại phản hồi"
                listMode="SCROLLVIEW"
              />

              <Text style={styles.label}>Nội dung</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Mô tả chi tiết phản hồi của bạn"
                value={form.content}
                onChangeText={(text) => setForm({ ...form, content: text })}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!form.title.trim() || !form.content.trim() || !form.category) &&
                    styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={loading || !form.title.trim() || !form.content.trim() || !form.category}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Gửi phản hồi</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={submittedFeedbacks}
            renderItem={renderFeedbackItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchFeedbacks();
                }}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyStateText}>Bạn chưa gửi phản hồi nào</Text>
                <TouchableOpacity
                  style={styles.newFeedbackButton}
                  onPress={() => setShowForm(true)}
                >
                  <Text style={styles.newFeedbackButtonText}>Gửi phản hồi mới</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>

      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết phản hồi</Text>
              <TouchableOpacity
                onPress={() => setDetailModalVisible(false)}
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
                    <Text style={styles.detailLabel}>Trạng thái</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedFeedback.status), alignSelf: 'flex-start' }]}>
                      <Text style={styles.statusText}>{getStatusLabel(selectedFeedback.status)}</Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Nội dung phản hồi</Text>
                    <Text style={styles.detailContent}>{selectedFeedback.content}</Text>
                  </View>

                  {selectedFeedback.response && (
                    <View style={[styles.responseContainer, styles.detailResponse]}>
                      <View style={styles.responseHeader}>
                        <Ionicons name="chatbubble-outline" size={16} color="#666666" />
                        <Text style={styles.responseLabel}>Phản hồi từ cán bộ:</Text>
                      </View>
                      <Text style={styles.responseContent}>{selectedFeedback.response}</Text>
                      {selectedFeedback.updatedAt && (
                        <Text style={styles.responseTime}>
                          {format(new Date(selectedFeedback.updatedAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
                        </Text>
                      )}
                    </View>
                  )}

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Thông tin thêm</Text>
                    <View style={styles.detailMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={16} color="#666666" />
                        <Text style={styles.metaText}>
                          Ngày gửi: {format(new Date(selectedFeedback.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
                        </Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="folder-outline" size={16} color="#666666" />
                        <Text style={styles.metaText}>
                          Danh mục: {categories.find(cat => cat.value === selectedFeedback.category)?.label}
                        </Text>
                      </View>
                    </View>
                  </View>
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
  container: {
    flex: 1,
    backgroundColor: '#F0F0F5',
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  toggleButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  formContainer: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E0E0',
    borderRadius: 8,
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E0E0',
    borderRadius: 8,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
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
    marginBottom: 24,
  },
  newFeedbackButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 24,
  },
  newFeedbackButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  responseContainer: {
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  responseLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginLeft: 6,
  },
  responseContent: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
  },
  responseTime: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
    textAlign: 'right',
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
    maxHeight: '80%',
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
  detailResponse: {
    marginVertical: 20,
  },
  detailMeta: {
    backgroundColor: '#F8F8F8',
    padding: 12,
    borderRadius: 8,
  },
});

export default PhanHoi;