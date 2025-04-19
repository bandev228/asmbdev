import React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { 
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  FlatList,
  Alert,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Animated,
  StatusBar,
  Image,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { getApp } from "@react-native-firebase/app"
import { getAuth, signOut } from "@react-native-firebase/auth"
import { PieChart } from "react-native-chart-kit"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { getFirestore, collection, getDocs } from "@react-native-firebase/firestore"
import type { ActivityData, DashboardStats } from "./hooks/types"
import { LinearGradient } from "expo-linear-gradient"

import { useDashboardData } from "./hooks/useDashboardData"

const { width, height } = Dimensions.get("window")
const isTablet = width > 768

// Initialize Firebase
const app = getApp()
const auth = getAuth()

const fetchDashboardData = async (): Promise<DashboardStats> => {
  const db = getFirestore()
  const activitiesRef = collection(db, "activities")
  const usersRef = collection(db, "users")

  const [activitiesSnapshot, usersSnapshot] = await Promise.all([getDocs(activitiesRef), getDocs(usersRef)])

  const activities = activitiesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ActivityData)
  const totalActivities = activities.length
  const pendingActivities = activities.filter((activity) => activity.status === "pending").length
  const approvedActivities = activities.filter((activity) => activity.status === "approved").length
  const totalUsers = usersSnapshot.size

  return {
    totalActivities,
    pendingActivities,
    totalUsers,
    approvedActivities,
  }
}

