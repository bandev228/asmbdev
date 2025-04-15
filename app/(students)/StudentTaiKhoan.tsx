import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Switch,
  TextInput,
  Platform,
  StatusBar,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import auth from "@react-native-firebase/auth"
import firestore from "@react-native-firebase/firestore"
import * as ImagePicker from "expo-image-picker"
import { useRouter } from "expo-router"

const { width } = Dimensions.get("window")
const isTablet = width > 768

interface UserProfile {
  displayName: string
  email: string
  photoURL: string
  phoneNumber: string
  studentId: string
  department: string
  notificationsEnabled: boolean
  darkModeEnabled: boolean
  biometricEnabled: boolean
  privacySettings: {
    showEmail: boolean
    showPhone: boolean
    showActivities: boolean
  }
}

const AccountManagementScreen = () => {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [updatedUser, setUpdatedUser] = useState<Partial<UserProfile>>({})
  const [activeSection, setActiveSection] = useState("profile")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(50)).current
  const scaleAnim = useRef(new Animated.Value(0.95)).current

  useEffect(() => {
    // Start entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start()

    // Fetch user data
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      setLoading(true)
      const currentUser = auth().currentUser

      if (!currentUser) {
        throw new Error("Người dùng chưa đăng nhập")
      }

      const userDoc = await firestore().collection("users").doc(currentUser.uid).get()

      if (userDoc.exists) {
        const userData = userDoc.data() as UserProfile
        setUser({
          displayName: userData.displayName || currentUser.displayName || "",
          email: userData.email || currentUser.email || "",
          photoURL: userData.photoURL || currentUser.photoURL || "",
          phoneNumber: userData.phoneNumber || currentUser.phoneNumber || "",
          studentId: userData.studentId || "",
          department: userData.department || "",
          notificationsEnabled: userData.notificationsEnabled !== undefined ? userData.notificationsEnabled : true,
          darkModeEnabled: userData.darkModeEnabled || false,
          biometricEnabled: userData.biometricEnabled || false,
          privacySettings: userData.privacySettings || {
            showEmail: true,
            showPhone: false,
            showActivities: true,
          },
        })
        setUpdatedUser({})
      } else {
        // Create default user profile if it doesn't exist
        const defaultProfile: UserProfile = {
          displayName: currentUser.displayName || "",
          email: currentUser.email || "",
          photoURL: currentUser.photoURL || "",
          phoneNumber: currentUser.phoneNumber || "",
          studentId: "",
          department: "",
          notificationsEnabled: true,
          darkModeEnabled: false,
          biometricEnabled: false,
          privacySettings: {
            showEmail: true,
            showPhone: false,
            showActivities: true,
          },
        }

        setUser(defaultProfile)

        // Save default profile to Firestore
        await firestore().collection("users").doc(currentUser.uid).set(defaultProfile, { merge: true })
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
      const currentUser = auth().currentUser

      if (!currentUser) {
        throw new Error("Người dùng chưa đăng nhập")
      }

      // Update display name in Auth if changed
      if (updatedUser.displayName && updatedUser.displayName !== user.displayName) {
        await currentUser.updateProfile({
          displayName: updatedUser.displayName,
        })
      }

      // Update user document in Firestore
      await firestore()
        .collection("users")
        .doc(currentUser.uid)
        .update({
          ...updatedUser,
        })

      // Update local state
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

        // In a real app, you would upload this image to storage
        // For now, we'll just update the photoURL in the state
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
            await auth().signOut()
            router.replace("/(auth)/login")
          } catch (err) {
            console.error("Error signing out:", err)
            Alert.alert("Lỗi", "Không thể đăng xuất. Vui lòng thử lại.")
          }
        },
      },
    ])
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      "Xóa tài khoản",
      "Bạn có chắc chắn muốn xóa tài khoản? Hành động này không thể hoàn tác và tất cả dữ liệu của bạn sẽ bị xóa vĩnh viễn.",
      [
        {
          text: "Hủy",
          style: "cancel",
        },
        {
          text: "Xóa tài khoản",
          style: "destructive",
          onPress: async () => {
            try {
              const currentUser = auth().currentUser

              if (!currentUser) {
                throw new Error("Người dùng chưa đăng nhập")
              }

              // Delete user data from Firestore
              await firestore().collection("users").doc(currentUser.uid).delete()

              // Delete user account
              await currentUser.delete()

              router.replace("/(auth)/login")
            } catch (err) {
              console.error("Error deleting account:", err)
              Alert.alert(
                "Lỗi",
                "Không thể xóa tài khoản. Bạn có thể cần đăng nhập lại trước khi thực hiện hành động này.",
                [
                  {
                    text: "OK",
                  },
                  {
                    text: "Đăng nhập lại",
                    onPress: handleLogout,
                  },
                ],
              )
            }
          },
        },
      ],
    )
  }

  const handleChangePassword = () => {
    Alert.prompt(
      "Đổi mật khẩu",
      "Nhập địa chỉ email của bạn để nhận liên kết đặt lại mật khẩu",
      [
        {
          text: "Hủy",
          style: "cancel",
        },
        {
          text: "Gửi",
          onPress: async (email) => {
            if (!email) {
              Alert.alert("Lỗi", "Vui lòng nhập địa chỉ email")
              return
            }

            try {
              await auth().sendPasswordResetEmail(email)
              Alert.alert("Thành công", "Liên kết đặt lại mật khẩu đã được gửi đến email của bạn")
            } catch (err) {
              console.error("Error sending password reset email:", err)
              Alert.alert("Lỗi", "Không thể gửi email đặt lại mật khẩu. Vui lòng kiểm tra lại địa chỉ email.")
            }
          },
        },
      ],
      "plain-text",
      user?.email || "",
    )
  }

  const toggleSwitch = (field: string, section?: string) => {
    if (!user) return

    if (section === "privacy") {
      setUpdatedUser({
        ...updatedUser,
        privacySettings: {
          ...user.privacySettings,
          ...updatedUser.privacySettings,
          [field]: !(updatedUser.privacySettings?.[field] ?? user.privacySettings[field]),
        },
      })
    } else {
      setUpdatedUser({
        ...updatedUser,
        [field]: !(updatedUser[field] ?? user[field]),
      })
    }
  }

  const renderProfileSection = () => {
    if (!user) return null

    const displayName = updatedUser.displayName ?? user.displayName
    const email = updatedUser.email ?? user.email
    const phoneNumber = updatedUser.phoneNumber ?? user.phoneNumber
    const studentId = updatedUser.studentId ?? user.studentId
    const department = updatedUser.department ?? user.department
    const photoURL = updatedUser.photoURL ?? user.photoURL

    return (
      <Animated.View
        style={[
          styles.sectionContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.profileHeader}>
          <TouchableOpacity
            style={styles.profileImageContainer}
            onPress={editMode ? handlePickImage : undefined}
            activeOpacity={editMode ? 0.7 : 1}
          >
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                <Ionicons name="person" size={50} color="#FFFFFF" />
              </View>
            )}
            {editMode && (
              <View style={styles.editImageButton}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            {editMode ? (
              <TextInput
                style={styles.nameInput}
                value={displayName}
                onChangeText={(text) => setUpdatedUser({ ...updatedUser, displayName: text })}
                placeholder="Nhập tên của bạn"
                placeholderTextColor="#999"
              />
            ) : (
              <Text style={styles.profileName}>{displayName || "Chưa cập nhật"}</Text>
            )}
            <Text style={styles.profileEmail}>{email}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Mã số sinh viên</Text>
          {editMode ? (
            <TextInput
              style={styles.formInput}
              value={studentId}
              onChangeText={(text) => setUpdatedUser({ ...updatedUser, studentId: text })}
              placeholder="Nhập mã số sinh viên"
              placeholderTextColor="#999"
              keyboardType="number-pad"
            />
          ) : (
            <Text style={styles.formValue}>{studentId || "Chưa cập nhật"}</Text>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Khoa/Ngành</Text>
          {editMode ? (
            <TextInput
              style={styles.formInput}
              value={department}
              onChangeText={(text) => setUpdatedUser({ ...updatedUser, department: text })}
              placeholder="Nhập khoa/ngành của bạn"
              placeholderTextColor="#999"
            />
          ) : (
            <Text style={styles.formValue}>{department || "Chưa cập nhật"}</Text>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Số điện thoại</Text>
          {editMode ? (
            <TextInput
              style={styles.formInput}
              value={phoneNumber}
              onChangeText={(text) => setUpdatedUser({ ...updatedUser, phoneNumber: text })}
              placeholder="Nhập số điện thoại"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.formValue}>{phoneNumber || "Chưa cập nhật"}</Text>
          )}
        </View>

        {editMode && (
          <View style={styles.actionButtons}>
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
        )}

        {!editMode && (
          <TouchableOpacity style={styles.editButton} onPress={() => setEditMode(true)}>
            <Ionicons name="create-outline" size={18} color="#FFFFFF" />
            <Text style={styles.editButtonText}>Chỉnh sửa thông tin</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    )
  }

  const renderSettingsSection = () => {
    if (!user) return null

    const notificationsEnabled = updatedUser.notificationsEnabled ?? user.notificationsEnabled
    const darkModeEnabled = updatedUser.darkModeEnabled ?? user.darkModeEnabled
    const biometricEnabled = updatedUser.biometricEnabled ?? user.biometricEnabled

    return (
      <Animated.View
        style={[
          styles.sectionContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="notifications-outline" size={24} color="#007AFF" style={styles.settingIcon} />
            <Text style={styles.settingText}>Thông báo</Text>
          </View>
          <Switch
            trackColor={{ false: "#D1D1D6", true: "#4CD964" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D1D6"
            onValueChange={() => toggleSwitch("notificationsEnabled")}
            value={notificationsEnabled}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="moon-outline" size={24} color="#007AFF" style={styles.settingIcon} />
            <Text style={styles.settingText}>Chế độ tối</Text>
          </View>
          <Switch
            trackColor={{ false: "#D1D1D6", true: "#4CD964" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D1D6"
            onValueChange={() => toggleSwitch("darkModeEnabled")}
            value={darkModeEnabled}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="finger-print-outline" size={24} color="#007AFF" style={styles.settingIcon} />
            <Text style={styles.settingText}>Đăng nhập sinh trắc học</Text>
          </View>
          <Switch
            trackColor={{ false: "#D1D1D6", true: "#4CD964" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D1D6"
            onValueChange={() => toggleSwitch("biometricEnabled")}
            value={biometricEnabled}
          />
        </View>

        <TouchableOpacity style={styles.settingButton} onPress={handleSaveProfile} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.settingButtonText}>Lưu cài đặt</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    )
  }

  const renderPrivacySection = () => {
    if (!user) return null

    const privacySettings = {
      ...user.privacySettings,
      ...updatedUser.privacySettings,
    }

    return (
      <Animated.View
        style={[
          styles.sectionContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY }],
          },
        ]}
      >
        <Text style={styles.sectionDescription}>Quản lý thông tin cá nhân được hiển thị cho người dùng khác</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="mail-outline" size={24} color="#007AFF" style={styles.settingIcon} />
            <Text style={styles.settingText}>Hiển thị email</Text>
          </View>
          <Switch
            trackColor={{ false: "#D1D1D6", true: "#4CD964" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D1D6"
            onValueChange={() => toggleSwitch("showEmail", "privacy")}
            value={privacySettings.showEmail}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="call-outline" size={24} color="#007AFF" style={styles.settingIcon} />
            <Text style={styles.settingText}>Hiển thị số điện thoại</Text>
          </View>
          <Switch
            trackColor={{ false: "#D1D1D6", true: "#4CD964" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D1D6"
            onValueChange={() => toggleSwitch("showPhone", "privacy")}
            value={privacySettings.showPhone}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="calendar-outline" size={24} color="#007AFF" style={styles.settingIcon} />
            <Text style={styles.settingText}>Hiển thị hoạt động tham gia</Text>
          </View>
          <Switch
            trackColor={{ false: "#D1D1D6", true: "#4CD964" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D1D6"
            onValueChange={() => toggleSwitch("showActivities", "privacy")}
            value={privacySettings.showActivities}
          />
        </View>

        <TouchableOpacity style={styles.settingButton} onPress={handleSaveProfile} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.settingButtonText}>Lưu cài đặt</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    )
  }

  const renderSecuritySection = () => {
    return (
      <Animated.View
        style={[
          styles.sectionContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY }],
          },
        ]}
      >
        <Text style={styles.sectionDescription}>Quản lý bảo mật tài khoản và quyền truy cập</Text>

        <TouchableOpacity style={styles.securityButton} onPress={handleChangePassword}>
          <View style={styles.securityButtonContent}>
            <Ionicons name="key-outline" size={24} color="#007AFF" style={styles.securityIcon} />
            <View style={styles.securityTextContainer}>
              <Text style={styles.securityButtonText}>Đổi mật khẩu</Text>
              <Text style={styles.securityButtonDescription}>Cập nhật mật khẩu đăng nhập của bạn</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.securityButton}
          onPress={() => Alert.alert("Thông báo", "Tính năng này sẽ sớm được cập nhật")}
        >
          <View style={styles.securityButtonContent}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#007AFF" style={styles.securityIcon} />
            <View style={styles.securityTextContainer}>
              <Text style={styles.securityButtonText}>Xác thực hai yếu tố</Text>
              <Text style={styles.securityButtonDescription}>Tăng cường bảo mật cho tài khoản</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.securityButton}
          onPress={() => Alert.alert("Thông báo", "Tính năng này sẽ sớm được cập nhật")}
        >
          <View style={styles.securityButtonContent}>
            <Ionicons name="list-outline" size={24} color="#007AFF" style={styles.securityIcon} />
            <View style={styles.securityTextContainer}>
              <Text style={styles.securityButtonText}>Lịch sử đăng nhập</Text>
              <Text style={styles.securityButtonDescription}>Xem các phiên đăng nhập gần đây</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerZoneTitle}>Vùng nguy hiểm</Text>

          <TouchableOpacity style={styles.dangerButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#FF3B30" style={styles.dangerButtonIcon} />
            <Text style={styles.dangerButtonText}>Đăng xuất</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" style={styles.dangerButtonIcon} />
            <Text style={styles.dangerButtonText}>Xóa tài khoản</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    )
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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý tài khoản</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
          <TouchableOpacity
            style={[styles.tab, activeSection === "profile" && styles.activeTab]}
            onPress={() => setActiveSection("profile")}
          >
            <Ionicons name="person-outline" size={20} color={activeSection === "profile" ? "#007AFF" : "#666"} />
            <Text style={[styles.tabText, activeSection === "profile" && styles.activeTabText]}>Hồ sơ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeSection === "settings" && styles.activeTab]}
            onPress={() => setActiveSection("settings")}
          >
            <Ionicons name="settings-outline" size={20} color={activeSection === "settings" ? "#007AFF" : "#666"} />
            <Text style={[styles.tabText, activeSection === "settings" && styles.activeTabText]}>Cài đặt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeSection === "privacy" && styles.activeTab]}
            onPress={() => setActiveSection("privacy")}
          >
            <Ionicons name="eye-outline" size={20} color={activeSection === "privacy" ? "#007AFF" : "#666"} />
            <Text style={[styles.tabText, activeSection === "privacy" && styles.activeTabText]}>Quyền riêng tư</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeSection === "security" && styles.activeTab]}
            onPress={() => setActiveSection("security")}
          >
            <Ionicons name="shield-outline" size={20} color={activeSection === "security" ? "#007AFF" : "#666"} />
            <Text style={[styles.tabText, activeSection === "security" && styles.activeTabText]}>Bảo mật</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <Animated.View
        style={[
          styles.contentContainer,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {activeSection === "profile" && renderProfileSection()}
          {activeSection === "settings" && renderSettingsSection()}
          {activeSection === "privacy" && renderPrivacySection()}
          {activeSection === "security" && renderSecuritySection()}
        </ScrollView>
      </Animated.View>
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
  tabContainer: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E9F0",
  },
  tabScrollContent: {
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#F0F4F8",
  },
  activeTab: {
    backgroundColor: "#E1F0FF",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    marginLeft: 6,
  },
  activeTabText: {
    color: "#007AFF",
    fontWeight: "600",
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  sectionContainer: {
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
  sectionDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    lineHeight: 20,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  profileImageContainer: {
    position: "relative",
    marginRight: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileImagePlaceholder: {
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  editImageButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#007AFF",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1A2138",
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: "#666",
  },
  nameInput: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1A2138",
    marginBottom: 4,
    padding: 0,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E9F0",
    marginVertical: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  formValue: {
    fontSize: 16,
    color: "#1A2138",
  },
  formInput: {
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E9F0",
    color: "#1A2138",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
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
    marginTop: 16,
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E9F0",
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingIcon: {
    marginRight: 12,
  },
  settingText: {
    fontSize: 16,
    color: "#1A2138",
  },
  settingButton: {
    backgroundColor: "#007AFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  settingButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonIcon: {
    marginRight: 8,
  },
  securityButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E9F0",
  },
  securityButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  securityIcon: {
    marginRight: 12,
  },
  securityTextContainer: {
    flex: 1,
  },
  securityButtonText: {
    fontSize: 16,
    color: "#1A2138",
    fontWeight: "500",
  },
  securityButtonDescription: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  dangerZone: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#FFF5F5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFCCCC",
  },
  dangerZoneTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FF3B30",
    marginBottom: 16,
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#FFCCCC",
  },
  dangerButtonIcon: {
    marginRight: 12,
  },
  dangerButtonText: {
    fontSize: 16,
    color: "#FF3B30",
  },
})

export default AccountManagementScreen
