import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator, 
  RefreshControl,
  Platform,
  StatusBar,
  Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, collection, getDocs, query, where, Timestamp } from '@react-native-firebase/firestore';
import { PieChart } from 'react-native-chart-kit';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { ActivityData, ChartDataItem, DashboardStats } from './hooks/types';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

export default function ThongKeHD() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalActivities: 0,
    pendingActivities: 0,
    totalUsers: 0,
    approvedActivities: 0
  });
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const db = getFirestore();
      const activitiesRef = collection(db, 'activities');
      const usersRef = collection(db, 'users');

      // Get all activities
      const activitiesSnapshot = await getDocs(activitiesRef);
      const activities = activitiesSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as ActivityData[];

      // Calculate stats
      const totalActivities = activities.length;
      const pendingActivities = activities.filter(act => act.status === 'pending').length;
      const approvedActivities = activities.filter(act => act.status === 'approved').length;
      const rejectedActivities = activities.filter(act => act.status === 'rejected').length;
      const completedActivities = activities.filter(act => act.status === 'completed').length;

      // Get total users
      const usersSnapshot = await getDocs(usersRef);
      const totalUsers = usersSnapshot.size;

      setStats({
        totalActivities,
        pendingActivities,
        totalUsers,
        approvedActivities
      });

      // Prepare chart data with more detailed status
      const chartData: ChartDataItem[] = [
        {
          name: 'Đã duyệt',
          population: approvedActivities,
          color: '#10b981',
          legendFontColor: '#334155',
          legendFontSize: 12
        },
        {
          name: 'Chờ duyệt',
          population: pendingActivities,
          color: '#f59e0b',
          legendFontColor: '#334155',
          legendFontSize: 12
        },
        {
          name: 'Từ chối',
          population: rejectedActivities,
          color: '#ef4444',
          legendFontColor: '#334155',
          legendFontSize: 12
        },
        {
          name: 'Hoàn thành',
          population: completedActivities,
          color: '#3b82f6',
          legendFontColor: '#334155',
          legendFontSize: 12
        }
      ].filter(item => item.population > 0); // Only show statuses with activities

      setChartData(chartData);
      setError(null);
    } catch (err) {
      setError('Không thể tải dữ liệu thống kê');
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <View style={styles.errorContent}>
          <Ionicons name="cloud-offline-outline" size={64} color="#ef4444" />
          <Text style={styles.errorText}>Không thể tải dữ liệu</Text>
          <Text style={styles.errorSubText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchStats}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Header */}
      <LinearGradient 
        colors={['#3b82f6', '#2563eb']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 0 }} 
        style={styles.header}
      >
        <View style={styles.headerLeftSection}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Thống kê hoạt động</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.headerButton}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3b82f6"]} />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
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
          </View>

          <View style={styles.statCard}>
            <LinearGradient
              colors={['#10b981', '#059669']}
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
          </View>

          <View style={styles.statCard}>
            <LinearGradient
              colors={['#f59e0b', '#d97706']}
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
          </View>

          <View style={styles.statCard}>
            <LinearGradient
              colors={['#8b5cf6', '#7c3aed']}
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
          </View>
        </View>

        {/* Chart Section */}
        <View style={styles.chartContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="pie-chart" size={20} color="#3b82f6" style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Thống kê hoạt động</Text>
            </View>
          </View>
          
          {chartData.length > 0 && stats.totalActivities > 0 ? (
            <>
              <View style={styles.chartWrapper}>
                <PieChart
                  data={chartData}
                  width={isTablet ? 400 : 300}
                  height={220}
                  chartConfig={{
                    backgroundColor: '#ffffff',
                    backgroundGradientFrom: '#ffffff',
                    backgroundGradientTo: '#ffffff',
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
    </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  errorSubText: {
    marginTop: 8,
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
  },
  statCard: {
    width: '48%',
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statCardGradient: {
    padding: 16,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  chartContainer: {
    backgroundColor: '#fff',
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
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
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noDataText: {
    marginTop: 12,
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
});