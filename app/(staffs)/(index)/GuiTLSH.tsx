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
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { getFirestore, collection, addDoc, serverTimestamp } from '@react-native-firebase/firestore'
import { getAuth } from '@react-native-firebase/auth'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as FileSystem from 'expo-file-system'

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
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      const db = getFirestore()
      const documentsRef = collection(db, 'documents')

      const documentData: Document = {
        title: title.trim(),
        description: description.trim(),
        fileUrl: `data:${selectedFile.assets[0].mimeType};base64,${base64}`,
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Gửi tài liệu</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Tiêu đề tài liệu</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập tiêu đề tài liệu"
                value={title}
                onChangeText={setTitle}
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
                <Text style={styles.fileInfo}>
                  Loại: {selectedFile.assets[0].mimeType} | Kích thước: {(selectedFile.assets[0].size || 0) / 1024} KB
                </Text>
              )}
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
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
    padding: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
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
    height: 100,
    textAlignVertical: 'top',
  },
  fileContainer: {
    marginBottom: 16,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  fileButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333333',
  },
  fileInfo: {
    marginTop: 8,
    fontSize: 12,
    color: '#666666',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginBottom: 16,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
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