import * as FileSystem from 'expo-file-system';
import * as FaceDetector from 'expo-face-detector';
// import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import * as ImageManipulator from 'expo-image-manipulator';
import firestore from '@react-native-firebase/firestore';
import { getDoc, doc } from 'firebase/firestore';

interface FaceFeature {
  bounds: {
    size: {
      width: number;
      height: number;
    };
    origin: {
      x: number;
      y: number;
    };
  };
  rollAngle?: number;
  yawAngle?: number;
  landmarks?: {
    [key: string]: {
      x: number;
      y: number;
    };
  };
  smilingProbability?: number;
}

interface FaceDetectionResult {
  faces: FaceFeature[];
  image: {
    width: number;
    height: number;
  };
}

interface VerificationResult {
  isMatch: boolean;
  score: number;
  error: string | null;
  method?: string;
  debug?: {
    capturedFace?: FaceFeature;
    avatarFace?: FaceFeature;
  };
}

interface SimilarityScores {
  boundsSimilarity: number;
  rollSimilarity: number;
  yawSimilarity: number;
  landmarkSimilarity: number;
  classificationSimilarity: number;
  sizeSimilarity: number;
  smileSimilarity?: number;
}

// Tăng ngưỡng tương đồng để đảm bảo độ chính xác cao hơn
const SIMILARITY_THRESHOLD = 0.75;

// Hàm tiền xử lý ảnh để cải thiện chất lượng nhận diện
const preprocessImage = async (imageUri: string): Promise<string> => {
  try {
    const processedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        { resize: { width: 800, height: 800 } },
        { crop: { originX: 0, originY: 0, width: 800, height: 800 } }
      ],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    return processedImage.uri;
  } catch (error) {
    console.error('Lỗi tiền xử lý ảnh:', error);
    return imageUri;
  }
};

/**
 * Phát hiện khuôn mặt trong ảnh với các tùy chọn nâng cao
 */
export const detectFace = async (imageUri: string): Promise<FaceDetectionResult> => {
  try {
    const processedImageUri = await preprocessImage(imageUri);
    
    const options = {
      mode: FaceDetector.FaceDetectorMode.accurate,
      detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
      runClassifications: FaceDetector.FaceDetectorClassifications.all,
      minDetectionInterval: 1000,
      tracking: true,
    };
    
    const result = await FaceDetector.detectFacesAsync(processedImageUri, options);
    
    if (!result.faces.length) {
      throw new Error('Không phát hiện được khuôn mặt trong ảnh');
    }
    
    if (result.faces.length > 1) {
      throw new Error('Phát hiện nhiều khuôn mặt trong ảnh. Vui lòng chụp lại với một khuôn mặt');
    }
    
    console.log(`Phát hiện khuôn mặt thành công`);
    return result;
  } catch (error) {
    console.error('Lỗi phát hiện khuôn mặt:', error);
    throw error;
  }
};

/**
 * Tải ảnh đại diện của người dùng từ Firestore
 */
export const downloadUserAvatar = async (): Promise<string> => {
  const user = auth().currentUser;
  if (!user) throw new Error('Người dùng chưa đăng nhập');
  
  try {
    const userDoc = await firestore().collection('users').doc(user.uid).get();
    const avatarURL = userDoc.data()?.photoURL;
    
    if (!avatarURL) throw new Error('Người dùng chưa có ảnh đại diện');
    
    const localUri = `${FileSystem.cacheDirectory}user_avatar_${user.uid}_${Date.now()}.jpg`;
    const { uri } = await FileSystem.downloadAsync(avatarURL, localUri);
    
    return uri;
  } catch (error) {
    console.error('Lỗi tải ảnh đại diện:', error);
    throw error;
  }
};

/**
 * So sánh hai khuôn mặt để tìm độ tương đồng
 */
