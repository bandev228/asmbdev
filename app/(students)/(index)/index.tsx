import { useState, useEffect, useCallback, useRef } from "react"
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
  Animated,
  StatusBar,
  Image,
  TextInput,
  FlatList,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { 
  getAuth, 
  signOut as firebaseSignOut 
} from "@react-native-firebase/auth"
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  terminate,
  onSnapshot,
  type QuerySnapshot,
  type DocumentData
} from "@react-native-firebase/firestore"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useRouter } from "expo-router"
import { useFocusEffect } from "@react-navigation/native"
import { GoogleSignin } from '@react-native-google-signin/google-signin'

const { width, height } = Dimensions.get("window")
const isTablet = width > 768

interface DashboardButtonProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
}

interface StatCardProps {
  value: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  fadeAnim: Animated.Value;
  translateY: Animated.Value;
}

interface Event {
  id: string;
  title: string;
  date: Date;
  location: string;
  isParticipating: boolean;
}

interface AnimationItem {
  fade: Animated.Value;
  translateX: Animated.Value;
}

interface UserData {
  displayName?: string;
  email?: string;
  photoURL?: string;
  [key: string]: any;
}

interface UserProfile {
  displayName: string;
  email: string;
  photoURL: string;
  studentId: string;
  faculty: string;
  class: string;
}

