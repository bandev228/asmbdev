"use client"

import { useState, useCallback } from "react"
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
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { getAuth } from "@react-native-firebase/auth"
import { useRouter } from "expo-router"
import { GoogleSignin } from "@react-native-google-signin/google-signin"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { getFirestore } from "@react-native-firebase/firestore"

// Custom hooks
import { useUserProfile } from "./hooks/useUserProfile"
import { useManagerStats } from "./hooks/useManagerStats"
import useOngoingActivities from "./hooks/useOngoingActivities"

// Components
import { StatCard } from "./components/StatCard"
import { NavigationButton } from "./components/NavigationButton"
import PendingActivityCard from "./components/PendingActivityCard"
import { SearchBar } from "./components/SearchBar"
import { ProfileHeader } from "./components/ProfileHeader"

const { width } = Dimensions.get("window")
const isTablet = width > 768

const ManagerScreen = () => {
  const router = useRouter()
  const auth = getAuth()
  const db = getFirestore()

  // State
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [refreshing, setRefreshing] = useState(false)

  // Custom hooks
  const { profile, loading: profileLoading } = useUserProfile()
  const { stats, loading: statsLoading, refreshStats } = useManagerStats()
  const {
    activities: ongoingActivities,
    loading: activitiesLoading,
    refreshActivities,
    filterActivities,
  } = useOngoingActivities(5)

  // Derived state
  const filteredActivities = searchQuery.trim() ? filterActivities(searchQuery) : ongoingActivities

  const loading = profileLoading || statsLoading || activitiesLoading

  // Handlers
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)

    try {
      await Promise.all([refreshStats(), refreshActivities()])
    } finally {
      setRefreshing(false)
    }
  }, [refreshStats, refreshActivities])

  const handleSearch = (text: string) => {
    setSearchQuery(text)
  }

  const handleActivityPress = (id: string) => {
    router.push({
      pathname: "./(staffs)/activity-detail",
      params: { activityId: id },
    })
  }

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
              refreshActivities()
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
          <Ionicons name="briefcase-outline" size={24} color="#FFF" />
          <Text style={styles.headerText}>QTV DASHBOARD</Text>
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
          placeholder="Tìm kiếm hoạt động..."
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
          <ProfileHeader profile={profile} onEditPress={() => router.push("./StaffTaiKhoan")} />
        </View>

        {/* Statistics Section
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Thống kê tổng quan</Text>
          <View style={styles.statsGrid}>
            <StatCard
              value={stats.totalActivities}
              label="Tổng hoạt động"
              icon="calendar-outline"
              color="#3949AB"
              previousValue={0}
              delay={100}
            />
            <StatCard
              value={stats.approvedActivities}
              label="Đã duyệt"
              icon="checkmark-circle-outline"
              color="#43A047"
              previousValue={0}
              delay={200}
            />
            <StatCard
              value={stats.pendingActivities}
              label="Chờ duyệt"
              icon="time-outline"
              color="#FB8C00"
              previousValue={0}
              delay={300}
            />
            <StatCard
              value={stats.totalStudents}
              label="Sinh viên"
              icon="people-outline"
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
              title="Tạo hoạt động"
              icon="add-circle-outline"
              onPress={() => router.push("./StaffTaoHD")}
              color="#3949AB"
              containerStyle={styles.quickActionButton}
              delay={100}
              route="./StaffTaoHD"
            />
            <NavigationButton
              title="Duyệt hoạt động"
              icon="checkmark-circle-outline"
              onPress={() => router.push("./DuyetHD")}
              color="#43A047"
              containerStyle={styles.quickActionButton}
              delay={200}
              route="./DuyetHD"
            />
            <NavigationButton
              title="Gửi thông báo"
              icon="notifications-outline"
              onPress={() => router.push("./QuanLyTB")}
              color="#FB8C00"
              containerStyle={styles.quickActionButton}
              delay={300}
              route="./QuanLyTB"
            />
          </View>
        </View>

        {/* Ongoing Activities Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hoạt động đang diễn ra</Text>
            <TouchableOpacity onPress={() => router.push("./QuanLyHD")} style={styles.viewMoreButton}>
              <Text style={styles.viewMoreText}>Xem tất cả</Text>
              <Ionicons name="chevron-forward" size={16} color="#3949AB" />
            </TouchableOpacity>
          </View>
          <View style={styles.sectionDivider} />

          {filteredActivities.length > 0 ? (
            <FlatList
              data={filteredActivities}
              renderItem={({ item, index }) => (
                <PendingActivityCard
                  id={item.id}
                  title={item.title}
                  date={item.date}
                  location={item.location}
                  creatorName={item.creatorName}
                  participantsCount={item.participantsCount}
                  onPress={() => handleActivityPress(item.id)}
                  index={index}
                  status="ongoing"
                />
              )}
              keyExtractor={(item) => item.id}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.approvalsList}
            />
          ) : searchQuery ? (
            <View style={styles.noDataContainer}>
              <Ionicons name="search-outline" size={48} color="#C5CAE9" />
              <Text style={styles.noDataText}>Không tìm thấy hoạt động phù hợp</Text>
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="calendar-outline" size={48} color="#C5CAE9" />
              <Text style={styles.noDataText}>Không có hoạt động nào đang diễn ra</Text>
            </View>
          )}
        </View>

        {/* Main Navigation Section */}
        <View style={styles.navigationSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tính năng</Text>
            <View style={styles.sectionDivider} />
          </View>
          <View style={styles.buttonContainer}>
            <NavigationButton
              title="Quản lý hoạt động"
              icon="calendar-outline"
              onPress={() => router.push("./QuanLyHD")}
              color="#3949AB"
              delay={100}
              route="./QuanLyHD"
            />
            <NavigationButton
              title="Hoạt động kết thúc"
              icon="pencil-outline"
              onPress={() => router.push("./KetThucHD")}
              color="#3949AB"
              delay={100}
              route="./KetThucHD"
            />
            <NavigationButton
              title="Thống kê"
              icon="bar-chart-outline"
              onPress={() => router.push("./ThongKeHD")}
              color="#FB8C00"
              delay={150}
              route="./ThongKeHD"
            />
            <NavigationButton
              title="Quản lý sinh viên"
              icon="people-outline"
              onPress={() => router.push("./QuanLySV")}
              color="#43A047"
              delay={200}
              route="./QuanLySV"
            />
            <NavigationButton
              title="Báo cáo"
              icon="document-text-outline"
              onPress={() => router.push("./BaoCaoHD")}
              color="#8E24AA"
              delay={250}
              route="./BaoCaoHD"
            />
            <NavigationButton
              title="Duyệt hoạt động"
              icon="checkmark-circle-outline"
              onPress={() => router.push("./DuyetHD")}
              color="#E53935"
              delay={300}
              route="./DuyetHD"
            />
            <NavigationButton
              title="Duyệt sinh viên"
              icon="person-add-outline"
              onPress={() => router.push("./DuyetSV")}
              color="#1E88E5"
              delay={350}
              route="./DuyetSV"
            />
            <NavigationButton
              title="Quản lý thông báo"
              icon="notifications-outline"
              onPress={() => router.push("./QuanLyTB")}
              color="#6D4C41"
              delay={400}
              route="./QuanLyTB"
            />
            <NavigationButton
              title="Gửi tài liệu"
              icon="send"
              onPress={() => router.push("./QuanLyTB")}
              color="#6D4C41"
              delay={400}
              route="./GuiTLSH"
            />
            <NavigationButton
              title="Cài đặt"
              icon="settings-outline"
              onPress={() => router.push("./CaiDat")}
              color="#546E7A"
              delay={450}
              route="./CaiDat"
            />
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <Text style={styles.footerText}>© 2024 BTV DEVELOPER</Text>
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
  approvalsList: {
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
})

export default ManagerScreen
