import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, TextInput, FlatList, Alert, Dimensions, ActivityIndicator, RefreshControl, Platform, Animated, StatusBar} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApp } from '@react-native-firebase/app';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { PieChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@react-navigation/native';
import { getFirestore, collection, query, where, getDocs } from '@react-native-firebase/firestore';
import { ActivityData, ChartDataItem, DashboardStats } from './hooks/types';

import { useDashboardData } from './hooks/useDashboardData';
import { StatCard } from './components/StatCard';
import { DashboardButton } from './components/DashboardButton';
import { FeaturedActivityItem } from './components/FeaturedActivityItem';

const { width, height } = Dimensions.get('window');
const isTablet = width > 768;

// Initialize Firebase
const app = getApp();
const auth = getAuth();

const fetchDashboardData = async (): Promise<DashboardStats> => {
  const db = getFirestore();
  const activitiesRef = collection(db, 'activities');
  const usersRef = collection(db, 'users');

  const [activitiesSnapshot, usersSnapshot] = await Promise.all([
    getDocs(activitiesRef),
    getDocs(usersRef)
  ]);

  const activities = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityData));
  const totalActivities = activities.length;
  const pendingActivities = activities.filter(activity => activity.status === 'pending').length;
  const approvedActivities = activities.filter(activity => activity.status === 'approved').length;
  const totalUsers = usersSnapshot.size;

  return {
    totalActivities,
    pendingActivities,
    totalUsers,
    approvedActivities
  };
};

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filteredActivities, setFilteredActivities] = useState<(ActivityData & { id: string })[]>([]);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(50)).current;
  const itemAnimations = useRef<{ fade: Animated.Value; translateX: Animated.Value; }[]>([]);

  // Use custom hook for dashboard data
  const { 
    stats, 
    featuredActivities, 
    loading, 
    error, 
    chartData, 
    refetch 
  } = useDashboardData();

  // Initialize animations for featured activities
  useEffect(() => {
    if (featuredActivities.length > 0 && itemAnimations.current.length === 0) {
      featuredActivities.forEach((_, index) => {
        itemAnimations.current[index] = {
          fade: new Animated.Value(0),
          translateX: new Animated.Value(50)
        };
      });
      
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
  }, []);

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

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

  if (error) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <Ionicons name="cloud-offline-outline" size={48} color="#F44336" />
        <Text style={styles.errorText}>Không thể tải dữ liệu</Text>
        <Text style={styles.errorSubText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={refetch}
        >
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </SafeAreaView>
    );
  }

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
            refreshing={loading}
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
              renderItem={({ item, index }) => (
                <FeaturedActivityItem
                  item={item}
                  index={index}
                  onPress={() => navigateToActivityDetail(item.id)}
                  itemAnimations={itemAnimations.current}
                />
              )}
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