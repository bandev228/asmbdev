import { useState, useCallback, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  Platform,
  StatusBar,
  FlatList,
  Image,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { getAuth } from "@react-native-firebase/auth"
import { useRouter } from "expo-router"
import { GoogleSignin } from "@react-native-google-signin/google-signin"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { getFirestore, collection, doc, getDoc, updateDoc, onSnapshot, query, where, orderBy } from "@react-native-firebase/firestore"
import { useFocusEffect } from "@react-navigation/native"
import { format } from "date-fns"
import { vi } from "date-fns/locale"

// Custom hooks
import { useStudentProfile } from "./hooks/useStudentProfile"
import { useStudentStats } from "./hooks/useStudentStats"
import { useEvents } from './hooks/useEvents'
import type { Event } from './hooks/useEvents'

// Components
import { StatCard } from "./components/StatCard"
import { NavigationButton } from "./components/NavigationButton"
import { EventCard } from "./components/EventCard"
import { SearchBar } from "./components/SearchBar"
import { ProfileHeader } from "./components/ProfileHeader"

interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: string;
  studentId?: string;
  class?: string;
  faculty?: string;
  department?: string;
}

const { width } = Dimensions.get("window")
const isTablet = width > 768

const StudentDashboard = () => {
  const router = useRouter()
  const auth = getAuth()
  const db = getFirestore()

  // State
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Custom hooks
  const { profile, loading: profileLoading } = useStudentProfile()
  const { stats, loading: statsLoading, refreshStats } = useStudentStats()
  const { events, loading: eventsLoading } = useEvents()

  // Filter upcoming events
  const upcomingEvents = events.slice(0, 5)

  // Derived state
  const filteredEvents = searchQuery.trim() ? events.filter(event => event.name.toLowerCase().includes(searchQuery.toLowerCase())) : upcomingEvents

  const loadingState = profileLoading || statsLoading || eventsLoading

  // Handlers
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)

    try {
      await Promise.all([refreshStats()])
    } finally {
      setRefreshing(false)
    }
  }, [refreshStats])

  const handleSearch = (text: string) => {
    setSearchQuery(text)
  }

  const handleEventPress = (id: string) => {
    router.push({
      pathname: "./(students)/activity",
      params: { id: id },
    })
  }

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let isActive = true

      if (isActive && !loading && !refreshing) {
        handleRefresh()
      }

      return () => {
        isActive = false
      }
    }, []),
  )

  useEffect(() => {
    const currentUser = auth.currentUser
    if (!currentUser) {
      setError('Người dùng chưa đăng nhập')
      setLoading(false)
      return
    }

    const userRef = doc(db, 'users', currentUser.uid)
    const unsubscribe = onSnapshot(userRef, 
      (doc) => {
        if (doc.exists) {
          const userData = doc.data() as User
          setUser(userData)
        } else {
          setError('Không tìm thấy thông tin người dùng')
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching user data:', err)
        setError('Không thể tải thông tin người dùng')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const logout = async () => {
    Alert.alert("Xác nhận đăng xuất", "Bạn có chắc chắn muốn đăng xuất?", [
      {
        text: "Hủy",
        style: "cancel",
      },
      {
        text: "Đăng xuất",
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
              "student_stats",
              "upcoming_events_5",
            ]

            await AsyncStorage.multiRemove(storageKeys)

            // Sign out from Google if using Google Sign-In
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
        style: "destructive",
      },
    ])
  }

  // Loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#3949AB" />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#5C6BC0" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              // Force skip loading
              refreshStats()
            }}
          >
            <Text style={styles.skipButtonText}>Bỏ qua</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3949AB" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeftSection}>
          <Ionicons name="school-outline" size={24} color="#FFF" />
          <Text style={styles.headerText}>SAM-APP TDMU</Text>
        </View>
        <View style={styles.headerRightSection}>
          <TouchableOpacity onPress={() => setShowSearch(!showSearch)} style={styles.headerButton}>
            <Ionicons name={showSearch ? "close-outline" : "search-outline"} size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRefresh} style={styles.headerButton}>
            <Ionicons name="refresh-outline" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.headerButton}>
            <Ionicons name="log-out-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="Tìm kiếm sự kiện..."
          autoFocus
          onClear={() => setSearchQuery("")}
        />
      )}

      {/* Main Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#5C6BC0"]} tintColor="#5C6BC0" />
        }
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <ProfileHeader profile={profile} onEditPress={() => router.push("./StudentTaiKhoan")} />
        </View>

        {/* Statistics Section
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Thống kê hoạt động</Text>
          <View style={styles.statsGrid}>
            <StatCard
              value={stats.participatedCount}
              label="Tham gia"
              icon="star-outline"
              color="#3949AB"
              previousValue={0}
              delay={100}
            />
            <StatCard
              value={stats.completedCount}
              label="Hoàn thành"
              icon="checkmark-circle-outline"
              color="#43A047"
              previousValue={0}
              delay={200}
            />
            <StatCard
              value={stats.pendingCount}
              label="Hoạt động sắp tới"
              icon="time-outline"
              color="#FB8C00"
              previousValue={0}
              delay={300}
            />
            <StatCard
              value={stats.totalHours}
              label="Tổng giờ hoạt động"
              icon="hourglass-outline"
              color="#8E24AA"
              previousValue={0}
              delay={400}
            />
          </View>
        </View> */}

        {/* Quick Actions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Thao tác nhanh</Text>
            <View style={styles.sectionDivider} />
          </View>
          <View style={styles.quickActionButtons}>
            <NavigationButton
              title="Xem thông báo"
              icon="notifications-outline"
              onPress={() => router.push("./XemThongBao")}
              color="#FB8C00"
              containerStyle={styles.quickActionButton}
              delay={100}
            />
            <NavigationButton
              title="Thời khóa biểu"
              icon="calendar-outline"
              onPress={() => Alert.alert("Thông báo", "Tính năng này sẽ sớm được cập nhật")}
              color="#43A047"
              containerStyle={styles.quickActionButton}
              delay={200}
            />
            <NavigationButton
              title="Hỏi đáp với AI"
              icon="add-circle-outline"
              onPress={() => router.push("./HoiDapAI")}
              color="#3949AB"
              containerStyle={styles.quickActionButton}
              delay={300}
            />
          </View>
        </View>

        {/* Upcoming Events Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sự kiện sắp tới</Text>
            <TouchableOpacity onPress={() => router.push("./SuKien")} style={styles.viewMoreButton}>
              <Text style={styles.viewMoreText}>Xem tất cả</Text>
              <Ionicons name="chevron-forward" size={16} color="#3949AB" />
            </TouchableOpacity>
          </View>
          <View style={styles.sectionDivider} />

          {eventsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3949AB" />
            </View>
          ) : upcomingEvents.length > 0 ? (
            <FlatList<Event>
              data={upcomingEvents}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.eventCard}
                  onPress={() => router.push({
                    pathname: "./ChiTietHD",
                    params: { id: item.id }
                  })}
                >
                  <Image 
                    source={{ uri: item.bannerImageUrl }} 
                    style={styles.eventImage}
                    resizeMode="cover"
                  />
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle} numberOfLines={2}>{item.name}</Text>
                    <View style={styles.eventMeta}>
                      <View style={styles.eventMetaItem}>
                        <Ionicons name="calendar-outline" size={14} color="#666" />
                        <Text style={styles.eventMetaText}>
                          {format(item.startDate.toDate(), "dd/MM/yyyy", { locale: vi })}
                        </Text>
                      </View>
                      <View style={styles.eventMetaItem}>
                        <Ionicons name="location-outline" size={14} color="#666" />
                        <Text style={styles.eventMetaText} numberOfLines={1}>{item.location}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.eventsList}
            />
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="calendar-outline" size={48} color="#C5CAE9" />
              <Text style={styles.noDataText}>Chưa có sự kiện sắp tới</Text>
            </View>
          )}
        </View>

        {/* Main Navigation Section */}
        <View style={styles.navigationSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Truy cập</Text>
            <View style={styles.sectionDivider} />
          </View>
          <View style={styles.buttonContainer}>
            <NavigationButton
              title="Đang diễn ra"
              icon="calendar-outline"
              onPress={() => router.push("./HDDangDienRa")}
              color="#3949AB"
              delay={100}
            />
            <NavigationButton
              title="Đã tham gia"
              icon="list-outline"
              onPress={() => router.push("./HDThamGia")}
              color="#FB8C00"
              delay={150}
            />
            <NavigationButton
              title="Thông tin cá nhân"
              icon="person-outline"
              onPress={() => router.push("./ThongTinSV")}
              color="#8E24AA"
              delay={250}
            />
            <NavigationButton
              title="Tài liệu sinh hoạt"
              icon="add-circle-outline"
              onPress={() => router.push("./TaiLieuSH")}
              color="#1E88E5"
              delay={350}
            />
            <NavigationButton
              title="Phản hồi"
              icon="chatbubble-outline"
              onPress={() => router.push("./PhanHoi")}
              color="#6D4C41"
              delay={400}
            />
            <NavigationButton
              title="Bạn bè"
              icon="people-outline"
              onPress={() => router.push("./FriendsListScreen")}
              color="#FF9800"
              delay={500}
            />
            <NavigationButton
              title="Thống kê"
              icon="bar-chart-outline"
              onPress={() => router.push("./ThongKeHD")}
              color="#43A047"
              delay={200}
            />
            <NavigationButton
              title="Cài đặt"
              icon="settings-outline"
              onPress={() => router.push("./CaiDat")}
              color="#546E7A"
              delay={450}
            />
            <NavigationButton
              title="Lịch sử điểm danh"
              icon="time-outline"
              onPress={() => Alert.alert("Thông báo", "Tính năng này sẽ sớm được cập nhật")}
              color="#E53935"
              delay={300}
            />
            {/* <NavigationButton
              title="Chat"
              icon="chatbubble-outline"
              onPress={() => router.push("./ChatScreen")}
              color="#6D4C41"
              delay={550}
            /> */}
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerDivider}/>
          <Text style={styles.footerText}>© 2024 BTV DEV Academy</Text>
          <Text style={styles.footerVersion}>Phiên bản 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FF",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#3949AB",
  },
  loadingContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "500",
    color: "#FFF",
  },
  skipButton: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#FFF",
    borderRadius: 30,
  },
  skipButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#3949AB",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  headerLeftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerRightSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
  },
  headerText: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 10,
    color: "#FFF",
  },
  content: {
    flex: 1,
  },
  profileSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  section: {
    padding: 16,
    marginBottom: 8,
  },
  navigationSection: {
    padding: 16,
    marginBottom: 16,
  },
  statsContainer: {
    padding: 16,
    marginBottom: 8,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  sectionDivider: {
    height: 3,
    backgroundColor: "#3949AB",
    width: 40,
    borderRadius: 2,
    marginTop: 8,
  },
  viewMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(57, 73, 171, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  viewMoreText: {
    fontSize: 14,
    color: "#3949AB",
    marginRight: 4,
    fontWeight: "500",
  },
  quickActionButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  quickActionButton: {
    width: "31%",
    marginBottom: 12,
  },
  eventsList: {
    paddingVertical: 12,
  },
  buttonContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 16,
  },
  noDataContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#FFF",
    borderRadius: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  noDataText: {
    marginTop: 12,
    fontSize: 16,
    color: "#7986CB",
    textAlign: "center",
  },
  footer: {
    padding: 24,
    alignItems: "center",
    marginBottom: Platform.OS === "ios" ? 20 : 0,
  },
  footerDivider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    width: "40%",
    marginBottom: 16,
  },
  footerText: {
    fontSize: 14,
    color: "#666",
  },
  footerVersion: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  securityButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E9F0",
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    marginRight: 12,
  },
  eventImage: {
    width: 80,
    height: 80,
    borderRadius: 4,
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  eventMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  eventMetaText: {
    fontSize: 14,
    color: "#666",
  },
})

export default StudentDashboard
