import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAuth } from '@react-native-firebase/auth';
import { getDatabase, ref, push, serverTimestamp } from '@react-native-firebase/database';
import DropDownPicker from 'react-native-dropdown-picker';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

interface FeedbackForm {
  title: string;
  content: string;
  category: string;
  attachments?: string[];
}

const PhanHoi = () => {
  const [form, setForm] = useState<FeedbackForm>({
    title: '',
    content: '',
    category: '',
  });

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [categories] = useState([
    { label: 'Cơ sở vật chất', value: 'facilities' },
    { label: 'Học tập', value: 'academic' },
    { label: 'Hoạt động sinh viên', value: 'activities' },
    { label: 'Dịch vụ sinh viên', value: 'services' },
    { label: 'Khác', value: 'other' },
  ]);

  const handleSubmit = useCallback(async () => {
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
              router.back();
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
  }, [form]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={screenWidth * 0.06} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gửi phản hồi</Text>
          <View style={styles.headerRight} />
        </View>

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
      </KeyboardAvoidingView>
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
  },
  backButton: {
    padding: screenWidth * 0.02,
  },
  headerTitle: {
    fontSize: screenWidth * 0.055,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: screenWidth * 0.1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  formContainer: {
    padding: screenWidth * 0.04,
  },
  label: {
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
    color: '#333333',
    marginBottom: screenWidth * 0.02,
    marginTop: screenWidth * 0.04,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: screenWidth * 0.02,
    padding: screenWidth * 0.04,
    fontSize: screenWidth * 0.04,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    height: screenHeight * 0.2,
    textAlignVertical: 'top',
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E0E0',
    borderRadius: screenWidth * 0.02,
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E0E0',
    borderRadius: screenWidth * 0.02,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: screenWidth * 0.02,
    padding: screenWidth * 0.04,
    alignItems: 'center',
    marginTop: screenWidth * 0.08,
  },
  submitButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: screenWidth * 0.045,
    fontWeight: '600',
  },
});

export default PhanHoi;