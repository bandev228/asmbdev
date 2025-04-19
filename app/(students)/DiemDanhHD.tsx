import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, SafeAreaView, ActivityIndicator, Modal, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { verifyFaceMatch, compareImagesDirect, downloadUserAvatar } from './(index)/hooks/faceRecognitionService';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter, useLocalSearchParams } from 'expo-router';

interface RouteParams {
  activityId: string;
}

interface VerificationResult {
  isMatch: boolean;
  score: number;
  error: string | null;
  method?: string;
  debug?: {
    capturedFace?: any;
    avatarFace?: any;
  };
}

interface ImageResult {
  uri: string;
  width: number;
  height: number;
}

const DiemDanhSinhVien = () => {
  const router = useRouter();
  const { activityId } = useLocalSearchParams();
  const [photo, setPhoto] = useState<ImageResult | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Tải ảnh đại diện khi component mount
  useEffect(() => {
    const loadAvatar = async () => {
      try {
        const uri = await downloadUserAvatar();
        setAvatarUri(uri);
      } catch (error) {
        console.error('Không thể tải ảnh đại diện:', error);
      }
    };
    
    loadAvatar();
  }, []);

  // Yêu cầu quyền truy cập camera khi component mount
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Thông báo', 'Cần cấp quyền truy cập camera để điểm danh');
      }
    })();
  }, []);

  const takePicture = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.9,
      });

      if (!result.canceled) {
        // Xử lý ảnh để cải thiện chất lượng nhận diện
        const processedImage = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 800, height: 800 } }],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        setPhoto(processedImage);
        setVerificationResult(null);
        setRetryCount(0);
      }
    } catch (error) {
      console.error('Lỗi chụp ảnh:', error);
      Alert.alert('Lỗi', 'Không thể chụp ảnh. Vui lòng thử lại.');
    }
  };

  const verifyFace = async () => {
    if (!photo) return;
    
    setVerifying(true);
    
    try {
      let result = await verifyFaceMatch(photo.uri);
      
      if ((!result.isMatch || result.error) && retryCount < maxRetries) {
        if (avatarUri) {
          console.log('Thử phương pháp dự phòng: so sánh ảnh trực tiếp');
          const directScore = await compareImagesDirect(photo.uri, avatarUri);
          
          if (!result.score || directScore > result.score) {
            result = {
              isMatch: directScore >= 0.65,
              score: directScore,
              error: null,
              method: 'direct-comparison'
            };
          }
        }
        
        setRetryCount(prev => prev + 1);
      }
      
      setVerificationResult(result);
      setShowVerificationModal(true);
      
      if (result.isMatch) {
        setTimeout(() => {
          setShowVerificationModal(false);
          uploadPhoto(result);
        }, 2000);
      }
    } catch (error) {
      console.error('Lỗi xác minh khuôn mặt:', error);
      Alert.alert('Lỗi', 'Không thể xác minh khuôn mặt. Vui lòng thử lại.');
    } finally {
      setVerifying(false);
    }
  };

  const uploadPhoto = async (verificationResult: VerificationResult) => {
    if (!photo || uploading) return;

    setUploading(true);
    setUploadProgress(0);

    const user = auth().currentUser;
    if (!user) {
      Alert.alert('Thông báo', 'Vui lòng đăng nhập để điểm danh');
      setUploading(false);
      return;
    }

    try {
      const db = getFirestore();
      
      // Kiểm tra điểm danh trùng
      const attendanceRef = collection(db, 'attendance');
      const q = query(
        attendanceRef,
        where('userId', '==', user.uid),
        where('activityId', '==', activityId)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        Alert.alert('Thông báo', 'Bạn đã điểm danh cho hoạt động này');
        setUploading(false);
        return;
      }

      // Chuyển ảnh thành base64
      const response = await fetch(photo.uri);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      reader.onload = async () => {
        const base64Image = reader.result as string;
        
        // Lưu vào Firestore
        await addDoc(attendanceRef, {
          userId: user.uid,
          activityId: activityId,
          imageData: base64Image,
          timestamp: serverTimestamp(),
          status: verificationResult.isMatch ? 'verified' : 'pending',
          verificationScore: verificationResult.score || 0,
          verifiedByAI: !!verificationResult.isMatch,
          verificationMethod: verificationResult.method || 'face-recognition'
        });

        Alert.alert(
          'Thành công', 
          verificationResult.isMatch 
            ? 'Điểm danh thành công! Khuôn mặt đã được xác minh.' 
            : 'Ảnh đã được tải lên. Đang chờ xác minh.'
        );
        router.back();
      };

    } catch (error) {
      console.error('Lỗi:', error);
      Alert.alert('Lỗi', 'Không thể điểm danh. Vui lòng thử lại sau.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const renderVerificationModal = () => {
    if (!verificationResult) return null;
    
    const { isMatch, score, error, debug } = verificationResult;
    
    return (
      <Modal
        transparent={true}
        visible={showVerificationModal}
        animationType="fade"
        onRequestClose={() => setShowVerificationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              {isMatch ? (
                <Ionicons name="checkmark-circle" size={60} color="#32cd32" />
              ) : (
                <Ionicons name="close-circle" size={60} color="#ff6347" />
              )}
              <Text style={styles.modalTitle}>
                {isMatch ? 'Xác minh thành công' : 'Xác minh thất bại'}
              </Text>
            </View>
            
            <Text style={styles.modalMessage}>
              {isMatch 
                ? 'Khuôn mặt của bạn đã được xác minh. Đang tiến hành điểm danh...' 
                : error || 'Khuôn mặt không khớp với ảnh đại diện. Vui lòng thử lại.'}
            </Text>
            
            {!error && (
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreLabel}>Độ tương đồng:</Text>
                <View style={styles.scoreBar}>
                  <View 
                    style={[
                      styles.scoreFill, 
                      { 
                        width: `${Math.min(score * 100, 100)}%`,
                        backgroundColor: isMatch ? '#32cd32' : '#ff6347' 
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.scoreValue}>{Math.round(score * 100)}%</Text>
              </View>
            )}
            
            {/* Thêm nút hiển thị thông tin debug */}
            <TouchableOpacity 
              style={styles.debugButton} 
              onPress={() => setShowDebugInfo(!showDebugInfo)}
            >
              <Text style={styles.debugButtonText}>
                {showDebugInfo ? 'Ẩn thông tin debug' : 'Hiện thông tin debug'}
              </Text>
            </TouchableOpacity>
            
            {showDebugInfo && debug && (
              <View style={styles.debugInfo}>
                <Text style={styles.debugTitle}>Thông tin debug:</Text>
                <Text style={styles.debugText}>
                  Phương thức: {verificationResult.method || 'face-recognition'}
                </Text>
                {debug.capturedFace && (
                  <>
                    <Text style={styles.debugText}>
                      Khuôn mặt chụp: {debug.capturedFace.bounds.size.width}x{debug.capturedFace.bounds.size.height}
                    </Text>
                    <Text style={styles.debugText}>
                      Góc: Roll={debug.capturedFace.rollAngle.toFixed(1)}, Yaw={debug.capturedFace.yawAngle.toFixed(1)}
                    </Text>
                  </>
                )}
                {debug.avatarFace && (
                  <>
                    <Text style={styles.debugText}>
                      Khuôn mặt avatar: {debug.avatarFace.bounds.size.width}x{debug.avatarFace.bounds.size.height}
                    </Text>
                    <Text style={styles.debugText}>
                      Góc: Roll={debug.avatarFace.rollAngle.toFixed(1)}, Yaw={debug.avatarFace.yawAngle.toFixed(1)}
                    </Text>
                  </>
                )}
              </View>
            )}
            
            {!isMatch && (
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity 
                  style={styles.modalButton} 
                  onPress={() => {
                    setShowVerificationModal(false);
                    
                  }}
                >
                  <Text style={styles.modalButtonText}>Đóng</Text>
                </TouchableOpacity>
                
                {retryCount < maxRetries && (
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.retryVerifyButton]} 
                    onPress={() => {
                      setShowVerificationModal(false);
                      verifyFace();
                    }}
                  >
                    <Text style={styles.modalButtonText}>Thử lại ({maxRetries - retryCount})</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  // Hiển thị ảnh đại diện để so sánh
  const renderAvatarPreview = () => {
    if (!avatarUri) return null;
    
    return (
      <View style={styles.avatarPreviewContainer}>
        <Text style={styles.avatarPreviewTitle}>Ảnh đại diện của bạn:</Text>
        <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {!photo ? (
        <View style={styles.cameraContainer}>
          {renderAvatarPreview()}
          <TouchableOpacity 
            style={styles.captureButton} 
            onPress={takePicture}
          >
            <Ionicons name="camera" size={40} color="white" />
            <Text style={styles.captureText}>Chụp ảnh điểm danh</Text>
          </TouchableOpacity>
          <Text style={styles.instructionText}>
            Hãy nhìn thẳng vào camera và đảm bảo khuôn mặt của bạn được nhìn rõ.
            Cố gắng giữ tư thế tương tự như ảnh đại diện của bạn.
          </Text>
        </View>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: photo.uri }} style={styles.preview} />
          <View style={styles.overlayContainer}>
            {(uploading || verifying) && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  {verifying 
                    ? 'Đang xác minh khuôn mặt...' 
                    : `Đang tải lên: ${Math.round(uploadProgress)}%`}
                </Text>
                {uploading && (
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                  </View>
                )}
                {verifying && <ActivityIndicator size="small" color="white" style={styles.loader} />}
              </View>
            )}
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.retakeButton} 
                onPress={() => setPhoto(null)}
                disabled={uploading || verifying}
              >
                <Ionicons name="refresh-outline" size={24} color="white" />
                <Text style={styles.buttonText}>Chụp lại</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmButton, (uploading || verifying) && styles.disabledButton]} 
                onPress={verifyFace} 
                disabled={uploading || verifying}
              >
                {uploading || verifying ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="scan-outline" size={24} color="white" />
                    <Text style={styles.buttonText}>Xác minh</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      {renderVerificationModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  cameraContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  captureButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#32cd32',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
  },
  captureText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
    fontWeight: 'bold',
  },
  instructionText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 20,
    opacity: 0.8,
  },
  previewContainer: {
    flex: 1,
  },
  preview: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlayContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  progressContainer: {
    marginBottom: 15,
    alignItems: 'center',
  },
  progressText: {
    color: 'white',
    textAlign: 'center',
    marginBottom: 5,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 2,
  },
  loader: {
    marginTop: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6347',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#32cd32',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#333',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  scoreContainer: {
    width: '100%',
    marginBottom: 20,
  },
  scoreLabel: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
  },
  scoreBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 5,
  },
  scoreFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  modalButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  retryVerifyButton: {
    backgroundColor: '#32cd32',
  },
  debugButton: {
    marginVertical: 10,
    padding: 5,
  },
  debugButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  debugInfo: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
    width: '100%',
    marginBottom: 15,
  },
  debugTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  avatarPreviewContainer: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    borderRadius: 10,
  },
  avatarPreviewTitle: {
    color: 'white',
    marginBottom: 10,
    fontSize: 14,
  },
  avatarPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'white',
  },
});

export default DiemDanhSinhVien;