// Tách DashboardButton ra khỏi component chính để tránh lỗi hooks
const DashboardButton = ({ title, icon, onPress, color = "#007AFF" }: DashboardButtonProps) => {
  // Animation for button press
  const scaleAnim = useRef(new Animated.Value(1)).current

  const onPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start()
  }

  const onPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start()
  }

  return (
    <Animated.View style={[styles.dashboardButtonContainer, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[styles.dashboardButton, { borderLeftColor: color }]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.7}
      >
        <Ionicons name={icon} size={24} color={color} />
        <Text style={[styles.dashboardButtonText, { color: "#333" }]}>{title}</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

// Tách StatCard ra khỏi component chính
const StatCard = ({ value, label, icon, color, fadeAnim, translateY }: StatCardProps) => (
  <Animated.View
    style={[
      styles.statItem,
      {
        opacity: fadeAnim,
        transform: [{ translateY }],
      },
    ]}
  >
    <View style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </Animated.View>
)

const safeToDate = (timestamp: any): Date | null => {
  try {
    if (!timestamp) return null;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return new Date(timestamp);
  } catch (error) {
    console.error('Error converting timestamp:', error);
    return null;
  }
};

const formatDate = (date: Date | null): string => {
  if (!date) return 'N/A';
  try {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'N/A';
  }
};

export default function StudentDashboard() {
  const router = useRouter()
  const [statistics, setStatistics] = useState({
    participatedCount: 0,
    completedCount: 0,
    totalHours: 0,
    pendingCount: 0,
  })
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(50)).current

  // Tạo mảng để lưu trữ animation values cho danh sách sự kiện
  const itemAnimations = useRef<AnimationItem[]>([])

  // Thêm biến để theo dõi nếu component đã unmount
  const isMounted = useRef(true)

  // Khởi tạo Firebase services
  const auth = getAuth()
  const db = getFirestore()

  // Khởi tạo animation values cho danh sách sự kiện
  useEffect(() => {
    if (upcomingEvents.length > 0 && itemAnimations.current.length === 0) {
      upcomingEvents.forEach((_, index) => {
        itemAnimations.current[index] = {
          fade: new Animated.Value(0),
          translateX: new Animated.Value(50),
        }
      })

      // Animate each item
      upcomingEvents.forEach((_, index) => {
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
  }, [upcomingEvents])

  useEffect(() => {
    // Thiết lập isMounted khi component mount
    isMounted.current = true

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
    ]).start()

    // Tải dữ liệu ban đầu
    fetchData()

    // Cleanup khi component unmount
    return () => {
      isMounted.current = false
    }
  }, [])

  // Sửa lại useFocusEffect để tránh gọi nhiều lần
  useFocusEffect(
    useCallback(() => {
      let isActive = true

      if (isActive) {
        fetchData()
      }

      return () => {
        isActive = false
      }
    }, []),
  )

  const fetchData = async () => {
    if (!isMounted.current) return

    setLoading(true)
    setError(null)

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout fetching data")), 15000),
      )

      await Promise.race([Promise.all([fetchStatistics(), fetchUpcomingEvents(), fetchUserProfile()]), timeoutPromise])
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError("An unknown error occurred")
      }

      setStatistics({
        participatedCount: 0,
        completedCount: 0,
        totalHours: 0,
        pendingCount: 0,
      })

      setUpcomingEvents([])
      setFilteredEvents([])

      if (isMounted.current) {
        Alert.alert("Lỗi kết nối", "Không thể tải dữ liệu. Vui lòng kiểm tra kết nối mạng và thử lại.", [
          { text: "OK" },
        ])
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetchData()
    } finally {
      if (isMounted.current) {
        setRefreshing(false)
      }
    }
  }, [])

  const fetchUserProfile = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("User not authenticated");

      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data() as UserData | undefined;

      if (userData && isMounted.current) {
        setUserProfile({
          displayName: userData.displayName || 'User',
          email: userData.email || 'user@example.com',
          photoURL: userData.photoURL || 'https://example.com/user-profile.jpg',
          studentId: userData.studentId || 'Chưa cập nhật',
          faculty: userData.faculty || 'Chưa cập nhật',
          class: userData.class || 'Chưa cập nhật',
        });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred");
      }
    }
  };

  const fetchStatistics = async () => {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) throw new Error("User not authenticated")

      const activitiesPromise = Promise.race([
        getDocs(collection(db, "activities")),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout fetching activities")), 10000)),
      ])

      const activitiesSnapshot = await activitiesPromise as QuerySnapshot<DocumentData>

      let participatedCount = 0
      let completedCount = 0
      let pendingCount = 0
      let totalHours = 0

      activitiesSnapshot.docs.forEach((doc: any) => {
        const data = doc.data()
        if (data.participants && Array.isArray(data.participants) && data.participants.includes(userId)) {
          participatedCount++

          const now = new Date()
          const endDate = safeToDate(data.endDate)
          const startDate = safeToDate(data.startDate)

          if (endDate && endDate < now) {
            completedCount++
          } else if (startDate && startDate > now) {
            pendingCount++
          }

          if (data.duration && typeof data.duration === "number") {
            totalHours += data.duration
          }
        }
      })

      if (isMounted.current) {
        setStatistics({
          participatedCount,
          completedCount,
          totalHours,
          pendingCount,
        })
      }
    } catch (error) {
      console.error("Error fetching statistics:", error)
      throw error
    }
  }

  const fetchUpcomingEvents = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("User not authenticated");

      const now = new Date();

      const eventsQuery = query(
        collection(db, "activities"),
        where("startDate", ">", now),
        orderBy("startDate", "asc"),
        limit(5)
      );
      
      const eventsSnapshot = await getDocs(eventsQuery);

      const upcomingEventsData: Event[] = eventsSnapshot.docs.map((doc) => {
        const data = doc.data();
        const startDate = safeToDate(data.startDate) || new Date();
        return {
          id: doc.id,
          title: data.name || "Sự kiện không tên",
          date: startDate,
          location: data.location || "Chưa cập nhật",
          isParticipating:
            data.participants && Array.isArray(data.participants) && data.participants.includes(userId),
        };
      });

      if (isMounted.current) {
        setUpcomingEvents(upcomingEventsData);
        setFilteredEvents(upcomingEventsData);
      }
    } catch (error) {
      console.error("Error fetching upcoming events:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred");
      }
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim() === "") {
      setFilteredEvents(upcomingEvents);
      return;
    }

    const filtered = upcomingEvents.filter(
      (event) =>
        event.title.toLowerCase().includes(text.toLowerCase()) ||
        event.location.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredEvents(filtered);
  };

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
            setLoading(true)
            
            // Thực hiện các thao tác đăng xuất song song để tối ưu thời gian
            await Promise.all([
              // 1. Clear local states
              (async () => {
                setStatistics({
                  participatedCount: 0,
                  completedCount: 0,
                  totalHours: 0,
                  pendingCount: 0,
                })
                setUpcomingEvents([])
                setFilteredEvents([])
                setUserProfile(null)
              })(),

              // 2. Clear storage và terminate Firestore
              (async () => {
                const storageKeys = [
                  'fcmToken',
                  'userSettings',
                  'lastNotificationCheck',
                  'cachedUserProfile',
                  'activityHistory',
                  '@googleSignInCredentials'
                ];
                await AsyncStorage.multiRemove(storageKeys);
                await terminate(db);
              })(),

              // 3. Đăng xuất khỏi Google (nếu đang sử dụng)
              (async () => {
                try {
                  const currentUser = auth.currentUser;
                  if (currentUser?.providerData?.some(provider => provider.providerId === 'google.com')) {
                    await GoogleSignin.signOut();
                    await GoogleSignin.revokeAccess();
                  }
                } catch (error) {
                  console.warn("Google sign out error:", error);
                  // Không throw error vì đây không phải lỗi nghiêm trọng
                }
              })(),

              // 4. Đăng xuất khỏi Firebase
              (async () => {
                try {
                  // Hủy đăng ký các listeners
                  const unsubscribeRef = onSnapshot(collection(db, 'notifications'), () => {});
                  unsubscribeRef();
                  
                  // Đăng xuất
                  await firebaseSignOut(auth);
                } catch (error: any) {
                  throw new Error('Không thể đăng xuất khỏi Firebase: ' + (error?.message || 'Unknown error'));
                }
              })()
            ]);

            // Chuyển hướng ngay lập tức sau khi đăng xuất thành công
            router.replace("/(auth)/login");
            
          } catch (error: any) {
            console.error("Error during logout:", error);
            Alert.alert(
              "Lỗi đăng xuất",
              "Không thể đăng xuất hoàn toàn. Vui lòng thử lại: " + (error?.message || ''),
              [{ text: "OK" }]
            );
          } finally {
            setLoading(false);
          }
        },
        style: "destructive",
      },
    ]);
  };

  const renderEventItem = ({ item }: { item: Event }) => {
    const formattedDate = formatDate(item.date)

    // Sử dụng animation values đã được tạo trước đó
    const itemAnim = itemAnimations.current[upcomingEvents.indexOf(item)] || { fade: new Animated.Value(1), translateX: new Animated.Value(0) }

    return (
      <Animated.View
        style={[
          styles.eventItem,
          {
            opacity: itemAnim.fade,
            transform: [{ translateX: itemAnim.translateX }],
            borderLeftColor: item.isParticipating ? "#4CAF50" : "#007AFF",
          },
        ]}
      >
        <TouchableOpacity 
          onPress={() => router.push({
            pathname: "./(students)/activity",
            params: { id: item.id }
          })} 
          activeOpacity={0.7}
        >
          <Text style={styles.eventTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.eventInfoRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.eventInfo}>{formattedDate}</Text>
          </View>
          <View style={styles.eventInfoRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.eventInfo} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
          {item.isParticipating && (
            <View style={styles.participatingBadge}>
              <Text style={styles.participatingText}>Đã đăng ký</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    )
  }

  // Thêm nút Retry khi có lỗi
  if (error) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <Ionicons name="cloud-offline-outline" size={48} color="#F44336" />
        <Text style={styles.errorText}>Không thể tải dữ liệu</Text>
        <Text style={styles.errorSubText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  // Thêm nút Skip loading để người dùng có thể bỏ qua màn hình loading
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        <TouchableOpacity style={styles.skipButton} onPress={() => setLoading(false)}>
          <Text style={styles.skipButtonText}>Bỏ qua</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <View style={styles.header}>
        <View style={styles.headerLeftSection}>
          <Ionicons name="school-outline" size={24} color="#007AFF" />
          <Text style={styles.headerText}>Student Dashboard</Text>
        </View>
        <View style={styles.headerRightSection}>
          <TouchableOpacity onPress={() => setShowSearch(!showSearch)} style={styles.headerButton}>
            <Ionicons name={showSearch ? "close-outline" : "search-outline"} size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRefresh} style={styles.headerButton}>
            <Ionicons name="refresh-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.headerButton}>
            <Ionicons name="log-out-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {showSearch && (
        <Animated.View
          style={[
            styles.searchContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.searchInputContainer}>
            <Ionicons name="search-outline" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm sự kiện..."
              value={searchQuery}
              onChangeText={handleSearch}
              placeholderTextColor="#999"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch("")}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#007AFF"]} tintColor="#007AFF" />
        }
      >
        {/* Profile Section */}
        <Animated.View
          style={[
            styles.profileContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.profileHeader}>
            <View style={styles.profileInfo}>
              <Text style={styles.welcomeText}>Xin chào,</Text>
              <Text style={styles.profileName}>{userProfile?.displayName || "Sinh viên"}</Text>
              <Text style={styles.profileDetail}>{userProfile?.studentId || "Chưa cập nhật"}</Text>
              <Text style={styles.profileDetail}>{userProfile?.faculty || "Chưa cập nhật"}</Text>
            </View>
            <View style={styles.profileImageContainer}>
              {userProfile?.photoURL ? (
                <Image source={{ uri: userProfile.photoURL }} style={styles.profileImage} resizeMode="cover" />
              ) : (
                <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                  <Ionicons name="person" size={40} color="#007AFF" />
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Statistics Section */}
        <View style={styles.statsContainer}>
          <StatCard
            value={statistics.participatedCount}
            label="Hoạt động tham gia"
            icon="star-outline"
            color="#FF9500"
            fadeAnim={fadeAnim}
            translateY={translateY}
          />
          <StatCard
            value={statistics.completedCount}
            label="Hoạt động hoàn thành"
            icon="checkmark-circle-outline"
            color="#4CAF50"
            fadeAnim={fadeAnim}
            translateY={translateY}
          />
          <StatCard
            value={statistics.pendingCount}
            label="Hoạt động sắp tới"
            icon="time-outline"
            color="#FFC107"
            fadeAnim={fadeAnim}
            translateY={translateY}
          />
          <StatCard
            value={statistics.totalHours}
            label="Giờ hoạt động"
            icon="hourglass-outline"
            color="#9C27B0"
            fadeAnim={fadeAnim}
            translateY={translateY}
          />
        </View>

        {/* Quick Actions Section */}
        <Animated.View
          style={[
            styles.quickActionsContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Thao tác nhanh</Text>
          </View>
          <View style={styles.quickActionButtons}>
            {/* <DashboardButton
              title="Điểm danh"
              icon="camera-outline"
              onPress={() => router.push("./DiemDanhHD")}
              color="#007AFF"
            /> */}
            <DashboardButton
              title="Xem thông báo"
              icon="notifications-outline"
              onPress={() => router.push("./XemThongBao")}
              color="#FF9500"
            />
            <DashboardButton
              title="Thời khóa biểu"
              icon="calendar-outline"
              onPress={() => router.push("./ThoiKhoaBieu")}
              color="#4CAF50"
            />
          </View>
        </Animated.View>

        {/* Upcoming Events Section */}
        <Animated.View
          style={[
            styles.upcomingEventsContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sự kiện sắp tới</Text>
            <TouchableOpacity onPress={() => router.push("./SuKien")} style={styles.viewMoreButton}>
              <Text style={styles.viewMoreText}>Xem tất cả</Text>
              <Ionicons name="chevron-forward" size={16} color="#007AFF" />
            </TouchableOpacity>
          </View>

          {filteredEvents.length > 0 ? (
            <FlatList
              data={filteredEvents}
              renderItem={renderEventItem}
              keyExtractor={(item) => item.id}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.eventsList}
            />
          ) : searchQuery ? (
            <View style={styles.noDataContainer}>
              <Ionicons name="search-outline" size={48} color="#ccc" />
              <Text style={styles.noDataText}>Không tìm thấy sự kiện phù hợp</Text>
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="calendar-outline" size={48} color="#ccc" />
              <Text style={styles.noDataText}>Chưa có sự kiện sắp tới</Text>
            </View>
          )}
        </Animated.View>

        {/* Main Navigation Section */}
        <Animated.View
          style={[
            styles.mainNavigationContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY }],
            },
          ]}
        >
          <Text style={styles.sectionTitle}>Truy cập nhanh</Text>
          <View style={styles.buttonContainer}>
            <DashboardButton
              title="Hoạt động đang diễn ra"
              icon="calendar-outline"
              onPress={() => router.push("./HDDangDienRa")}
              color="#007AFF"
            />
            <DashboardButton
              title="Hoạt động tham gia"
              icon="list-outline"
              onPress={() => router.push("./HDThamGia")}
              color="#FF9800"
            />
            <DashboardButton
              title="Thống kê hoạt động"
              icon="bar-chart-outline"
              onPress={() => router.push("./ThongKeHD")}
              color="#4CAF50"
            />
            <DashboardButton
              title="Thông tin cá nhân"
              icon="person-outline"
              onPress={() => router.push("./ThongTinSV")}
              color="#9C27B0"
            />
            <DashboardButton
              title="Lịch sử điểm danh"
              icon="time-outline"
              onPress={() => router.push("./LSDiemDanh")}
              color="#F44336"
            />
            <DashboardButton
              title="Đăng ký hoạt động"
              icon="add-circle-outline"
              onPress={() => router.push("./DangKyHD")}
              color="#2196F3"
            />
            <DashboardButton
              title="Phản hồi"
              icon="chatbubble-outline"
              onPress={() => router.push("./PhanHoi")}
              color="#795548"
            />
            <DashboardButton
              title="Cài đặt"
              icon="settings-outline"
              onPress={() => router.push("./CaiDat")}
              color="#607D8B"
            />
          </View>
        </Animated.View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 BTV DEV Academy</Text>
          <Text style={styles.footerVersion}>Phiên bản 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "bold",
    color: "#F44336",
  },
  errorSubText: {
    marginTop: 5,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  skipButton: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#007AFF",
    borderRadius: 8,
  },
  skipButtonText: {
    color: "#007AFF",
    fontWeight: "bold",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  },
  headerText: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    padding: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: "#333",
  },
  profileContainer: {
    backgroundColor: "#fff",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: "#666",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 4,
  },
  profileDetail: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  profileImageContainer: {
    marginLeft: 16,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profileImagePlaceholder: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 16,
  },
  statItem: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  quickActionsContainer: {
    backgroundColor: "#fff",
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  viewMoreButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewMoreText: {
    fontSize: 14,
    color: "#007AFF",
  },
  quickActionButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  upcomingEventsContainer: {
    backgroundColor: "#fff",
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  eventsList: {
    paddingVertical: 8,
  },
  eventItem: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginRight: 16,
    width: 250,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  eventInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  eventInfo: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  participatingBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#E8F5E9",
  },
  participatingText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  mainNavigationContainer: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 16,
  },
  dashboardButtonContainer: {
    width: "48%",
    marginBottom: 16,
  },
  dashboardButton: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dashboardButtonText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  noDataContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  noDataText: {
    marginTop: 8,
    fontSize: 16,
    color: "#999",
  },
  footer: {
    padding: 16,
    alignItems: "center",
    marginBottom: Platform.OS === "ios" ? 20 : 0,
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