export const compareFaces = (capturedFace: FaceDetectionResult, avatarFace: FaceDetectionResult): number => {
  if (!capturedFace.faces.length || !avatarFace.faces.length) {
    return 0;
  }
  
  const face1 = capturedFace.faces[0];
  const face2 = avatarFace.faces[0];
  
  const scores: SimilarityScores = {
    boundsSimilarity: 0,
    rollSimilarity: 0,
    yawSimilarity: 0,
    landmarkSimilarity: 0.8,
    classificationSimilarity: 0.8,
    sizeSimilarity: 0
  };
  
  // 1. So sánh tỷ lệ khuôn mặt
  const face1Ratio = face1.bounds.size.width / face1.bounds.size.height;
  const face2Ratio = face2.bounds.size.width / face2.bounds.size.height;
  scores.boundsSimilarity = 1 - Math.min(Math.abs(face1Ratio - face2Ratio) / Math.max(face1Ratio, face2Ratio), 1);
  
  // 2. So sánh góc nghiêng
  scores.rollSimilarity = face1.rollAngle !== undefined && face2.rollAngle !== undefined 
    ? 1 - Math.min(Math.abs(face1.rollAngle - face2.rollAngle) / 180, 1)
    : 0.5;
  scores.yawSimilarity = face1.yawAngle !== undefined && face2.yawAngle !== undefined
    ? 1 - Math.min(Math.abs(face1.yawAngle - face2.yawAngle) / 180, 1)
    : 0.5;
  
  // 3. So sánh landmarks
  if (face1.landmarks && face2.landmarks) {
    const landmarks1 = normalizeLandmarks(face1);
    const landmarks2 = normalizeLandmarks(face2);
    
    if (landmarks1 && landmarks2) {
      let landmarkDiffs: number[] = [];
      const keyPoints = ['leftEye', 'rightEye', 'leftCheek', 'rightCheek', 'nose', 'mouth'];
      
      for (const point of keyPoints) {
        if (landmarks1[point] && landmarks2[point]) {
          const diff = Math.sqrt(
            Math.pow(landmarks1[point].x - landmarks2[point].x, 2) +
            Math.pow(landmarks1[point].y - landmarks2[point].y, 2)
          );
          landmarkDiffs.push(diff);
        }
      }
      
      if (landmarkDiffs.length > 0) {
        const avgDiff = landmarkDiffs.reduce((sum, diff) => sum + diff, 0) / landmarkDiffs.length;
        scores.landmarkSimilarity = 1 - Math.min(avgDiff, 1);
      }
    }
  }
  
  // 4. So sánh smile
  if (face1.smilingProbability !== undefined && face2.smilingProbability !== undefined) {
    scores.smileSimilarity = 1 - Math.abs(face1.smilingProbability - face2.smilingProbability);
  }
  
  // 5. So sánh kích thước
  const face1RelativeSize = (face1.bounds.size.width * face1.bounds.size.height) / 
                           (capturedFace.image.width * capturedFace.image.height);
  const face2RelativeSize = (face2.bounds.size.width * face2.bounds.size.height) / 
                           (avatarFace.image.width * avatarFace.image.height);
  scores.sizeSimilarity = 1 - Math.min(Math.abs(face1RelativeSize - face2RelativeSize) / 
                                      Math.max(face1RelativeSize, face2RelativeSize), 1);
  
  // Tính điểm tổng hợp với trọng số
  const weights = {
    boundsSimilarity: 0.2,
    rollSimilarity: 0.1,
    yawSimilarity: 0.1,
    landmarkSimilarity: 0.3,
    classificationSimilarity: 0.1,
    sizeSimilarity: 0.2
  };
  
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const [key, score] of Object.entries(scores)) {
    if (score !== undefined && weights[key as keyof typeof weights] !== undefined) {
      totalScore += score * weights[key as keyof typeof weights];
      totalWeight += weights[key as keyof typeof weights];
    }
  }
  
  const normalizedScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  const boostedScore = normalizedScore < 0.7 
    ? normalizedScore 
    : 0.7 + (normalizedScore - 0.7) * (1 / 0.3);
  
  return Math.max(0, Math.min(1, boostedScore));
};

