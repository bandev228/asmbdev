import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, TextInput, FlatList, Alert, Dimensions, ActivityIndicator, RefreshControl, Platform, Animated, StatusBar} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApp } from '@react-native-firebase/app';
import { 
  getAuth,
  signOut 
} from '@react-native-firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
  limit,
  Timestamp,
  where
} from '@react-native-firebase/firestore';
import { PieChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const isTablet = width > 768;

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

interface AnimationItem {
  fade: Animated.Value;
  translateX: Animated.Value;
}

interface ChartDataItem {
  name: string;
  population: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

interface ActivityData {
  id?: string;
  name: string;
  participants: string[];
  status: 'pending' | 'approved';
  date: Timestamp;
  location: string;
  createdAt?: Timestamp;
  description?: string;
}

// Initialize Firebase - React Native Firebase handles initialization automatically
const app = getApp();
const auth = getAuth();
const firestore = getFirestore();

// Tách DashboardButton ra khỏi component chính
const DashboardButton = ({ title, icon, onPress, color = '#007AFF' }: DashboardButtonProps) => {
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
const StatCard = ({ value, label, icon, color, fadeAnim, translateY }: StatCardProps) => (
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

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState({
    totalActivities: 0,
    pendingActivities: 0,
    totalUsers: 0,
    approvedActivities: 0,
  });
  const [featuredActivities, setFeaturedActivities] = useState<(ActivityData & { id: string })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [filteredActivities, setFilteredActivities] = useState<(ActivityData & { id: string })[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(50)).current;

  // Tạo mảng để lưu trữ animation values cho danh sách hoạt động
  const itemAnimations = useRef<AnimationItem[]>([]);
  
  // Thêm biến để theo dõi nếu component đã unmount
  const isMounted = useRef(true);

  // Khởi tạo animation values cho danh sách hoạt động
  useEffect(() => {
    if (featuredActivities.length > 0 && itemAnimations.current.length === 0) {
      featuredActivities.forEach((_, index) => {
        itemAnimations.current[index] = {
          fade: new Animated.Value(0),
          translateX: new Animated.Value(50)
        };
      });
      
      // Animate each item
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
          })
        ]).start();
      });
    }
  }, [featuredActivities]);

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

  // Sửa lại hàm fetchData để xử lý lỗi tốt hơn và có fallback
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
          fetchFeaturedActivities()
        ]),
        timeoutPromise
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      
      // Thiết lập dữ liệu mặc định để tránh màn hình trống
      setStats({
        totalActivities: 0,
        pendingActivities: 0,
        totalUsers: 0,
        approvedActivities: 0,
      });
      
      setChartData([
        {
          name: 'Đã duyệt',
          population: 0,
          color: '#4CAF50',
          legendFontColor: '#7F7F7F',
          legendFontSize: 13,
        },
        {
          name: 'Chờ duyệt',
          population: 0,
          color: '#FFC107',
          legendFontColor: '#7F7F7F',
          legendFontSize: 13,
        },
      ]);
      
      setFeaturedActivities([]);
      setFilteredActivities([]);
      
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

  // Sửa lại hàm fetchStats để xử lý lỗi tốt hơn và có fallback
  const fetchStats = async () => {
    try {
      const activitiesRef = collection(firestore, 'activities');
      const usersRef = collection(firestore, 'users');
      
      const [activitiesSnapshot, usersSnapshot] = await Promise.all([
        getDocs(activitiesRef),
        getDocs(usersRef)
      ]);

      if (!activitiesSnapshot || !usersSnapshot) {
        throw new Error('Failed to fetch data from Firestore');
      }

      const totalActivities = activitiesSnapshot.size;
      const pendingActivities = activitiesSnapshot.docs.filter(doc => doc.data().status === 'pending').length;
      const approvedActivities = activitiesSnapshot.docs.filter(doc => doc.data().status === 'approved').length;
      const totalUsers = usersSnapshot.size;

      if (isMounted.current) {
        const newStats = {
          totalActivities,
          pendingActivities,
          totalUsers,
          approvedActivities,
        };
        
        setStats(newStats);
        setChartData([
          {
            name: 'Đã duyệt',
            population: approvedActivities,
            color: '#4CAF50',
            legendFontColor: '#7F7F7F',
            legendFontSize: 13,
          },
          {
            name: 'Chờ duyệt',
            population: pendingActivities,
            color: '#FFC107',
            legendFontColor: '#7F7F7F',
            legendFontSize: 13,
          },
        ]);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  };

  // Sửa lại hàm fetchFeaturedActivities để xử lý lỗi tốt hơn
  const fetchFeaturedActivities = useCallback(async () => {
    try {
      const activitiesRef = collection(firestore, 'activities');
      const activitiesQuery = query(
        activitiesRef,
        orderBy('participants', 'desc'),
        limit(10)
      );
      
      const snapshot = await getDocs(activitiesQuery);
      const featuredActivitiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (ActivityData & { id: string })[];

      if (isMounted.current) {
        itemAnimations.current = [];
        setFeaturedActivities(featuredActivitiesData);
        setFilteredActivities(featuredActivitiesData);
      }
    } catch (error) {
      console.error('Error fetching featured activities:', error);
      throw error;
    }
  }, []);

  // Fix: Replace router.events.on with useFocusEffect from expo-router
  useFocusEffect(
    useCallback(() => {
      // This runs when the screen is focused
      fetchData();
      
      // Return a cleanup function
      return () => {
        // This runs when the screen is unfocused
      };
    }, [])
  );

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim() === '') {
      setFilteredActivities(featuredActivities);
      return;
    }
    
    const filtered = featuredActivities.filter(activity => 
      activity.name.toLowerCase().includes(text.toLowerCase()) ||
      activity.location.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredActivities(filtered);
  };

  const logout = async () => {
    Alert.alert(
      'Đăng xuất Admin',
      'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản admin?',
      [
        {
          text: 'Hủy',
          style: 'cancel'
        },
        {
          text: 'Đăng xuất',
          onPress: async () => {
            try {
              setLoading(true);
              
              await AsyncStorage.multiRemove([
                '@admin_session',
                '@admin_settings',
                '@last_activity',
                '@notification_token'
              ]);

              await signOut(auth);
              router.replace('/(auth)/login');

            } catch (error) {
              console.error('Lỗi trong quá trình đăng xuất:', error);
              Alert.alert(
                'Lỗi đăng xuất',
                'Không thể đăng xuất. Vui lòng thử lại.',
                [{ text: 'OK' }]
              );
            } finally {
              setLoading(false);
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  const navigateToActivityDetail = (activityId: string) => {
    router.push("./HoatDong");
  };

  // Sửa lại renderFeaturedActivityItem để kiểm tra date
  const renderFeaturedActivityItem = ({ 
    item,
    index 
  }: { 
    item: ActivityData & { id: string }; 
    index: number 
  }) => {
    const isApproved = item.status === 'approved';
    const formattedDate = item.date ? item.date.toDate().toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) : 'Chưa có ngày';

    // Sử dụng animation values đã được tạo trước đó
    const itemAnim = itemAnimations.current[index] || { fade: new Animated.Value(1), translateX: new Animated.Value(0) };

    return (
      <Animated.View 
        style={[
          styles.featuredActivityItem,
          { 
            opacity: itemAnim.fade,
            transform: [{ translateX: itemAnim.translateX }],
            borderLeftColor: isApproved ? '#4CAF50' : '#FFC107',
          }
        ]}
      >
        <TouchableOpacity 
          onPress={() => navigateToActivityDetail(item.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.featuredActivityName} numberOfLines={1}>{item.name || 'Không có tiêu đề'}</Text>
          <View style={styles.activityInfoRow}>
            <Ionicons name="people-outline" size={16} color="#666" />
            <Text style={styles.featuredActivityInfo}>{item.participants?.length || 0} người tham gia</Text>
          </View>
          <View style={styles.activityInfoRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.featuredActivityInfo}>{formattedDate}</Text>
          </View>
          <View style={styles.activityInfoRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.featuredActivityInfo} numberOfLines={1}>{item.location || 'Chưa có địa điểm'}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={[
              styles.statusText, 
              { color: isApproved ? '#4CAF50' : '#FFC107' }
            ]}>
              {isApproved ? 'Đã duyệt' : 'Chờ duyệt'}
            </Text>
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

  // Phần còn lại của component giữ nguyên
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <View style={styles.header}>
        <View style={styles.headerLeftSection}>
          <Ionicons name="grid-outline" size={24} color="#007AFF" />
          <Text style={styles.headerText}>Admin Dashboard</Text>
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
            value={stats.totalUsers} 
            label="Người dùng" 
            icon="people-outline" 
            color="#9C27B0" 
            fadeAnim={fadeAnim}
            translateY={translateY}
          />
        </View>
        
        <Animated.View 
          style={[
            styles.chartsContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Thống kê hoạt động</Text>
            <TouchableOpacity 
              onPress={() => router.push('./ThongKeHD')}
              style={styles.viewMoreButton}
            >
              <Text style={styles.viewMoreText}>Xem chi tiết</Text>
              <Ionicons name="chevron-forward" size={16} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          {chartData.length > 0 && stats.totalActivities > 0 ? (
            <PieChart
              data={chartData}
              width={isTablet ? 400 : 300}
              height={200}
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                style: {
                  borderRadius: 16
                },
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft={isTablet ? "50" : "15"}
              absolute
              hasLegend={true}
              center={[isTablet ? 100 : 50, 0]}
            />
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="bar-chart-outline" size={48} color="#ccc" />
              <Text style={styles.noDataText}>Chưa có dữ liệu thống kê</Text>
            </View>
          )}
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.featuredActivitiesContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hoạt động nổi bật</Text>
            <TouchableOpacity 
              onPress={() => router.push('./HDNoiBat')}
              style={styles.viewMoreButton}
            >
              <Text style={styles.viewMoreText}>Xem tất cả</Text>
              <Ionicons name="chevron-forward" size={16} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          {filteredActivities.length > 0 ? (
            <FlatList
              data={filteredActivities}
              renderItem={renderFeaturedActivityItem}
              keyExtractor={(item) => item.id}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredActivitiesList}
            />
          ) : searchQuery ? (
            <View style={styles.noDataContainer}>
              <Ionicons name="search-outline" size={48} color="#ccc" />
              <Text style={styles.noDataText}>Không tìm thấy hoạt động phù hợp</Text>
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="calendar-outline" size={48} color="#ccc" />
              <Text style={styles.noDataText}>Chưa có hoạt động nổi bật</Text>
            </View>
          )}
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.quickActionsContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY }]
            }
          ]}
        >
          <Text style={styles.sectionTitle}>Truy cập nhanh</Text>
          <View style={styles.buttonContainer}>
            <DashboardButton 
              title="Hoạt động" 
              icon="calendar-outline" 
              onPress={() => router.push('./HoatDong')}
              color="#007AFF"
            />
            <DashboardButton 
              title="Hoạt động đã tạo" 
              icon="create-outline" 
              onPress={() => router.push('./HDDaTao')}
              color="#FF9800"
            />
            <DashboardButton 
              title="Duyệt hoạt động" 
              icon="checkmark-circle-outline" 
              onPress={() => router.push('./DuyetHD')}
              color="#4CAF50"
            />
            <DashboardButton 
              title="Thống kê" 
              icon="bar-chart-outline" 
              onPress={() => router.push('./ThongKeHD')}
              color="#9C27B0"
            />
            <DashboardButton 
              title="Quản lý tài khoản" 
              icon="people-outline" 
              onPress={() => router.push('./QuanLyTK')}
              color="#F44336"
            />
            <DashboardButton 
              title="Phê duyệt sinh viên" 
              icon="person-add-outline" 
              onPress={() => router.push('./DuyetSVTG')}
              color="#2196F3"
            />
            <DashboardButton 
              title="Thông báo" 
              icon="notifications-outline" 
              onPress={() => router.push('./ThongBao')}
              color="#795548"
            />
            <DashboardButton 
              title="Cài đặt" 
              icon="settings-outline" 
              onPress={() => router.push('./CaiDat')}
              color="#607D8B"
            />
          </View>
        </Animated.View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 BTV Dev Academy</Text>
          <Text style={styles.footerVersion}>Phiên bản 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  chartsContainer: {
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
  featuredActivitiesContainer: {
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
  featuredActivitiesList: {
    paddingVertical: 8,
  },
  featuredActivityItem: {
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
  featuredActivityName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  activityInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  featuredActivityInfo: {
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
    backgroundColor: '#f0f0f0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  quickActionsContainer: {
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