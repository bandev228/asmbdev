import React, { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Platform,
  StatusBar,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Switch,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { getAuth, updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, linkWithCredential, unlink } from "@react-native-firebase/auth"
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from "@react-native-firebase/firestore"
import storage from '@react-native-firebase/storage'
import * as ImagePicker from "expo-image-picker"
import * as ImageManipulator from 'expo-image-manipulator'
import { useRouter } from "expo-router"
import * as FileSystem from "expo-file-system"
import * as LocalAuthentication from "expo-local-authentication"
import { LinearGradient } from "expo-linear-gradient"
import { BlurView } from "expo-blur"

const { width } = Dimensions.get("window")
const isTablet = width > 768

interface UserProfile {
  displayName: string
  email: string
  photoURL: string
  studentId: string
  department: string
  role: "Admin" | "Lecturer" | "Student"
  points: number
  eventsJoined: number
  isGoogleLinked: boolean
  biometricEnabled: boolean
}

const StudentTaiKhoan = () => {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [updatedUser, setUpdatedUser] = useState<Partial<UserProfile>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const auth = getAuth()
  const db = getFirestore()

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(50)).current
  const scaleAnim = useRef(new Animated.Value(0.95)).current

  useEffect(() => {
    startAnimation()
    fetchUserData()
    checkBiometricAvailability()
  }, [])

  const startAnimation = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const checkBiometricAvailability = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync()
    const enrolled = await LocalAuthentication.isEnrolledAsync()
    setBiometricAvailable(compatible && enrolled)
  }

  const fetchUserData = async () => {
    try {
      setLoading(true)
      const currentUser = auth.currentUser

      if (!currentUser) {
        throw new Error("Người dùng chưa đăng nhập")
      }

      const userDoc = await getDoc(doc(db, "users", currentUser.uid))

      if (userDoc.exists) {
        const userData = userDoc.data() as UserProfile
        setUser({
          displayName: userData.displayName || currentUser.displayName || "",
          email: userData.email || currentUser.email || "",
          photoURL: userData.photoURL || currentUser.photoURL || "",
          studentId: userData.studentId || "",
          department: userData.department || "",
          role: userData.role || "Student",
          points: userData.points || 0,
          eventsJoined: userData.eventsJoined || 0,
          isGoogleLinked: userData.isGoogleLinked || false,
          biometricEnabled: userData.biometricEnabled || false,
        })
      }
    } catch (err) {
      console.error("Error fetching user data:", err)
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi khi tải dữ liệu")
    } finally {
      setLoading(false)
    }
  }

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
      
      if (!permissionResult.granted) {
        Alert.alert(
          "Cần quyền truy cập", 
          "Vui lòng cấp quyền truy cập thư viện ảnh để thay đổi ảnh đại diện"
        )
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        allowsMultipleSelection: false,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri
        await uploadImage(imageUri)
      }
    } catch (err) {
      console.error("Error picking image:", err)
      Alert.alert(
        "Lỗi",
        "Không thể chọn ảnh. Vui lòng thử lại."
      )
    }
  }

  const uploadImage = async (uri: string) => {
    try {
      // Confirm with user about face recognition usage
      const userConfirmed = await new Promise((resolve) => {
        Alert.alert(
          "Xác nhận cập nhật ảnh đại diện",
          "Ảnh này sẽ được sử dụng làm ảnh đại diện và dùng cho nhận diện khuôn mặt khi điểm danh. Bạn có muốn tiếp tục?",
          [
            {
              text: "Hủy",
              style: "cancel",
              onPress: () => resolve(false)
            },
            {
              text: "Đồng ý",
              onPress: () => resolve(true)
            }
          ]
        );
      });

      if (!userConfirmed) {
        return;
      }

      setLoading(true);

      // Resize and compress image
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 500, height: 500 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Upload to Firebase Storage
      const filename = `avatars/${auth.currentUser?.uid}/profile-${Date.now()}.jpg`;
      const reference = storage().ref(filename);
      
      // Upload the file
      await reference.putFile(manipulatedImage.uri);
      const downloadURL = await reference.getDownloadURL();

      // Update user profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          photoURL: downloadURL
        });

        // Update Firestore document
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          photoURL: downloadURL,
          lastAvatarUpdate: serverTimestamp()
        });

        Alert.alert(
          "Thành công",
          "Cập nhật ảnh đại diện thành công!"
        );
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert(
        "Lỗi",
        "Không thể cập nhật ảnh đại diện. Vui lòng thử lại sau."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return

    try {
      setIsSaving(true)
      const currentUser = auth.currentUser

      if (!currentUser) {
        throw new Error("Người dùng chưa đăng nhập")
      }

      if (updatedUser.displayName) {
        await updateProfile(currentUser, {
          displayName: updatedUser.displayName
        })
      }

      await updateDoc(doc(db, "users", currentUser.uid), {
        ...updatedUser
      })

      setUser({
        ...user,
        ...updatedUser
      })
      setUpdatedUser({})
      setEditMode(false)

      Alert.alert("Thành công", "Thông tin tài khoản đã được cập nhật")
    } catch (err) {
      console.error("Error updating profile:", err)
      Alert.alert("Lỗi", "Không thể cập nhật thông tin. Vui lòng thử lại.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const user = auth.currentUser
      if (!user || !user.email) return

      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPassword)
      Alert.alert("Thành công", "Mật khẩu đã được cập nhật")
    } catch (err) {
      console.error("Error changing password:", err)
      Alert.alert("Lỗi", "Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại.")
    }
  }

  const handleToggleBiometric = async () => {
    if (!user) return

    try {
      if (!user.biometricEnabled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Xác thực để bật đăng nhập sinh trắc học",
        })

        if (!result.success) {
          throw new Error("Xác thực thất bại")
        }
      }

      await updateDoc(doc(db, "users", auth.currentUser!.uid), {
        biometricEnabled: !user.biometricEnabled
      })

      setUser({
        ...user,
        biometricEnabled: !user.biometricEnabled
      })

      Alert.alert(
        "Thành công",
        `Đăng nhập sinh trắc học đã được ${user.biometricEnabled ? "tắt" : "bật"}`
      )
    } catch (err) {
      console.error("Error toggling biometric:", err)
      Alert.alert("Lỗi", "Không thể thay đổi cài đặt sinh trắc học")
    }
  }

  const handleLogout = async () => {
    Alert.alert(
      "Đăng xuất",
      "Bạn có chắc chắn muốn đăng xuất?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đăng xuất",
          style: "destructive",
          onPress: async () => {
            try {
              await auth.signOut()
              router.replace("/(auth)/login")
            } catch (err) {
              console.error("Error signing out:", err)
              Alert.alert("Lỗi", "Không thể đăng xuất. Vui lòng thử lại.")
            }
          }
        }
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tài khoản</Text>
        <TouchableOpacity onPress={() => setEditMode(!editMode)} style={styles.editButton}>
          <Ionicons name={editMode ? "checkmark" : "create-outline"} size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View 
          style={[
            styles.profileSection,
            { 
              opacity: fadeAnim,
              transform: [{ translateY }, { scale: scaleAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={['#E3F2FD', '#BBDEFB']}
            style={styles.avatarContainer}
          >
            <TouchableOpacity onPress={handlePickImage} style={styles.avatarWrapper}>
              {user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={48} color="#6C757D" />
                </View>
              )}
              <View style={styles.avatarEditButton}>
                <Ionicons name="camera" size={18} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role}</Text>
          </View>

          {editMode ? (
            <TextInput
              style={styles.nameInput}
              value={updatedUser.displayName ?? user?.displayName}
              onChangeText={(text) => setUpdatedUser({ ...updatedUser, displayName: text })}
              placeholder="Nhập tên của bạn"
            />
          ) : (
            <Text style={styles.userName}>{user?.displayName}</Text>
          )}
          <Text style={styles.userEmail}>{user?.email}</Text>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.eventsJoined || 0}</Text>
              <Text style={styles.statLabel}>Sự kiện đã tham gia</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.points || 0}</Text>
              <Text style={styles.statLabel}>Điểm tích lũy</Text>
            </View>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Mã số sinh viên</Text>
              {editMode ? (
                <TextInput
                  style={styles.infoInput}
                  value={updatedUser.email ?? user?.email}
                  onChangeText={(text) => setUpdatedUser({ ...updatedUser, email: text })}
                  placeholder="Nhập MSSV"
                />
              ) : (
                <Text style={styles.infoValue}>{user?.email || "Chưa cập nhật"}</Text>
              )}
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Khoa/Ngành</Text>
              {editMode ? (
                <TextInput
                  style={styles.infoInput}
                  value={updatedUser.department ?? user?.department}
                  onChangeText={(text) => setUpdatedUser({ ...updatedUser, department: text })}
                  placeholder="Nhập khoa/ngành"
                />
              ) : (
                <Text style={styles.infoValue}>{user?.department || "Chưa cập nhật"}</Text>
              )}
            </View>
          </View>

          {editMode && (
            <TouchableOpacity style={styles.saveButton} onPress={handleUpdateProfile}>
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>

        <View style={styles.settingsSection}>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              Alert.prompt(
                "Đổi mật khẩu",
                "Nhập mật khẩu hiện tại",
                [
                  { text: "Hủy", style: "cancel" },
                  {
                    text: "Tiếp tục",
                    onPress: (currentPassword) => {
                      if (!currentPassword) return
                      Alert.prompt(
                        "Đổi mật khẩu",
                        "Nhập mật khẩu mới",
                        [
                          { text: "Hủy", style: "cancel" },
                          {
                            text: "Cập nhật",
                            onPress: (newPassword) => {
                              if (!newPassword) return
                              handleChangePassword(currentPassword, newPassword)
                            }
                          }
                        ],
                        "secure-text"
                      )
                    }
                  }
                ],
                "secure-text"
              )
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="key-outline" size={24} color="#007AFF" />
              <Text style={styles.settingText}>Đổi mật khẩu</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>

          {biometricAvailable && (
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Ionicons name="finger-print-outline" size={24} color="#007AFF" />
                <Text style={styles.settingText}>Đăng nhập sinh trắc học</Text>
              </View>
              <Switch
                value={user?.biometricEnabled}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: "#E9ECEF", true: "#007AFF" }}
                thumbColor="#FFFFFF"
              />
            </View>
          )}

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="logo-google" size={24} color="#007AFF" />
              <Text style={styles.settingText}>Liên kết Google</Text>
            </View>
            <Text style={styles.googleStatus}>
              {user?.isGoogleLinked ? "Đã liên kết" : "Chưa liên kết"}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <View style={styles.logoutButtonContent}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F8F9FA",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F8F9FA",
  },
  content: {
    flex: 1,
    paddingTop: 24,
  },
  profileSection: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    marginHorizontal: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: "center",
    marginBottom: 20,
    overflow: "hidden",
  },
  avatarWrapper: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatarPlaceholder: {
    backgroundColor: "#E9ECEF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarEditButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#007AFF",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  roleBadge: {
    position: "absolute",
    top: 24,
    right: 24,
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#007AFF",
  },
  nameInput: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1A1A1A",
    textAlign: "center",
    padding: 12,
    width: "100%",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    marginBottom: 8,
  },
  userName: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 4,
    textAlign: "center",
  },
  userEmail: {
    fontSize: 16,
    color: "#6C757D",
    marginBottom: 24,
    textAlign: "center",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "600",
    color: "#007AFF",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "#6C757D",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#E9ECEF",
    marginHorizontal: 16,
  },
  infoSection: {
    width: "100%",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
  },
  infoItem: {
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 14,
    color: "#6C757D",
    marginBottom: 6,
    fontWeight: "500",
  },
  infoInput: {
    fontSize: 16,
    color: "#1A1A1A",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E9ECEF",
  },
  infoValue: {
    fontSize: 16,
    color: "#1A1A1A",
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
    width: "100%",
    alignItems: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  settingsSection: {
    backgroundColor: "#FFFFFF",
    marginTop: 24,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
  },
  settingContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingText: {
    fontSize: 16,
    marginLeft: 12,
    color: "#1A1A1A",
    fontWeight: "500",
  },
  googleStatus: {
    fontSize: 14,
    color: "#6C757D",
  },
  logoutButton: {
    backgroundColor: "#FFFFFF",
    marginTop: 24,
    marginHorizontal: 16,
    marginBottom: 32,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  logoutButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  logoutText: {
    fontSize: 16,
    color: "#FF3B30",
    fontWeight: "600",
    marginLeft: 8,
  },
})

export default StudentTaiKhoan