export default function AdminDashboard() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [filteredActivities, setFilteredActivities] = useState<(ActivityData & { id: string })[]>([])
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(50)).current
  const itemAnimations = useRef<{ fade: Animated.Value; translateX: Animated.Value }[]>([])
  const searchBarAnim = useRef(new Animated.Value(0)).current
  const searchBarHeight = searchBarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 60],
  })

  // Use custom hook for dashboard data
  const { stats, featuredActivities, loading, error, chartData, refetch } = useDashboardData()

  // Initialize animations for featured activities
  useEffect(() => {
    if (featuredActivities.length > 0 && itemAnimations.current.length === 0) {
      featuredActivities.forEach((_, index) => {
        itemAnimations.current[index] = {
          fade: new Animated.Value(0),
          translateX: new Animated.Value(50),
        }
      })

      featuredActivities.forEach((_, index) => {
        Animated.parallel([
          Animated.timing(itemAnimations.current[index].fade, {
            toValue: 1,
            duration: 500,
            delay: index * 100,
            useNativeDriver: true,
          }),
          Animated.timing(itemAnimations.current[index].translateX, {
            toValue: 0,
            duration: 500,
            delay: index * 100,
            useNativeDriver: true,
          }),
        ]).start()
          })
    }
  }, [featuredActivities])

  useEffect(() => {
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
    ]).start()
  }, [])

  useEffect(() => {
    if (showSearch) {
      Animated.timing(searchBarAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start()
    } else {
      Animated.timing(searchBarAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start()
    }
  }, [showSearch])

  const onRefresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  const handleSearch = (text: string) => {
    setSearchQuery(text)
    if (text.trim() === "") {
      setFilteredActivities(featuredActivities)
      return
    }

    const filtered = featuredActivities.filter(
      (activity) =>
      activity.name.toLowerCase().includes(text.toLowerCase()) ||
        activity.location.toLowerCase().includes(text.toLowerCase()),
    )
    setFilteredActivities(filtered)
  }

  const logout = async () => {
    Alert.alert("Đăng xuất Admin", "Bạn có chắc chắn muốn đăng xuất khỏi tài khoản admin?", [
        {
        text: "Hủy",
        style: "cancel",
        },
        {
        text: "Đăng xuất",
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
              "@admin_session",
              "@admin_settings",
              "@last_activity",
              "@notification_token",
            ])

            await signOut(auth)
            router.replace("/(auth)/login")
            } catch (error) {
            console.error("Lỗi trong quá trình đăng xuất:", error)
            Alert.alert("Lỗi đăng xuất", "Không thể đăng xuất. Vui lòng thử lại.", [{ text: "OK" }])
          }
        },
        style: "destructive",
      },
    ])
  }

  const navigateToActivityDetail = (activityId: string) => {
    router.push("./HoatDong")
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <View style={styles.errorContent}>
          <Ionicons name="cloud-offline-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Không thể tải dữ liệu</Text>
        <Text style={styles.errorSubText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Header */}
      <LinearGradient colors={["#3b82f6", "#2563eb"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
        <View style={styles.headerLeftSection}>
          <View style={styles.logoContainer}>
            <Ionicons name="grid" size={20} color="#fff" />
          </View>
          <Text style={styles.headerText}>Admin Dashboard</Text>
        </View>
        <View style={styles.headerRightSection}>
          <TouchableOpacity onPress={() => setShowSearch(!showSearch)} style={styles.headerButton}>
            <Ionicons name={showSearch ? "close" : "search"} size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRefresh} style={styles.headerButton}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.headerButton}>
            <Ionicons name="log-out" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
      
      {/* Search Bar */}
        <Animated.View 
          style={[
            styles.searchContainer,
            { 
            opacity: searchBarAnim,
            height: searchBarHeight,
            transform: [
              {
                translateY: searchBarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-50, 0],
                }),
              },
            ],
          },
          ]}
        >
          <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={18} color="#64748b" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm hoạt động..."
              value={searchQuery}
              onChangeText={handleSearch}
            placeholderTextColor="#64748b"
            autoFocus={showSearch}
            />
            {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={18} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      
      {/* Main Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} colors={["#3b82f6"]} tintColor="#3b82f6" />
        }
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeTextContainer}>
            <Text style={styles.welcomeTitle}>Xin chào, Admin</Text>
            <Text style={styles.welcomeSubtitle}>Chào mừng trở lại với trang quản trị</Text>
          </View>
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString("vi-VN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <Animated.View
            style={[
              styles.statCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: translateY }],
              },
            ]}
          >
            <LinearGradient
              colors={["#3b82f6", "#2563eb"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.statCardGradient}
            >
              <View style={styles.statIconContainer}>
                <Ionicons name="calendar" size={24} color="#fff" />
        </View>
              <Text style={styles.statValue}>{stats.totalActivities}</Text>
              <Text style={styles.statLabel}>Tổng hoạt động</Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View
            style={[
              styles.statCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: translateY }],
              },
            ]}
          >
            <LinearGradient
              colors={["#10b981", "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.statCardGradient}
            >
              <View style={styles.statIconContainer}>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.approvedActivities}</Text>
              <Text style={styles.statLabel}>Đã duyệt</Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View
            style={[
              styles.statCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: translateY }],
              },
            ]}
          >
            <LinearGradient
              colors={["#f59e0b", "#d97706"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.statCardGradient}
            >
              <View style={styles.statIconContainer}>
                <Ionicons name="time" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.pendingActivities}</Text>
              <Text style={styles.statLabel}>Chờ duyệt</Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View
            style={[
              styles.statCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: translateY }],
              },
            ]}
          >
            <LinearGradient
              colors={["#8b5cf6", "#7c3aed"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.statCardGradient}
            >
              <View style={styles.statIconContainer}>
                <Ionicons name="people" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.totalUsers}</Text>
              <Text style={styles.statLabel}>Người dùng</Text>
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Charts Section */}
        <Animated.View 
          style={[
            styles.chartsContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="pie-chart" size={20} color="#3b82f6" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Thống kê hoạt động</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("./ThongKeHD")} style={styles.viewMoreButton}>
              <Text style={styles.viewMoreText}>Xem chi tiết</Text>
              <Ionicons name="chevron-forward" size={16} color="#3b82f6" />
            </TouchableOpacity>
          </View>
          
          {chartData.length > 0 && stats.totalActivities > 0 ? (
            <>
              <View style={styles.chartWrapper}>
            <PieChart
                  data={chartData.map((item) => ({
                    ...item,
                    legendFontSize: 12,
                    legendFontColor: "#334155",
                  }))}
              width={isTablet ? 400 : 300}
                  height={220}
              chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(255, 255, 255, 0)`,
                style: {
                      borderRadius: 16,
                },
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft={isTablet ? "50" : "15"}
              absolute
                  hasLegend={false}
              center={[isTablet ? 100 : 50, 0]}
            />
              </View>
              <View style={styles.statsDetails}>
                {chartData.map((item, index) => (
                  <View key={index} style={styles.statDetail}>
                    <View style={styles.statDetailHeader}>
                      <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                      <Text style={styles.statDetailTitle}>{item.name}</Text>
                    </View>
                    <View style={styles.statDetailContent}>
                      <Text style={styles.statDetailValue}>{item.population}</Text>
                      <Text style={styles.statDetailPercent}>
                        {((item.population / stats.totalActivities) * 100).toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="bar-chart" size={48} color="#cbd5e1" />
              <Text style={styles.noDataText}>Chưa có dữ liệu thống kê</Text>
            </View>
          )}
        </Animated.View>
        
        {/* Featured Activities */}
        <Animated.View 
          style={[
            styles.featuredActivitiesContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="star" size={20} color="#3b82f6" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Hoạt động nổi bật</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("./HDNoiBat")} style={styles.viewMoreButton}>
              <Text style={styles.viewMoreText}>Xem tất cả</Text>
              <Ionicons name="chevron-forward" size={16} color="#3b82f6" />
            </TouchableOpacity>
          </View>
          
          {filteredActivities.length > 0 ? (
            <FlatList
              data={filteredActivities}
              renderItem={({ item, index }) => (
                <Animated.View
                  style={{
                    opacity: itemAnimations.current[index]?.fade || 1,
                    transform: [{ translateX: itemAnimations.current[index]?.translateX || 0 }],
                  }}
                >
                  <TouchableOpacity
                    style={styles.featuredActivityItem}
                    onPress={() => navigateToActivityDetail(item.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.featuredActivityImageContainer}>
                      {item.bannerImageUrl ? (
                        <Image
                          source={{ uri: item.bannerImageUrl }}
                          style={styles.featuredActivityImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.featuredActivityImagePlaceholder}>
                          <Ionicons name="image" size={30} color="#cbd5e1" />
                        </View>
                      )}
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.7)"]}
                        style={styles.featuredActivityGradient}
                      />
                      <View style={styles.featuredActivityStatus}>
                        <View
                          style={[
                            styles.statusIndicator,
                            { backgroundColor: item.status === "approved" ? "#10b981" : "#f59e0b" },
                          ]}
                        />
                        <Text style={styles.statusText}>{item.status === "approved" ? "Đã duyệt" : "Chờ duyệt"}</Text>
                      </View>
                    </View>
                    <View style={styles.featuredActivityContent}>
                      <Text style={styles.featuredActivityTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={styles.featuredActivityMeta}>
                        <View style={styles.metaItem}>
                          <Ionicons name="location" size={14} color="#64748b" />
                          <Text style={styles.metaText} numberOfLines={1}>
                            {item.location}
                          </Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons name="people" size={14} color="#64748b" />
                          <Text style={styles.metaText}>{item.participants?.length || 0} người tham gia</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              )}
              keyExtractor={(item) => item.id}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredActivitiesList}
            />
          ) : searchQuery ? (
            <View style={styles.noDataContainer}>
              <Ionicons name="search" size={48} color="#cbd5e1" />
              <Text style={styles.noDataText}>Không tìm thấy hoạt động phù hợp</Text>
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="calendar" size={48} color="#cbd5e1" />
              <Text style={styles.noDataText}>Chưa có hoạt động nổi bật</Text>
            </View>
          )}
        </Animated.View>
        
        {/* Quick Actions */}
        <Animated.View 
          style={[
            styles.quickActionsContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="apps" size={20} color="#3b82f6" style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Chức năng</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("./HoatDong")}>
              <LinearGradient colors={["#3b82f6", "#2563eb"]} style={styles.actionButtonGradient}>
                <Ionicons name="calendar" size={24} color="#fff" />
              </LinearGradient>
              <Text style={styles.actionButtonText}>Hoạt động</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("./HDDaTao")}>
              <LinearGradient colors={["#f59e0b", "#d97706"]} style={styles.actionButtonGradient}>
                <Ionicons name="create" size={24} color="#fff" />
              </LinearGradient>
              <Text style={styles.actionButtonText}>Đã tạo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("./DuyetHD")}>
              <LinearGradient colors={["#10b981", "#059669"]} style={styles.actionButtonGradient}>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </LinearGradient>
              <Text style={styles.actionButtonText}>Duyệt hoạt động</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("./DuyetSVTG")}>
              <LinearGradient colors={["#0ea5e9", "#0284c7"]} style={styles.actionButtonGradient}>
                <Ionicons name="person-add" size={24} color="#fff" />
              </LinearGradient>
              <Text style={styles.actionButtonText}>Duyệt sinh viên</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("./ThongKeHD")}>
              <LinearGradient colors={["#8b5cf6", "#7c3aed"]} style={styles.actionButtonGradient}>
                <Ionicons name="bar-chart" size={24} color="#fff" />
              </LinearGradient>
              <Text style={styles.actionButtonText}>Thống kê</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("./QuanLyTK")}>
              <LinearGradient colors={["#ef4444", "#dc2626"]} style={styles.actionButtonGradient}>
                <Ionicons name="people" size={24} color="#fff" />
              </LinearGradient>
              <Text style={styles.actionButtonText}>Tài khoản</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("./ThongBao")}>
              <LinearGradient colors={["#ec4899", "#db2777"]} style={styles.actionButtonGradient}>
                <Ionicons name="notifications" size={24} color="#fff" />
              </LinearGradient>
              <Text style={styles.actionButtonText}>Thông báo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("./GuiTaiLieu")}>
              <LinearGradient colors={["#14b8a6", "#0d9488"]} style={styles.actionButtonGradient}>
                <Ionicons name="document-text" size={24} color="#fff" />
              </LinearGradient>
              <Text style={styles.actionButtonText}>Tài liệu</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("./BaoCao")}>
              <LinearGradient colors={["#f97316", "#ea580c"]} style={styles.actionButtonGradient}>
                <Ionicons name="analytics" size={24} color="#fff" />
              </LinearGradient>
              <Text style={styles.actionButtonText}>Báo cáo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("./CaiDat")}>
              <LinearGradient colors={["#64748b", "#475569"]} style={styles.actionButtonGradient}>
                <Ionicons name="settings" size={24} color="#fff" />
              </LinearGradient>
              <Text style={styles.actionButtonText}>Cài đặt</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        
        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLogoContainer}>
            <Ionicons name="school" size={24} color="#3b82f6" />
            <Text style={styles.footerLogoText}>BTV Dev Academy</Text>
          </View>
          <Text style={styles.footerText}>© 2024 BTV Dev Academy</Text>
          <Text style={styles.footerVersion}>Phiên bản 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  errorContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "bold",
    color: "#ef4444",
  },
  errorSubText: {
    marginTop: 8,
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerLeftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerRightSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  headerText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    overflow: "hidden",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: "#334155",
  },
  welcomeSection: {
    padding: 20,
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  welcomeTextContainer: {
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  dateContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  dateText: {
    fontSize: 14,
    color: "#64748b",
    fontStyle: "italic",
  },
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 16,
  },
  statCard: {
    width: "48%",
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statCardGradient: {
    padding: 16,
    alignItems: "center",
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  chartsContainer: {
    backgroundColor: "#fff",
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
  },
  viewMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  viewMoreText: {
    fontSize: 14,
    color: "#3b82f6",
    marginRight: 4,
  },
  chartWrapper: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  statsDetails: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 16,
  },
  statDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statDetailTitle: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  statDetailContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDetailValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: 'bold',
    marginRight: 8,
  },
  statDetailPercent: {
    fontSize: 12,
    color: '#64748b',
  },
  featuredActivitiesContainer: {
    backgroundColor: "#fff",
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  featuredActivitiesList: {
    paddingVertical: 8,
  },
  featuredActivityItem: {
    width: 240,
    marginRight: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  featuredActivityImageContainer: {
    position: "relative",
    height: 140,
  },
  featuredActivityImage: {
    width: "100%",
    height: "100%",
  },
  featuredActivityImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  featuredActivityGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  featuredActivityStatus: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "500",
  },
  featuredActivityContent: {
    padding: 12,
  },
  featuredActivityTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 8,
  },
  featuredActivityMeta: {
    gap: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    fontSize: 13,
    color: "#64748b",
    marginLeft: 6,
  },
  noDataContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  noDataText: {
    marginTop: 12,
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
  },
  quickActionsContainer: {
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  buttonContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 16,
  },
  actionButton: {
    width: "30%",
    alignItems: "center",
    marginBottom: 16,
  },
  actionButtonGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButtonText: {
    fontSize: 12,
    color: "#334155",
    textAlign: "center",
  },
  footer: {
    padding: 24,
    alignItems: "center",
    marginBottom: Platform.OS === "ios" ? 20 : 0,
  },
  footerLogoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  footerLogoText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#3b82f6",
    marginLeft: 8,
  },
  footerText: {
    fontSize: 14,
    color: "#64748b",
  },
  footerVersion: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  },
})