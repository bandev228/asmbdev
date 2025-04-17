import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { getFirestore, collection, query, where, getDocs } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

interface ActivityStats {
  totalActivities: number;
  approvedActivities: number;
  pendingActivities: number;
  rejectedActivities: number;
  totalHours: number;
  activitiesByMonth: { [key: string]: number };
  activitiesByCategory: { [key: string]: number };
}

interface Activity {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: string;
  participantLimit: number;
  participants: number;
  status: 'pending' | 'approved' | 'rejected';
  category?: string;
  imageUrl?: string;
}

const ThongKeHD = () => {
  const [stats, setStats] = useState<ActivityStats>({
    totalActivities: 0,
    approvedActivities: 0,
    pendingActivities: 0,
    rejectedActivities: 0,
    totalHours: 0,
    activitiesByMonth: {},
    activitiesByCategory: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  const router = useRouter();
  const auth = getAuth();
  const db = getFirestore();

  useEffect(() => {
    fetchStats();
  }, [selectedPeriod]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const activitiesQuery = query(
        collection(db, "activities"),
        where("participants", "array-contains", userId)
      );

      const snapshot = await getDocs(activitiesQuery);
      const activities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate()
      })) as Activity[];

      // Calculate statistics
      const newStats: ActivityStats = {
        totalActivities: activities.length,
        approvedActivities: activities.filter(a => a.status === 'approved').length,
        pendingActivities: activities.filter(a => a.status === 'pending').length,
        rejectedActivities: activities.filter(a => a.status === 'rejected').length,
        totalHours: activities.reduce((total, activity) => {
          if (activity.startDate && activity.endDate) {
            const hours = (activity.endDate.getTime() - activity.startDate.getTime()) / (1000 * 60 * 60);
            return total + hours;
          }
          return total;
        }, 0),
        activitiesByMonth: {},
        activitiesByCategory: {}
      };

      // Calculate activities by month
      activities.forEach(activity => {
        if (activity.startDate) {
          const month = format(activity.startDate, 'MM/yyyy', { locale: vi });
          newStats.activitiesByMonth[month] = (newStats.activitiesByMonth[month] || 0) + 1;
        }
      });

      // Calculate activities by category
      activities.forEach(activity => {
        const category = activity.category || 'Khác';
        newStats.activitiesByCategory[category] = (newStats.activitiesByCategory[category] || 0) + 1;
      });

      setStats(newStats);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching stats:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setLoading(false);
    }
  };

  const renderStatCard = (title: string, value: number | string, icon: string, color: string) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statIconContainer}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Thống kê</Text>
        <TouchableOpacity onPress={fetchStats} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === 'week' && styles.selectedPeriodButton]}
            onPress={() => setSelectedPeriod('week')}
          >
            <Text style={[styles.periodText, selectedPeriod === 'week' && styles.selectedPeriodText]}>
              Tuần
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === 'month' && styles.selectedPeriodButton]}
            onPress={() => setSelectedPeriod('month')}
          >
            <Text style={[styles.periodText, selectedPeriod === 'month' && styles.selectedPeriodText]}>
              Tháng
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === 'year' && styles.selectedPeriodButton]}
            onPress={() => setSelectedPeriod('year')}
          >
            <Text style={[styles.periodText, selectedPeriod === 'year' && styles.selectedPeriodText]}>
              Năm
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          {renderStatCard('Tổng số hoạt động', stats.totalActivities, 'calendar', '#4CAF50')}
          {renderStatCard('Đã phê duyệt', stats.approvedActivities, 'checkmark-circle', '#2196F3')}
          {renderStatCard('Đang chờ', stats.pendingActivities, 'time', '#FFC107')}
          {renderStatCard('Tổng giờ tham gia', Math.round(stats.totalHours), 'time', '#9C27B0')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Phân bố theo tháng</Text>
          <View style={styles.chartContainer}>
            {Object.entries(stats.activitiesByMonth).map(([month, count]) => (
              <View key={month} style={styles.chartBarContainer}>
                <View style={styles.chartBar}>
                  <View 
                    style={[
                      styles.chartBarFill,
                      { height: `${(count / Math.max(...Object.values(stats.activitiesByMonth))) * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.chartLabel}>{month}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Phân bố theo loại</Text>
          <View style={styles.categoryList}>
            {Object.entries(stats.activitiesByCategory).map(([category, count]) => (
              <View key={category} style={styles.categoryItem}>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{category}</Text>
                  <Text style={styles.categoryCount}>{count} hoạt động</Text>
                </View>
                <View style={styles.categoryProgress}>
                  <View 
                    style={[
                      styles.categoryProgressBar,
                      { 
                        width: `${(count / stats.totalActivities) * 100}%`,
                        backgroundColor: getCategoryColor(category)
                      }
                    ]} 
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getCategoryColor = (category: string): string => {
  const colors: { [key: string]: string } = {
    'Học tập': '#4CAF50',
    'Thể thao': '#2196F3',
    'Văn nghệ': '#9C27B0',
    'Tình nguyện': '#FF9800',
    'Khác': '#607D8B'
  };
  return colors[category] || '#607D8B';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: screenWidth * 0.04,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: screenWidth * 0.02,
  },
  refreshButton: {
    padding: screenWidth * 0.02,
  },
  title: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: screenWidth * 0.04,
  },
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: screenHeight * 0.02,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: screenWidth * 0.02,
  },
  periodButton: {
    flex: 1,
    paddingVertical: screenWidth * 0.02,
    alignItems: 'center',
    borderRadius: 8,
  },
  selectedPeriodButton: {
    backgroundColor: '#007AFF',
  },
  periodText: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
  },
  selectedPeriodText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: screenHeight * 0.02,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.02,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: screenHeight * 0.01,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: screenWidth * 0.06,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: screenHeight * 0.005,
  },
  statTitle: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.02,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: screenHeight * 0.02,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: screenHeight * 0.2,
    paddingVertical: screenHeight * 0.02,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
  },
  chartBar: {
    width: '80%',
    height: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  chartBarFill: {
    backgroundColor: '#007AFF',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  chartLabel: {
    fontSize: screenWidth * 0.03,
    color: '#666666',
    marginTop: screenHeight * 0.01,
  },
  categoryList: {
    marginTop: screenHeight * 0.01,
  },
  categoryItem: {
    marginBottom: screenHeight * 0.02,
  },
  categoryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: screenHeight * 0.01,
  },
  categoryName: {
    fontSize: screenWidth * 0.035,
    color: '#333333',
    fontWeight: '500',
  },
  categoryCount: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
  },
  categoryProgress: {
    height: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  categoryProgressBar: {
    height: '100%',
    borderRadius: 4,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: screenHeight * 0.02,
  },
});

export default ThongKeHD;