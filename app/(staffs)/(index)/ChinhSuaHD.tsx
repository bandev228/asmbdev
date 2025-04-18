import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getFirestore, doc, getDoc, updateDoc, Timestamp } from '@react-native-firebase/firestore';
import { getStorage, ref, putFile, getDownloadURL } from '@react-native-firebase/storage';
import { useAuth } from './AuthContext';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

interface FormData {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  activityType: string;
  bannerImage: string | null;
  planFile: DocumentPicker.DocumentPickerResult | null;
  planFileUrl: string | null;
  points: number;
}

interface FormErrors {
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  activityType: string;
  planFile: string;
}

interface UpdateActivityData {
  name: string;
  notes: string;
  location: string;
  startDate: FirebaseFirestoreTypes.Timestamp;
  endDate: FirebaseFirestoreTypes.Timestamp;
  startTime: string;
  endTime: string;
  activityType: string;
  points: number;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
  updatedBy: string | undefined;
  bannerImageUrl?: string;
  planFileUrl?: string;
}

const activityTypes = [
  'Tình nguyện',
  'Đoàn',
  'Câu lạc bộ',
  'Học thuật',
  'Kỹ năng mềm'
];

const ChinhSuaHoatDong = () => {
  const router = useRouter();
  const { activityId } = useLocalSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    location: '',
    startDate: new Date(),
    endDate: new Date(),
    startTime: '',
    endTime: '',
    activityType: '',
    bannerImage: null,
    planFile: null,
    planFileUrl: null,
    points: 0,
  });

  const [errors, setErrors] = useState<FormErrors>({
    title: '',
    description: '',
    location: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    activityType: '',
    planFile: '',
  });

  useEffect(() => {
    fetchActivityData();
  }, [activityId]);

  const fetchActivityData = async () => {
    try {
      setLoading(true);
      const db = getFirestore();
      const activityRef = doc(db, 'activities', activityId as string);
      const activityDoc = await getDoc(activityRef);

      if (activityDoc.exists) {
        const data = activityDoc.data();
        console.log('Activity data:', data); // Debug log

        if (data) {
          // Convert Firestore timestamps to Date objects
          const startDate = data.startDate?.toDate() || new Date();
          const endDate = data.endDate?.toDate() || new Date();

          // Set form data with existing values
          setFormData(prev => ({
            ...prev,
            title: data.name || '',
            description: data.notes || '',
            location: data.location || '',
            startDate: startDate,
            endDate: endDate,
            startTime: data.startTime || '',
            endTime: data.endTime || '',
            activityType: data.activityType || '',
            bannerImage: data.bannerImageUrl || null,
            planFileUrl: data.planFileUrl || null,
            points: data.points || 0,
          }));

          console.log('Form data set:', {
            title: data.name,
            description: data.notes,
            location: data.location,
            startDate: startDate,
            endDate: endDate,
            startTime: data.startTime,
            endTime: data.endTime,
            activityType: data.activityType,
            bannerImage: data.bannerImageUrl,
            planFileUrl: data.planFileUrl,
            points: data.points,
          }); // Debug log
        }
      } else {
        Alert.alert('Lỗi', 'Không tìm thấy hoạt động');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin hoạt động');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: FormErrors = {
      title: '',
      description: '',
      location: '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      activityType: '',
      planFile: '',
    };

    if (!formData.title.trim()) {
      newErrors.title = 'Vui lòng nhập tên hoạt động';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Vui lòng nhập mô tả';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Vui lòng nhập địa điểm';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Vui lòng chọn ngày bắt đầu';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'Vui lòng chọn ngày kết thúc';
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Vui lòng chọn giờ bắt đầu';
    }

    if (!formData.endTime) {
      newErrors.endTime = 'Vui lòng chọn giờ kết thúc';
    }

    if (!formData.activityType) {
      newErrors.activityType = 'Vui lòng chọn loại hoạt động';
    }

    setErrors(newErrors);
    return Object.values(newErrors).every(error => !error);
  };

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        setFormData(prev => ({
          ...prev,
          bannerImage: result.assets[0].uri
        }));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh');
    }
  };

  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      });

      if (!result.canceled) {
        setFormData(prev => ({
          ...prev,
          planFile: result
        }));
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Lỗi', 'Không thể chọn file');
    }
  };

  const uploadFile = async (uri: string, path: string) => {
    try {
      const storage = getStorage();
      const storageRef = ref(storage, path);
      await putFile(storageRef, uri);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Không thể tải lên file');
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      console.log('Starting update process...');
      console.log('Activity ID:', activityId);
      console.log('Form data:', formData);

      setUploading(true);
      const db = getFirestore();
      const activityRef = doc(db, 'activities', activityId as string);

      let bannerImageUrl = formData.bannerImage;
      let planFileUrl = formData.planFileUrl;

      // Upload new banner if changed
      if (formData.bannerImage && formData.bannerImage.startsWith('file://')) {
        console.log('Uploading new banner...');
        try {
          bannerImageUrl = await uploadFile(
            formData.bannerImage,
            `activities/${activityId}/banner_${Date.now()}.jpg`
          );
          console.log('Banner uploaded successfully:', bannerImageUrl);
        } catch (error) {
          console.error('Error uploading banner:', error);
          Alert.alert('Lỗi', 'Không thể tải lên banner. Vui lòng thử lại.');
          setUploading(false);
          return;
        }
      }

      // Upload new plan file if changed
      if (formData.planFile && !formData.planFile.canceled) {
        console.log('Uploading new plan file...');
        try {
          planFileUrl = await uploadFile(
            formData.planFile.assets[0].uri,
            `activities/${activityId}/plan_${Date.now()}.${formData.planFile.assets[0].name.split('.').pop()}`
          );
          console.log('Plan file uploaded successfully:', planFileUrl);
        } catch (error) {
          console.error('Error uploading plan file:', error);
          Alert.alert('Lỗi', 'Không thể tải lên file kế hoạch. Vui lòng thử lại.');
          setUploading(false);
          return;
        }
      }

      // Get current activity data
      console.log('Fetching current activity data...');
      const activityDoc = await getDoc(activityRef);
      if (!activityDoc.exists) {
        console.error('Activity not found');
        Alert.alert('Lỗi', 'Không tìm thấy hoạt động');
        setUploading(false);
        return;
      }

      const currentData = activityDoc.data() || {};
      console.log('Current activity data:', currentData);

      // Prepare update data
      const updateData: Record<string, any> = {
        name: formData.title || currentData.name || '',
        notes: formData.description || currentData.notes || '',
        location: formData.location || currentData.location || '',
        startDate: formData.startDate ? Timestamp.fromDate(formData.startDate) : currentData.startDate || Timestamp.now(),
        endDate: formData.endDate ? Timestamp.fromDate(formData.endDate) : currentData.endDate || Timestamp.now(),
        startTime: formData.startTime || currentData.startTime || '',
        endTime: formData.endTime || currentData.endTime || '',
        activityType: formData.activityType || currentData.activityType || '',
        points: formData.points || currentData.points || 0,
        updatedAt: Timestamp.now()
      };

      // Only add updatedBy if user exists
      if (user?.uid) {
        updateData.updatedBy = user.uid;
      }

      // Only add bannerImageUrl if it exists and is different
      if (bannerImageUrl && bannerImageUrl !== currentData.bannerImageUrl) {
        updateData.bannerImageUrl = bannerImageUrl;
      }

      // Only add planFileUrl if it exists and is different
      if (planFileUrl && planFileUrl !== currentData.planFileUrl) {
        updateData.planFileUrl = planFileUrl;
      }

      console.log('Prepared update data:', updateData);

      // Update the document
      console.log('Updating document...');
      await updateDoc(activityRef, updateData);
      console.log('Document updated successfully');

      Alert.alert('Thành công', 'Hoạt động đã được cập nhật');
      router.back();
    } catch (error) {
      console.error('Error updating activity:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật hoạt động');
    } finally {
      setUploading(false);
    }
  };

  const onChangeDate = (event: any, selectedDate?: Date, type: 'start' | 'end' = 'start') => {
    if (selectedDate) {
      if (type === 'start') {
        setFormData(prev => ({
          ...prev,
          startDate: selectedDate,
          endDate: selectedDate > prev.endDate ? selectedDate : prev.endDate
        }));
        setShowStartDatePicker(false);
      } else {
        setFormData(prev => ({
          ...prev,
          endDate: selectedDate
        }));
        setShowEndDatePicker(false);
      }
    }
  };

  const onChangeTime = (event: any, selectedTime?: Date, type: 'start' | 'end' = 'start') => {
    if (selectedTime) {
      const timeString = selectedTime.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      if (type === 'start') {
        setFormData(prev => ({
          ...prev,
          startTime: timeString
        }));
        setShowStartTimePicker(false);
      } else {
        setFormData(prev => ({
          ...prev,
          endTime: timeString
        }));
        setShowEndTimePicker(false);
      }
    }
  };

  if (loading) {
  return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
        <Text style={styles.headerTitle}>Chỉnh sửa hoạt động</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Tên hoạt động</Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
            placeholder="Nhập tên hoạt động"
          />
          {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
              </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Mô tả</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
            placeholder="Nhập mô tả hoạt động"
            multiline
            numberOfLines={4}
          />
          {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
          </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Địa điểm</Text>
            <TextInput
            style={styles.input}
            value={formData.location}
            onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
            placeholder="Nhập địa điểm tổ chức"
          />
          {errors.location ? <Text style={styles.errorText}>{errors.location}</Text> : null}
          </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Loại hoạt động</Text>
          <TouchableOpacity
            style={styles.typeButton}
            onPress={() => setShowTypeModal(true)}
          >
            <Text style={styles.typeButtonText}>
              {formData.activityType || 'Chọn loại hoạt động'}
              </Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
          {errors.activityType ? <Text style={styles.errorText}>{errors.activityType}</Text> : null}
        </View>

        <View style={styles.dateTimeContainer}>
          <View style={styles.dateTimeGroup}>
            <Text style={styles.label}>Ngày bắt đầu</Text>
              <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Text style={styles.dateTimeText}>
                {formData.startDate.toLocaleDateString('vi-VN')}
              </Text>
              <Ionicons name="calendar" size={20} color="#666" />
              </TouchableOpacity>
            {errors.startDate ? <Text style={styles.errorText}>{errors.startDate}</Text> : null}
            </View>

          <View style={styles.dateTimeGroup}>
            <Text style={styles.label}>Giờ bắt đầu</Text>
              <TouchableOpacity
              style={styles.dateTimeButton}
                onPress={() => setShowStartTimePicker(true)}
              >
              <Text style={styles.dateTimeText}>
                {formData.startTime || 'Chọn giờ'}
                </Text>
              <Ionicons name="time" size={20} color="#666" />
              </TouchableOpacity>
            {errors.startTime ? <Text style={styles.errorText}>{errors.startTime}</Text> : null}
            </View>
          </View>

        <View style={styles.dateTimeContainer}>
          <View style={styles.dateTimeGroup}>
            <Text style={styles.label}>Ngày kết thúc</Text>
              <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Text style={styles.dateTimeText}>
                {formData.endDate.toLocaleDateString('vi-VN')}
              </Text>
              <Ionicons name="calendar" size={20} color="#666" />
              </TouchableOpacity>
            {errors.endDate ? <Text style={styles.errorText}>{errors.endDate}</Text> : null}
            </View>

          <View style={styles.dateTimeGroup}>
            <Text style={styles.label}>Giờ kết thúc</Text>
              <TouchableOpacity
              style={styles.dateTimeButton}
                onPress={() => setShowEndTimePicker(true)}
              >
              <Text style={styles.dateTimeText}>
                {formData.endTime || 'Chọn giờ'}
                </Text>
              <Ionicons name="time" size={20} color="#666" />
              </TouchableOpacity>
            {errors.endTime ? <Text style={styles.errorText}>{errors.endTime}</Text> : null}
            </View>
          </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Banner</Text>
          <TouchableOpacity
            style={styles.imagePicker}
            onPress={handleImagePick}
          >
            {formData.bannerImage ? (
              <Image
                source={{ uri: formData.bannerImage }}
                style={styles.previewImage}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image" size={40} color="#666" />
                <Text style={styles.imagePlaceholderText}>Chọn ảnh banner</Text>
              </View>
            )}
          </TouchableOpacity>
          </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>File kế hoạch</Text>
          <TouchableOpacity
            style={styles.filePicker}
            onPress={handleFilePick}
          >
            <View style={styles.fileInfo}>
              <Ionicons name="document" size={24} color="#666" />
              <Text style={styles.fileName}>
                {formData.planFile?.assets?.[0]?.name || 
                 (formData.planFileUrl ? 'File kế hoạch hiện tại' : 'Chọn file kế hoạch (.doc, .pdf)')}
            </Text>
            </View>
          </TouchableOpacity>
          {formData.planFileUrl && (
            <TouchableOpacity
              style={styles.viewFileButton}
              onPress={() => {
                // Handle viewing the existing file
                if (formData.planFileUrl) {
                  // Open the file URL in browser or appropriate viewer
                  Linking.openURL(formData.planFileUrl);
                }
              }}
            >
              <Text style={styles.viewFileText}>Xem file hiện tại</Text>
              </TouchableOpacity>
          )}
          {errors.planFile ? <Text style={styles.errorText}>{errors.planFile}</Text> : null}
          </View>

          <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Cập nhật hoạt động</Text>
            )}
          </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showTypeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn loại hoạt động</Text>
              <TouchableOpacity
                onPress={() => setShowTypeModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
        </View>
            <ScrollView>
              {activityTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={styles.typeOption}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, activityType: type }));
                    setShowTypeModal(false);
                  }}
                >
                  <Text style={styles.typeOptionText}>{type}</Text>
                  {formData.activityType === type && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {showStartDatePicker && (
        <DateTimePicker
          value={formData.startDate}
          mode="date"
          display="default"
          onChange={(event, date) => onChangeDate(event, date, 'start')}
          minimumDate={new Date()}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={formData.endDate}
          mode="date"
          display="default"
          onChange={(event, date) => onChangeDate(event, date, 'end')}
          minimumDate={formData.startDate}
        />
      )}

      {showStartTimePicker && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display="default"
          onChange={(event, time) => onChangeTime(event, time, 'start')}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display="default"
          onChange={(event, time) => onChangeTime(event, time, 'end')}
        />
      )}
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
  container: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A2138',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E9F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1A2138',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E9F0',
    borderRadius: 8,
    padding: 12,
  },
  typeButtonText: {
    fontSize: 16,
    color: '#1A2138',
  },
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateTimeGroup: {
    flex: 1,
    marginRight: 8,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E9F0',
    borderRadius: 8,
    padding: 12,
  },
  dateTimeText: {
    fontSize: 16,
    color: '#1A2138',
  },
  imagePicker: {
    height: 200,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  filePicker: {
    borderWidth: 1,
    borderColor: '#E5E9F0',
    borderRadius: 8,
    padding: 12,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileName: {
    marginLeft: 8,
    fontSize: 16,
    color: '#1A2138',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E9F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2138',
  },
  closeButton: {
    padding: 8,
  },
  typeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E9F0',
  },
  typeOptionText: {
    fontSize: 16,
    color: '#1A2138',
  },
  viewFileButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#E5E9F0',
    borderRadius: 4,
    alignItems: 'center',
  },
  viewFileText: {
    color: '#007AFF',
    fontSize: 14,
  },
});

export default ChinhSuaHoatDong; 