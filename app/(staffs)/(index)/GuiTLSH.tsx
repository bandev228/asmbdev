import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
  Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { getFirestore, collection, addDoc, serverTimestamp } from '@react-native-firebase/firestore'
import { getAuth } from '@react-native-firebase/auth'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getStorage, ref, putFile, getDownloadURL } from '@react-native-firebase/storage'

interface Document {
  title: string
  description: string
  fileUrl: string
  fileType: string
  fileName: string
  fileSize: number
  uploadedBy: string
  uploadedAt: Date
}

const GuiTLSH = () => {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerResult | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fadeAnim = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start()
  }, [])

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*'],
        copyToCacheDirectory: true,
      })

      if (result.assets && result.assets.length > 0) {
        setSelectedFile(result)
        setError(null)
      }
    } catch (error) {
      console.error('Error picking document:', error)
      setError('Không thể chọn tài liệu. Vui lòng thử lại.')
    }
  }

  const uploadDocument = async () => {
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề tài liệu')
      return
    }

    if (!selectedFile?.assets?.[0]) {
      setError('Vui lòng chọn tài liệu')
      return
    }

    try {
      setIsUploading(true)
      setError(null)

      const auth = getAuth()
      const user = auth.currentUser
      if (!user) {
        throw new Error('Người dùng chưa đăng nhập')
      }

      const fileUri = selectedFile.assets[0].uri
      const storage = getStorage()
      const storageRef = ref(storage, `documents/${Date.now()}_${selectedFile.assets[0].name}`)
      
      // Upload file to Firebase Storage
      await putFile(storageRef, fileUri)
      const downloadURL = await getDownloadURL(storageRef)

      const db = getFirestore()
      const documentsRef = collection(db, 'documents')

      const documentData: Document = {
        title: title.trim(),
        description: description.trim(),
        fileUrl: downloadURL,
        fileType: selectedFile.assets[0].mimeType || '',
        fileName: selectedFile.assets[0].name,
        fileSize: selectedFile.assets[0].size || 0,
        uploadedBy: user.uid,
        uploadedAt: new Date(),
      }

      await addDoc(documentsRef, {
        ...documentData,
        uploadedAt: serverTimestamp(),
      })

      Alert.alert('Thành công', 'Tài liệu đã được tải lên thành công', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (error) {
      console.error('Error uploading document:', error)
      setError('Không thể tải lên tài liệu. Vui lòng thử lại.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Gửi tài liệu</Text>
        <View style={styles.headerRight} />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView style={styles.scrollView}>
          <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Tiêu đề tài liệu</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập tiêu đề tài liệu"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mô tả</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Nhập mô tả tài liệu"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.fileContainer}>
              <Text style={styles.label}>Tài liệu</Text>
              <TouchableOpacity
                style={styles.fileButton}
                onPress={pickDocument}
                disabled={isUploading}
              >
                <Ionicons name="document-attach" size={24} color="#007AFF" />
                <Text style={styles.fileButtonText}>
                  {selectedFile?.assets?.[0] ? selectedFile.assets[0].name : 'Chọn tài liệu'}
                </Text>
              </TouchableOpacity>
              {selectedFile?.assets?.[0] && (
                <View style={styles.fileInfoContainer}>
                  <Text style={styles.fileInfo}>
                    Loại: {selectedFile.assets[0].mimeType}
                  </Text>
                  <Text style={styles.fileInfo}>
                    Kích thước: {(selectedFile.assets[0].size || 0) / 1024} KB
                  </Text>
                </View>
              )}
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#FF3B30" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
              onPress={uploadDocument}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
                  <Text style={styles.uploadButtonText}>Tải lên</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E9F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F0F4F8',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A2138',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2138',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    color: '#1A2138',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  fileContainer: {
    marginBottom: 20,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  fileButtonText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#1A2138',
    flex: 1,
  },
  fileInfoContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F0F4F8',
    borderRadius: 8,
  },
  fileInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginLeft: 8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadButtonDisabled: {
    opacity: 0.7,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
})

export default GuiTLSH