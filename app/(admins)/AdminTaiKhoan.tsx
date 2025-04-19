import { useState, useEffect, useRef } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Switch, TextInput, Platform, StatusBar, Animated, Dimensions, ActivityIndicator, Alert, KeyboardAvoidingView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { getAuth, updateProfile } from "@react-native-firebase/auth"
import { getFirestore, doc, updateDoc, collection, addDoc, getDoc } from "@react-native-firebase/firestore"
import * as ImagePicker from "expo-image-picker"
import { useRouter } from "expo-router"
import * as LocalAuthentication from 'expo-local-authentication'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTheme } from '../context/ThemeContext'

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

const TaiKhoanAdmin = () => {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { theme, toggleTheme, isDarkMode } = useTheme()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [updatedUser, setUpdatedUser] = useState<Partial<UserProfile>>({})
  const [activeSection, setActiveSection] = useState("profile")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false)
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false)

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(50)).current
  const scaleAnim = useRef(new Animated.Value(0.95)).current

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.colors.text,
    },
    errorContainer: {
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text,
      marginTop: 16,
    },
    errorMessage: {
      fontSize: 16,
      color: theme.colors.text,
      textAlign: "center",
      marginTop: 8,
      marginBottom: 24,
    },
    retryButton: {
      backgroundColor: theme.colors.primary,
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#333' : '#E5E9F0',
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDarkMode ? '#333' : '#F0F4F8',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
    },
    headerRight: {
      width: 40,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    section: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: isDarkMode ? '#000' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0.3 : 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 16,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    avatarContainer: {
      position: 'relative',
      marginRight: 16,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    avatarPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    editAvatarButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    profileEmail: {
      fontSize: 14,
      color: theme.colors.text,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#333' : '#F0F0F0',
    },
    settingInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    settingLabel: {
      fontSize: 16,
      color: theme.colors.text,
      marginLeft: 12,
    },
  })

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
    checkBiometricAvailability()
    loadBiometricStatus()
  }, [])

  const fetchUserData = async () => {
    try {
      setLoading(true)
      const auth = getAuth()
      const currentUser = auth.currentUser

      if (!currentUser) {
        throw new Error("Người dùng chưa đăng nhập")
      }

      const db = getFirestore()
      const userDocRef = doc(db, "users", currentUser.uid)
      const userDoc = await getDoc(userDocRef)

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
        await addDoc(collection(db, "users"), {
          ...defaultProfile,
          uid: currentUser.uid,
        })
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
      const auth = getAuth()
      const currentUser = auth.currentUser

      if (!currentUser) {
        throw new Error("Người dùng chưa đăng nhập")
      }

      // Update display name in Auth if changed
      if (updatedUser.displayName && updatedUser.displayName !== user.displayName) {
        await updateProfile(currentUser, {
          displayName: updatedUser.displayName,
        })
      }

      // Update user document in Firestore
      const db = getFirestore()
      await updateDoc(doc(db, "users", currentUser.uid), {
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
            const auth = getAuth()
            await auth.signOut()
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
              const auth = getAuth()
              const currentUser = auth.currentUser

              if (!currentUser) {
                throw new Error("Người dùng chưa đăng nhập")
              }

              // Delete user data from Firestore
              const db = getFirestore()
              await doc(db, "users", currentUser.uid).delete()

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
              const auth = getAuth()
              await auth.sendPasswordResetEmail(email)
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

  const toggleSwitch = (field: keyof UserProfile | keyof UserProfile['privacySettings'], section?: string) => {
    if (!user) return

    if (section === "privacy") {
      setUpdatedUser({
        ...updatedUser,
        privacySettings: {
          ...user.privacySettings,
          ...updatedUser.privacySettings,
          [field]: !(updatedUser.privacySettings?.[field as keyof UserProfile['privacySettings']] ?? user.privacySettings[field as keyof UserProfile['privacySettings']]),
        },
      })
    } else {
      setUpdatedUser({
        ...updatedUser,
        [field]: !(updatedUser[field as keyof UserProfile] ?? user[field as keyof UserProfile]),
      })
    }
  }

  const checkBiometricAvailability = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync()
    const enrolled = await LocalAuthentication.isEnrolledAsync()
    setIsBiometricAvailable(compatible && enrolled)
  }

  const loadBiometricStatus = async () => {
    try {
      const status = await AsyncStorage.getItem('biometricEnabled')
      setIsBiometricEnabled(status === 'true')
    } catch (error) {
      console.error('Error loading biometric status:', error)
    }
  }

  const toggleBiometric = async () => {
    if (!isBiometricAvailable) {
      Alert.alert('Thông báo', 'Thiết bị của bạn không hỗ trợ hoặc chưa đăng ký sinh trắc học')
      return
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Xác thực sinh trắc học',
        fallbackLabel: 'Sử dụng mật khẩu',
      })

      if (result.success) {
        const newStatus = !isBiometricEnabled
        setIsBiometricEnabled(newStatus)
        await AsyncStorage.setItem('biometricEnabled', String(newStatus))
        
        if (newStatus) {
          // Lưu thông tin đăng nhập khi bật sinh trắc học
          const currentUser = getAuth().currentUser
          if (currentUser?.email) {
            await AsyncStorage.setItem('savedEmail', currentUser.email)
          }
        } else {
          // Xóa thông tin đăng nhập khi tắt sinh trắc học
          await AsyncStorage.removeItem('savedEmail')
        }
      }
    } catch (error) {
      console.error('Biometric authentication error:', error)
      Alert.alert('Lỗi', 'Không thể xác thực sinh trắc học')
    }
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
    >
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={theme.colors.background} 
      />
      
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tài khoản</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View style={styles.section}>
          <View style={styles.profileHeader}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={handlePickImage}
            >
              {user?.photoURL ? (
                <Image 
                  source={{ uri: user.photoURL }} 
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color="#FFFFFF" />
                </View>
              )}
              <View style={styles.editAvatarButton}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user?.displayName || "Chưa cập nhật"}
              </Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cài đặt</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={24} color={theme.colors.primary} />
              <Text style={styles.settingLabel}>Thông báo</Text>
            </View>
            <Switch
              value={user?.notificationsEnabled}
              onValueChange={() => toggleSwitch("notificationsEnabled")}
              trackColor={{ false: '#767577', true: theme.colors.primary }}
              thumbColor={user?.notificationsEnabled ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="moon-outline" size={24} color={theme.colors.primary} />
              <Text style={styles.settingLabel}>Chế độ tối</Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#767577', true: theme.colors.primary }}
              thumbColor={isDarkMode ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quyền riêng tư</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="mail-outline" size={24} color="#6C5CE7" />
              <Text style={styles.settingLabel}>Hiển thị email</Text>
            </View>
            <Switch
              value={user?.privacySettings?.showEmail}
              onValueChange={() => toggleSwitch("showEmail", "privacy")}
              trackColor={{ false: '#767577', true: '#6C5CE7' }}
              thumbColor={user?.privacySettings?.showEmail ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="call-outline" size={24} color="#6C5CE7" />
              <Text style={styles.settingLabel}>Hiển thị số điện thoại</Text>
            </View>
            <Switch
              value={user?.privacySettings?.showPhone}
              onValueChange={() => toggleSwitch("showPhone", "privacy")}
              trackColor={{ false: '#767577', true: '#6C5CE7' }}
              thumbColor={user?.privacySettings?.showPhone ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bảo mật</Text>
          
          {isBiometricAvailable && (
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="finger-print" size={24} color="#6C5CE7" />
                <Text style={styles.settingLabel}>Đăng nhập bằng sinh trắc học</Text>
              </View>
              <Switch
                value={isBiometricEnabled}
                onValueChange={toggleBiometric}
                trackColor={{ false: '#767577', true: '#6C5CE7' }}
                thumbColor={isBiometricEnabled ? '#FFFFFF' : '#f4f3f4'}
              />
            </View>
          )}

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleChangePassword}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="key-outline" size={24} color="#6C5CE7" />
              <Text style={styles.settingLabel}>Đổi mật khẩu</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleLogout}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
              <Text style={[styles.settingLabel, { color: '#FF3B30' }]}>
                Đăng xuất
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

export default TaiKhoanAdmin
