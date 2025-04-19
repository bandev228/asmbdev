import React, { useState, useEffect } from "react"
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
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { getAuth } from "@react-native-firebase/auth"
import { getFirestore, doc, getDoc, updateDoc } from "@react-native-firebase/firestore"
import * as ImagePicker from "expo-image-picker"
import { useRouter } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { GoogleSignin } from "@react-native-google-signin/google-signin"

interface UserProfile {
  displayName: string
  email: string
  photoURL: string
  phoneNumber: string
  department: string
}

const StaffTaiKhoan = () => {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [updatedUser, setUpdatedUser] = useState<Partial<UserProfile>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const auth = getAuth()
  const db = getFirestore()

  useEffect(() => {
    fetchUserData()
  }, [])

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
          phoneNumber: userData.phoneNumber || currentUser.phoneNumber || "",
          department: userData.department || "",
        })
        setUpdatedUser({})
      } else {
        const defaultProfile: UserProfile = {
          displayName: currentUser.displayName || "",
          email: currentUser.email || "",
          photoURL: currentUser.photoURL || "",
          phoneNumber: currentUser.phoneNumber || "",
          department: "",
        }
        setUser(defaultProfile)
        await updateDoc(doc(db, "users", currentUser.uid), defaultProfile as { [x: string]: any })
      }
    } catch (err) {
      console.error("Error fetching user data:", err)
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi khi tải dữ liệu người dùng")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) return

    try {
      setIsSaving(true)
      const currentUser = auth.currentUser

      if (!currentUser) {
        throw new Error("Người dùng chưa đăng nhập")
      }

      if (updatedUser.displayName && updatedUser.displayName !== user.displayName) {
        await currentUser.updateProfile({
          displayName: updatedUser.displayName,
        })
      }

      await updateDoc(doc(db, "users", currentUser.uid), {
        ...updatedUser,
      } as { [x: string]: any })

      setUser({
        ...user,
        ...updatedUser,
      })

      setUpdatedUser({})
      setEditMode(false)

      Alert.alert("Thành công", "Thông tin tài khoản đã được cập nhật")
    } catch (err) {
      console.error("Error updating profile:", err)
      Alert.alert("Lỗi", "Không thể cập nhật thông tin tài khoản. Vui lòng thử lại sau.")
    } finally {
      setIsSaving(false)
    }
  }

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (!permissionResult.granted) {
        Alert.alert("Cần quyền truy cập", "Vui lòng cấp quyền truy cập thư viện ảnh để thay đổi ảnh đại diện.")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri
        setUpdatedUser({
          ...updatedUser,
          photoURL: imageUri,
        })
      }
    } catch (err) {
      console.error("Error picking image:", err)
      Alert.alert("Lỗi", "Không thể chọn ảnh. Vui lòng thử lại.")
    }
  }

  const handleLogout = async () => {
    Alert.alert("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất?", [
      {
        text: "Hủy",
        style: "cancel",
      },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          try {
            // Clear local states and storage
            const storageKeys = [
              "fcmToken",
              "userSettings",
              "lastNotificationCheck",
              "cachedUserProfile",
              "activityHistory",
              "@googleSignInCredentials",
              "manager_stats",
              "pending_activities_5",
            ]

            await AsyncStorage.multiRemove(storageKeys)

            try {
              const currentUser = auth.currentUser
              if (currentUser?.providerData?.some((provider) => provider.providerId === "google.com")) {
                await GoogleSignin.signOut()
              }
            } catch (error) {
              console.warn("Google sign out error:", error)
            }

            // Sign out from Firebase
            await auth.signOut()

            // Navigate to login screen
            router.replace("/(auth)/login")
          } catch (error) {
            console.error("Error during logout:", error)
            Alert.alert("Lỗi đăng xuất", "Không thể đăng xuất hoàn toàn. Vui lòng thử lại.", [{ text: "OK" }])
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang tải thông tin tài khoản...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
        <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>Đã xảy ra lỗi</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchUserData}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      <View style={[styles.header, { paddingTop: insets.top || 20 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tài khoản</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={editMode ? handlePickImage : undefined}
            activeOpacity={editMode ? 0.7 : 1}
          >
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={40} color="#FFFFFF" />
              </View>
            )}
            {editMode && (
              <View style={styles.editAvatarButton}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            {editMode ? (
              <TextInput
                style={styles.nameInput}
                value={updatedUser.displayName ?? user?.displayName}
                onChangeText={(text) => setUpdatedUser({ ...updatedUser, displayName: text })}
                placeholder="Nhập tên của bạn"
                placeholderTextColor="#999"
              />
            ) : (
              <Text style={styles.displayName}>{user?.displayName || "Chưa cập nhật"}</Text>
            )}
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Số điện thoại</Text>
            {editMode ? (
              <TextInput
                style={styles.infoInput}
                value={updatedUser.phoneNumber ?? user?.phoneNumber}
                onChangeText={(text) => setUpdatedUser({ ...updatedUser, phoneNumber: text })}
                placeholder="Nhập số điện thoại"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.infoValue}>{user?.phoneNumber || "Chưa cập nhật"}</Text>
            )}
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Phòng/Ban</Text>
            {editMode ? (
              <TextInput
                style={styles.infoInput}
                value={updatedUser.department ?? user?.department}
                onChangeText={(text) => setUpdatedUser({ ...updatedUser, department: text })}
                placeholder="Nhập phòng/ban"
                placeholderTextColor="#999"
              />
            ) : (
              <Text style={styles.infoValue}>{user?.department || "Chưa cập nhật"}</Text>
            )}
          </View>
        </View>

        {editMode ? (
          <View style={styles.editActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => {
                setEditMode(false)
                setUpdatedUser({})
              }}
              disabled={isSaving}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.editButton} onPress={() => setEditMode(true)}>
            <Ionicons name="create-outline" size={18} color="#FFFFFF" />
            <Text style={styles.editButtonText}>Chỉnh sửa thông tin</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          <Text style={styles.logoutButtonText}>Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E9F0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F4F8",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1A2138",
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#007AFF",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  profileInfo: {
    alignItems: "center",
  },
  displayName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1A2138",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: "#666",
  },
  nameInput: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1A2138",
    marginBottom: 4,
    textAlign: "center",
  },
  infoSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  infoItem: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 16,
    color: "#1A2138",
  },
  infoInput: {
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E9F0",
    color: "#1A2138",
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#F0F4F8",
    marginRight: 8,
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#007AFF",
    marginLeft: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  editButton: {
    backgroundColor: "#007AFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#FFCCCC",
  },
  logoutButtonText: {
    color: "#FF3B30",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
})

export default StaffTaiKhoan
