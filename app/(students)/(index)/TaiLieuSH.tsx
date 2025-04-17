import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
  StatusBar,
  FlatList,
  Linking,
  Modal,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getFirestore, collection, query, orderBy, getDocs, doc, getDoc } from '@react-native-firebase/firestore';
import * as FileSystem from 'expo-file-system';
import * as WebBrowser from 'expo-web-browser';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

interface Document {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileType: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: Date;
  senderName?: string;
}

const CACHE_KEY = 'documents_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

const TaiLieuSinhHoat = () => {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const getDataFromCache = async () => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        const now = new Date().getTime();
        if (now - timestamp < CACHE_EXPIRY) {
          setDocuments(data);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Lỗi khi đọc cache:', error);
      return false;
    }
  };

  const saveDataToCache = async (data: Document[]) => {
    try {
      const cacheData = {
        data,
        timestamp: new Date().getTime(),
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Lỗi khi lưu cache:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const db = getFirestore();
      const documentsRef = collection(db, 'documents');
      const q = query(documentsRef, orderBy('uploadedAt', 'desc'));
      
      const querySnapshot = await getDocs(q);
      const docs: Document[] = [];
      
      for (const docSnapshot of querySnapshot.docs) {
        const data = docSnapshot.data();
        const userDoc = await getDoc(doc(db, 'users', data.uploadedBy));
        const userData = userDoc.data();
        
        docs.push({
          id: docSnapshot.id,
          title: data.title || '',
          description: data.description || '',
          fileUrl: data.fileUrl || '',
          fileType: data.fileType || '',
          fileName: data.fileName || '',
          fileSize: data.fileSize || 0,
          uploadedBy: data.uploadedBy || '',
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
          senderName: userData?.displayName || 'Không xác định'
        });
      }

      setDocuments(docs);
      saveDataToCache(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Không thể tải danh sách tài liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const openDocument = async (document: Document) => {
    setSelectedDoc(document);
    setShowOptions(true);
  };

  const handleViewOnline = async () => {
    if (!selectedDoc) return;
    
    try {
      // Kiểm tra URL hợp lệ
      if (!selectedDoc.fileUrl || !selectedDoc.fileUrl.startsWith('http')) {
        throw new Error('URL không hợp lệ');
      }

      // Mở trình duyệt với các tùy chọn
      const result = await WebBrowser.openBrowserAsync(selectedDoc.fileUrl, {
        enableBarCollapsing: true,
        showTitle: true,
        toolbarColor: '#007AFF',
        controlsColor: '#FFFFFF',
        dismissButtonStyle: 'done',
        readerMode: true,
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });

      // Kiểm tra kết quả
      if (result.type === 'cancel') {
        Alert.alert('Thông báo', 'Bạn đã đóng trình xem tài liệu');
      }
    } catch (error) {
      console.error('Error opening document:', error);
      
      // Hiển thị thông báo lỗi chi tiết hơn
      let errorMessage = 'Không thể mở tài liệu. Vui lòng thử lại.';
      
      if (error instanceof Error) {
        if (error.message.includes('URL không hợp lệ')) {
          errorMessage = 'URL tài liệu không hợp lệ. Vui lòng thử tải xuống.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Không có kết nối mạng. Vui lòng kiểm tra kết nối của bạn.';
        }
      }
      
      Alert.alert('Lỗi', errorMessage, [
        {
          text: 'Tải xuống',
          onPress: handleDownload,
        },
        {
          text: 'Đóng',
          style: 'cancel',
        },
      ]);
    }
  };

  const handleDownload = async () => {
    if (!selectedDoc) return;
    
    try {
      setDownloading(true);
      
      // Chuyển đổi file:// URL thành https:// URL
      let downloadUrl = selectedDoc.fileUrl;
      if (downloadUrl?.startsWith('file://')) {
        const fileName = downloadUrl.split('/').pop() || selectedDoc.fileName;
        downloadUrl = `https://firebasestorage.googleapis.com/v0/b/asmbdev.appspot.com/o/${encodeURIComponent(fileName)}?alt=media`;
      }

      console.log('Starting download from:', downloadUrl);
      
      // Tạo tên file duy nhất để tránh xung đột
      const timestamp = new Date().getTime();
      const fileExtension = selectedDoc.fileName.split('.').pop() || 'pdf';
      const uniqueFileName = `document_${timestamp}.${fileExtension}`;
      const downloadPath = `${FileSystem.documentDirectory}${uniqueFileName}`;
      
      console.log('Saving to:', downloadPath);
      
      const { uri } = await FileSystem.downloadAsync(downloadUrl, downloadPath);
      console.log('Downloaded to:', uri);

      // Kiểm tra file đã tải về
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('File info:', fileInfo);

      Alert.alert(
        'Thành công',
        'Tài liệu đã được tải xuống',
        [
          { 
            text: 'Mở', 
            onPress: async () => {
              try {
                console.log('Attempting to open file...');
                if (Platform.OS === 'ios') {
                  console.log('Opening on iOS...');
                  await WebBrowser.openBrowserAsync(uri);
                } else {
                  console.log('Opening on Android...');
                  const contentUri = await FileSystem.getContentUriAsync(uri);
                  console.log('Content URI:', contentUri);

                  // Kiểm tra mime type
                  const mimeType = selectedDoc.fileType || 'application/pdf';
                  console.log('Mime type:', mimeType);

                  // Thử mở với mime type cụ thể
                  try {
                    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                      data: contentUri,
                      flags: 1,
                      type: mimeType,
                    });
                  } catch (intentError) {
                    console.log('First intent failed, trying with generic PDF viewer...');
                    // Thử lại với PDF viewer
                    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                      data: contentUri,
                      flags: 1,
                      type: 'application/pdf',
                    });
                  }
                }
              } catch (error) {
                console.error('Error details:', error);
                Alert.alert(
                  'Lỗi',
                  'Không thể mở tài liệu. Bạn có muốn cài đặt ứng dụng đọc PDF không?',
                  [
                    {
                      text: 'Cài đặt',
                      onPress: () => {
                        Linking.openURL('market://details?id=com.adobe.reader');
                      },
                    },
                    {
                      text: 'Hủy',
                      style: 'cancel',
                    },
                  ]
                );
              }
            }
          },
          { 
            text: 'Chia sẻ',
            onPress: async () => {
              try {
                console.log('Attempting to share file...');
                const contentUri = await FileSystem.getContentUriAsync(uri);
                console.log('Share content URI:', contentUri);

                if (Platform.OS === 'ios') {
                  await Share.share({
                    url: contentUri,
                    title: selectedDoc.title,
                  });
                } else {
                  const isAvailable = await Sharing.isAvailableAsync();
                  if (isAvailable) {
                    await Sharing.shareAsync(contentUri, {
                      mimeType: 'application/pdf',
                      UTI: 'com.adobe.pdf',
                      dialogTitle: `Chia sẻ ${selectedDoc.title}`,
                    });
                  } else {
                    Alert.alert('Lỗi', 'Không thể chia sẻ tài liệu trên thiết bị này.');
                  }
                }
              } catch (error) {
                console.error('Share error:', error);
                Alert.alert('Lỗi', 'Không thể chia sẻ tài liệu. Vui lòng thử lại.');
              }
            }
          },
          { text: 'Đóng' }
        ]
      );
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Lỗi', 'Không thể tải xuống tài liệu. Vui lòng thử lại.');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedDoc) return;
    
    try {
      // Chuyển đổi file:// URL thành https:// URL
      let downloadUrl = selectedDoc.fileUrl;
      if (downloadUrl?.startsWith('file://')) {
        const fileName = downloadUrl.split('/').pop() || selectedDoc.fileName;
        downloadUrl = `https://firebasestorage.googleapis.com/v0/b/asmbdev.appspot.com/o/${encodeURIComponent(fileName)}?alt=media`;
      }

      const downloadPath = `${FileSystem.documentDirectory}${selectedDoc.fileName}`;
      const { uri } = await FileSystem.downloadAsync(downloadUrl, downloadPath);
      
      if (Platform.OS === 'ios') {
        await Share.share({
          url: uri,
          title: selectedDoc.title,
        });
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: selectedDoc.fileType || 'application/pdf',
            dialogTitle: selectedDoc.title,
          });
        } else {
          Alert.alert('Lỗi', 'Không thể chia sẻ tài liệu trên thiết bị này.');
        }
      }
    } catch (error) {
      console.error('Error sharing document:', error);
      Alert.alert('Lỗi', 'Không thể chia sẻ tài liệu. Vui lòng thử lại.');
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return 'document-text';
    if (fileType.includes('word')) return 'document';
    if (fileType.includes('image')) return 'image';
        return 'document-outline';
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderDocumentItem = ({ item }: { item: Document }) => (
    <TouchableOpacity
      style={styles.documentItem}
      onPress={() => openDocument(item)}
    >
      <View style={styles.documentIcon}>
        <Ionicons
          name={getFileIcon(item.fileType)}
          size={24}
          color="#007AFF"
        />
      </View>
      <View style={styles.documentInfo}>
        <Text style={styles.documentTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.documentDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.documentMeta}>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color="#666" />
            <Text style={styles.metaText}>{item.senderName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color="#666" />
            <Text style={styles.metaText}>{formatDate(item.uploadedAt)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="document-outline" size={14} color="#666" />
            <Text style={styles.metaText}>{formatFileSize(item.fileSize)}</Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={screenWidth * 0.06} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Tài liệu sinh hoạt</Text>
            <View style={styles.headerRight} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={screenWidth * 0.06} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Tài liệu sinh hoạt</Text>
            <View style={styles.headerRight} />
          </View>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchDocuments}
            >
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </TouchableOpacity>
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={screenWidth * 0.06} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tài liệu sinh hoạt</Text>
          <View style={styles.headerRight} />
        </View>

        <FlatList
          data={documents}
          renderItem={renderDocumentItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <Modal
        visible={showOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedDoc?.title}</Text>
              <TouchableOpacity
                onPress={() => setShowOptions(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleViewOnline}
              >
                <Ionicons name="eye-outline" size={24} color="#007AFF" />
                <Text style={styles.optionText}>Xem trực tuyến</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <ActivityIndicator color="#007AFF" />
                ) : (
                  <Ionicons name="download-outline" size={24} color="#007AFF" />
                )}
                <Text style={styles.optionText}>
                  {downloading ? 'Đang tải xuống...' : 'Tải xuống'}
              </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={24} color="#007AFF" />
                <Text style={styles.optionText}>Chia sẻ</Text>
              </TouchableOpacity>
            </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: screenWidth * 0.04,
    marginBottom: screenWidth * 0.03,
    padding: screenWidth * 0.04,
    borderRadius: screenWidth * 0.03,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  documentIcon: {
    width: screenWidth * 0.12,
    height: screenWidth * 0.12,
    borderRadius: screenWidth * 0.02,
    backgroundColor: '#F0F0F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: screenWidth * 0.03,
  },
  documentInfo: {
    flex: 1,
    marginRight: screenWidth * 0.02,
  },
  documentTitle: {
    fontSize: screenWidth * 0.042,
    fontWeight: '600',
    color: '#333333',
    marginBottom: screenWidth * 0.01,
  },
  documentDescription: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
    marginBottom: screenWidth * 0.02,
  },
  documentMeta: {
    flexDirection: 'column',
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: screenWidth * 0.032,
    color: '#666666',
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
    maxWidth: 400,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: screenWidth * 0.055,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 4,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F0F0F5',
  },
  optionText: {
    fontSize: screenWidth * 0.042,
    color: '#333333',
    marginLeft: 12,
  },
});

export default TaiLieuSinhHoat; 