/**
 * Chuẩn hóa vị trí các điểm đặc trưng để so sánh
 */
const normalizeLandmarks = (face: FaceFeature): { [key: string]: { x: number; y: number } } => {
  const landmarks: { [key: string]: { x: number; y: number } } = {};
  const faceWidth = face.bounds.size.width;
  const faceHeight = face.bounds.size.height;
  const faceOriginX = face.bounds.origin.x;
  const faceOriginY = face.bounds.origin.y;
  
  // Chuyển đổi tọa độ tuyệt đối thành tọa độ tương đối
  for (const key in face.landmarks) {
    if (face.landmarks[key]) {
      landmarks[key] = {
        x: (face.landmarks[key].x - faceOriginX) / faceWidth,
        y: (face.landmarks[key].y - faceOriginY) / faceHeight
      };
    }
  }
  
  return landmarks;
};

/**
 * Xác minh khuôn mặt
 */
export const verifyFaceMatch = async (capturedImageUri: string): Promise<VerificationResult> => {
  try {
    console.log('Bắt đầu quá trình xác minh khuôn mặt');
    
    const capturedFaceResult = await detectFace(capturedImageUri);
    const avatarUri = await downloadUserAvatar();
    const avatarFaceResult = await detectFace(avatarUri);
    
    const similarityScore = compareFaces(capturedFaceResult, avatarFaceResult);
    const isMatch = similarityScore >= SIMILARITY_THRESHOLD;
    
    console.log(`Kết quả so sánh: Điểm = ${similarityScore.toFixed(2)}, Khớp = ${isMatch}`);
    
    return {
      isMatch,
      score: similarityScore,
      error: null,
      debug: {
        capturedFace: capturedFaceResult.faces[0],
        avatarFace: avatarFaceResult.faces[0]
      }
    };
  } catch (error) {
    console.error('Lỗi xác minh khuôn mặt:', error);
    return {
      isMatch: false,
      score: 0,
      error: error instanceof Error ? error.message : 'Lỗi không xác định'
    };
  }
};

/**
 * Phương pháp dự phòng: So sánh ảnh trực tiếp bằng phương pháp đơn giản
 * Sử dụng khi phương pháp nhận diện khuôn mặt thất bại
 */
export const compareImagesDirect = async (image1Uri: string, image2Uri: string): Promise<number> => {
  try {
    // Chuẩn hóa cả hai ảnh về cùng kích thước
    const size = { width: 100, height: 100 };
    
    const processedImage1 = await ImageManipulator.manipulateAsync(
      image1Uri,
      [{ resize: size }],
      { format: ImageManipulator.SaveFormat.JPEG }
    );
    
    const processedImage2 = await ImageManipulator.manipulateAsync(
      image2Uri,
      [{ resize: size }],
      { format: ImageManipulator.SaveFormat.JPEG }
    );
    
    // Tính toán độ tương đồng đơn giản dựa trên kích thước file
    // Đây chỉ là phương pháp dự phòng, không chính xác như so sánh khuôn mặt
    const file1 = await FileSystem.getInfoAsync(processedImage1.uri);
    const file2 = await FileSystem.getInfoAsync(processedImage2.uri);
    
    if (!file1.exists || !file2.exists) return 0.5;
    
    const sizeDiff = Math.abs((file1.size || 0) - (file2.size || 0));
    const maxSize = Math.max(file1.size || 0, file2.size || 0);
    const similarity = 1 - (sizeDiff / maxSize);
    
    return Math.min(Math.max(similarity, 0), 1);
  } catch (error) {
    console.error('Lỗi so sánh ảnh trực tiếp:', error);
    return 0.5; // Giá trị mặc định khi có lỗi
  }
}

export default detectFace;
