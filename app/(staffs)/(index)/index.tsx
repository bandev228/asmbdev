import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ViewStyle
} from 'react-native';
import { Ionicons } from "@expo/vector-icons"
import { getAuth } from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { getFirestore, collection, query, where, orderBy, limit, getDocs, doc, getDoc, onSnapshot, terminate } from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
interface DashboardButtonProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
  containerStyle?: ViewStyle;
}

interface StatCardProps {
  value: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  fadeAnim: Animated.Value;
  translateY: Animated.Value;
}

interface UserProfile {
  displayName: string;
  email: string;
  photoURL?: string;
  department: string;
  position: string;
}

interface Stats {
  totalActivities: number;
  pendingActivities: number;
  totalStudents: number;
  approvedActivities: number;
}

interface PendingApproval {
  id: string;
  title: string;
  date: Date;
  location: string;
  createdBy: string;
  participantsCount: number;
}

interface AnimationItem {
  fade: Animated.Value;
  translateX: Animated.Value;
}

interface FirestoreActivity {
  id: string;
  name: string;
  createdAt: Date;
  location: string;
  createdBy: string;
  participants: string[];
  status: 'pending' | 'approved' | 'rejected';
}

const { width, height } = Dimensions.get('window');
const isTablet = width > 768;

// Tách DashboardButton ra khỏi component chính để tránh lỗi hooks
const DashboardButton: React.FC<DashboardButtonProps> = ({ title, icon, onPress, color = '#007AFF', containerStyle }) => {
  // Animation for button press
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const onPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };
  
  const onPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View 
      style={[
        styles.dashboardButtonContainer,
        containerStyle,
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      <TouchableOpacity 
        style={[styles.dashboardButton, { borderLeftColor: color }]} 
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.7}
      >
        <Ionicons name={icon} size={24} color={color} />
        <Text style={[styles.dashboardButtonText, { color: '#333' }]}>{title}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Tách StatCard ra khỏi component chính
const StatCard: React.FC<StatCardProps> = ({ value, label, icon, color, fadeAnim, translateY }) => (
  <Animated.View 
    style={[
      styles.statItem, 
      { 
        opacity: fadeAnim,
        transform: [{ translateY }]
      }
    ]}
  >
    <View style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </Animated.View>
);

const ManagerScreen = () => {
  const router = useRouter();
  const db = getFirestore();
  const auth = getAuth();
  const [stats, setStats] = useState<Stats>({
    totalActivities: 0,
    pendingActivities: 0,
    totalStudents: 0,
    approvedActivities: 0,
  });
  const [statistics, setStatistics] = useState({
    participatedCount: 0,
    completedCount: 0,
    totalHours: 0,
    pendingCount: 0,
  })
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filteredApprovals, setFilteredApprovals] = useState<PendingApproval[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(50)).current;

  // Tạo mảng để lưu trữ animation values cho danh sách phê duyệt
  const itemAnimations = useRef<AnimationItem[]>([]);
  
  // Thêm biến để theo dõi nếu component đã unmount
  const isMounted = useRef(true);

  // Khởi tạo animation values cho danh sách phê duyệt
  useEffect(() => {
    if (pendingApprovals.length > 0 && itemAnimations.current.length === 0) {
      pendingApprovals.forEach((_, index) => {
        itemAnimations.current[index] = {
          fade: new Animated.Value(0),
          translateX: new Animated.Value(50)
        };
      });
      
      // Animate each item
      pendingApprovals.forEach((_, index) => {
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
          })
        ]).start();
      });
    }
  }, [pendingApprovals]);

  useEffect(() => {
    // Thiết lập isMounted khi component mount
    isMounted.current = true;
    
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
      })
    ]).start();
    
    // Tải dữ liệu ban đầu
    fetchData();

    // Cleanup khi component unmount
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Sửa lại useFocusEffect để tránh gọi nhiều lần
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      
      if (isActive) {
        fetchData();
      }
      
      return () => {
        isActive = false;
      };
    }, [])
  );

  const fetchData = async () => {
    if (!isMounted.current) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Thêm timeout để tránh treo vô hạn
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout fetching data')), 15000)
      );
      
      // Chạy song song với timeout
      await Promise.race([
        Promise.all([
          fetchStats(),
          fetchPendingApprovals(),
          fetchUserProfile()
        ]),
        timeoutPromise
      ]);
    } catch (error: unknown) {
      console.error('Error fetching dashboard data:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred');
      }
      
      // Thiết lập dữ liệu mặc định để tránh màn hình trống
      setStats({
        totalActivities: 0,
        pendingActivities: 0,
        totalStudents: 0,
        approvedActivities: 0,
      });
      
      setPendingApprovals([]);
      setFilteredApprovals([]);
      
      if (isMounted.current) {
        Alert.alert(
          'Lỗi kết nối',
          'Không thể tải dữ liệu. Vui lòng kiểm tra kết nối mạng và thử lại.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      // Đảm bảo luôn tắt loading state
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      if (isMounted.current) {
        setRefreshing(false);
      }
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists) {
        throw new Error('User profile not found');
      }
      
      const userData = userDoc.data();
      
      if (isMounted.current) {
        setUserProfile({
          displayName: userData?.displayName || auth.currentUser?.displayName || 'Quản lý',
          email: userData?.email || auth.currentUser?.email || '',
          photoURL: userData?.photoURL || auth.currentUser?.photoURL,
          department: userData?.department || 'Chưa cập nhật',
          position: userData?.position || 'Quản lý'
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };

  const fetchStats = async () => {
    try {
      const activitiesSnapshot = await getDocs(collection(db, 'activities'));
      const usersSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      
      const totalActivities = activitiesSnapshot.size;
      const pendingActivities = activitiesSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.status === 'pending';
      }).length;
      
      const approvedActivities = activitiesSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.status === 'approved';
      }).length;
      
      const totalStudents = usersSnapshot.size;

      if (isMounted.current) {
        setStats({
          totalActivities,
          pendingActivities,
          totalStudents,
          approvedActivities,
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching statistics:', errorMessage);
      throw new Error(errorMessage);
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      // Thêm timeout cho truy vấn
      const approvalsPromise = Promise.race([
        getDocs(query(
          collection(db, 'activities'),
          where('status', '==', 'pending'),
          orderBy('createdAt', 'desc'),
          limit(5)
        )),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout fetching approvals')), 10000))
      ]);
      
      const approvalsSnapshot = await approvalsPromise as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;
      
      // Kiểm tra nếu snapshot tồn tại
      if (!approvalsSnapshot) {
        throw new Error('Failed to fetch pending approvals');
      }

      // Thêm kiểm tra để tránh lỗi khi truy cập docs
      const pendingApprovalsData = approvalsSnapshot.docs.map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data?.name || 'Hoạt động không tên',
          date: data?.createdAt ? data.createdAt.toDate() : new Date(),
          location: data?.location || 'Chưa cập nhật',
          createdBy: data?.createdBy || 'Không xác định',
          participantsCount: data?.participants ? data.participants.length : 0
        };
      });

      if (isMounted.current) {
        // Reset animation values
        itemAnimations.current = [];
        
        setPendingApprovals(pendingApprovalsData);
        setFilteredApprovals(pendingApprovalsData);
      }
    } catch (error: unknown) {
      console.error('Error fetching pending approvals:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown error occurred while fetching approvals');
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim() === '') {
      setFilteredApprovals(pendingApprovals);
      return;
    }
    
    const filtered = pendingApprovals.filter(approval => 
      approval.title.toLowerCase().includes(text.toLowerCase()) ||
      approval.location.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredApprovals(filtered);
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
                  const unsubscribe = onSnapshot(collection(db, 'notifications'), () => {});
                  unsubscribe();
                  await auth.signOut();
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

  const renderApprovalItem = ({ item, index }: { item: PendingApproval; index: number }) => {
    const formattedDate = item.date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    const itemAnim = itemAnimations.current[index] || { 
      fade: new Animated.Value(1), 
      translateX: new Animated.Value(0) 
    };

    return (
      <Animated.View 
        style={[
          styles.approvalItem,
          { 
            opacity: itemAnim.fade,
            transform: [{ translateX: itemAnim.translateX }],
            borderLeftColor: '#FFC107',
          }
        ]}
      >
        <TouchableOpacity 
          onPress={() => router.push({
            pathname: "./(staffs)/activity-detail",
            params: { activityId: item.id }
          })}
          activeOpacity={0.7}
        >
          <Text style={styles.approvalTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.approvalInfoRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.approvalInfo}>{formattedDate}</Text>
          </View>
          <View style={styles.approvalInfoRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.approvalInfo} numberOfLines={1}>{item.location}</Text>
          </View>
          <View style={styles.approvalInfoRow}>
            <Ionicons name="people-outline" size={16} color="#666" />
            <Text style={styles.approvalInfo}>{item.participantsCount} người tham gia</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Chờ duyệt</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Thêm nút Retry khi có lỗi
  if (error) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <Ionicons name="cloud-offline-outline" size={48} color="#F44336" />
        <Text style={styles.errorText}>Không thể tải dữ liệu</Text>
        <Text style={styles.errorSubText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={fetchData}
        >
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Thêm nút Skip loading để người dùng có thể bỏ qua màn hình loading
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        <TouchableOpacity 
          style={styles.skipButton}
          onPress={() => setLoading(false)}
        >
          <Text style={styles.skipButtonText}>Bỏ qua</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <View style={styles.header}>
        <View style={styles.headerLeftSection}>
          <Ionicons name="briefcase-outline" size={24} color="#007AFF" />
          <Text style={styles.headerText}>Manager Dashboard</Text>
        </View>
        <View style={styles.headerRightSection}>
          <TouchableOpacity 
            onPress={() => setShowSearch(!showSearch)} 
            style={styles.headerButton}
          >
            <Ionicons name={showSearch ? "close-outline" : "search-outline"} size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={onRefresh} 
            style={styles.headerButton}
          >
            <Ionicons name="refresh-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={logout} 
            style={styles.headerButton}
          >
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
              transform: [{ translateY }]
            }
          ]}
        >
          <View style={styles.searchInputContainer}>
            <Ionicons name="search-outline" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm hoạt động..."
              value={searchQuery}
              onChangeText={handleSearch}
              placeholderTextColor="#999"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
      >
        {/* Profile Section */}
        <Animated.View 
          style={[
            styles.profileContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY }]
            }
          ]}
        >
          <View style={styles.profileHeader}>
            <View style={styles.profileInfo}>
              <Text style={styles.welcomeText}>Xin chào,</Text>
              <Text style={styles.profileName}>{userProfile?.displayName || 'Quản lý'}</Text>
              <Text style={styles.profileDetail}>{userProfile?.position || 'Quản lý'}</Text>
              <Text style={styles.profileDetail}>{userProfile?.department || 'Chưa cập nhật'}</Text>
            </View>
            <View style={styles.profileImageContainer}>
              {userProfile?.photoURL ? (
                <Image 
                  source={{ uri: userProfile.photoURL }} 
                  style={styles.profileImage} 
                  resizeMode="cover"
                />
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
            value={stats.totalActivities} 
            label="Tổng hoạt động" 
            icon="calendar-outline" 
            color="#007AFF" 
            fadeAnim={fadeAnim}
            translateY={translateY}
          />
          <StatCard 
            value={stats.approvedActivities} 
            label="Đã duyệt" 
            icon="checkmark-circle-outline" 
            color="#4CAF50" 
            fadeAnim={fadeAnim}
            translateY={translateY}
          />
          <StatCard 
            value={stats.pendingActivities} 
            label="Chờ duyệt" 
            icon="time-outline" 
            color="#FFC107" 
            fadeAnim={fadeAnim}
            translateY={translateY}
          />
          <StatCard 
            value={stats.totalStudents} 
            label="Sinh viên" 
            icon="people-outline" 
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
              transform: [{ translateY }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Thao tác nhanh</Text>
          </View>
          <View style={styles.quickActionButtons}>
            <DashboardButton 
              title="Tạo hoạt động" 
              icon="add-circle-outline" 
              onPress={() => router.push("./TaoHD")}
              color="#007AFF"
              containerStyle={styles.quickActionButton}
            />
            <DashboardButton 
              title="Duyệt hoạt động" 
              icon="checkmark-circle-outline" 
              onPress={() => router.push("./DuyetHD")}
              color="#4CAF50"
              containerStyle={styles.quickActionButton}
            />
            <DashboardButton 
              title="Gửi thông báo" 
              icon="notifications-outline" 
              onPress={() => router.push("./GuiThongBao")}
              color="#FF9500"
              containerStyle={styles.quickActionButton}
            />
          </View>
        </Animated.View>
        
        {/* Pending Approvals Section */}
        <Animated.View 
          style={[
            styles.pendingApprovalsContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hoạt động chờ duyệt</Text>
            <TouchableOpacity 
              onPress={() => router.push("./HDChoDuyet")}
              style={styles.viewMoreButton}
            >
              <Text style={styles.viewMoreText}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>
          
          {filteredApprovals.length > 0 ? (
            <FlatList
              data={filteredApprovals}
              renderItem={renderApprovalItem}
              keyExtractor={(item) => item.id}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.approvalsList}
            />
          ) : searchQuery ? (
            <View style={styles.noDataContainer}>
              <Ionicons name="search-outline" size={48} color="#ccc" />
              <Text style={styles.noDataText}>Không tìm thấy hoạt động phù hợp</Text>
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#ccc" />
              <Text style={styles.noDataText}>Không có hoạt động nào chờ duyệt</Text>
            </View>
          )}
        </Animated.View>
        
        {/* Main Navigation Section */}
        <Animated.View 
          style={[
            styles.mainNavigationContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY }]
            }
          ]}
        >
          <Text style={styles.sectionTitle}>Truy cập nhanh</Text>
          <View style={styles.buttonContainer}>
            <DashboardButton 
              title="Quản lý hoạt động" 
              icon="calendar-outline" 
              onPress={() => router.push("./QuanLyHD")}
              color="#007AFF"
            />
            <DashboardButton 
              title="Thống kê hoạt động" 
              icon="bar-chart-outline" 
              onPress={() => router.push("./ThongKeHD")}
              color="#FF9800"
            />
            <DashboardButton 
              title="Quản lý sinh viên" 
              icon="people-outline" 
              onPress={() => router.push("./QuanLySV")}
              color="#4CAF50"
            />
            <DashboardButton 
              title="Báo cáo" 
              icon="document-text-outline" 
              onPress={() => router.push("./BaoCaoHD")}
              color="#9C27B0"
            />
            <DashboardButton 
              title="Duyệt hoạt động" 
              icon="checkmark-circle-outline" 
              onPress={() => router.push("./DuyetHD")}
              color="#F44336"
            />
            <DashboardButton 
              title="Phê duyệt sinh viên" 
              icon="person-add-outline" 
              onPress={() => router.push("./DuyetSV")}
              color="#2196F3"
            />
            <DashboardButton 
              title="Quản lý thông báo" 
              icon="notifications-outline" 
              onPress={() => router.push("./QuanLyTB")}
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
          <Text style={styles.footerText}>© 2023 Manager Dashboard</Text>
          <Text style={styles.footerVersion}>Phiên bản 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
  },
  errorSubText: {
    marginTop: 5,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  skipButton: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
  },
  skipButtonText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
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
    color: '#333',
  },
  profileContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  profileDetail: {
    fontSize: 14,
    color: '#666',
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
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
  },
  statItem: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  quickActionsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewMoreText: {
    fontSize: 14,
    color: '#007AFF',
  },
  quickActionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    width: '30%',
    marginBottom: 10,
  },
  pendingApprovalsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  approvalsList: {
    paddingVertical: 8,
  },
  approvalItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginRight: 16,
    width: 250,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  approvalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  approvalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  approvalInfo: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  statusBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#FFF8E1',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFC107',
  },
  mainNavigationContainer: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  dashboardButtonContainer: {
    width: '48%',
    marginBottom: 16,
  },
  dashboardButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dashboardButtonText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  noDataText: {
    marginTop: 8,
    fontSize: 16,
    color: '#999',
  },
  footer: {
    padding: 16,
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  footerVersion: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});

export default ManagerScreen;