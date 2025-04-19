import { useState, useEffect, useCallback } from 'react';
import { getFirestore, collection, getDocs, query, orderBy, limit, where } from '@react-native-firebase/firestore';
import { ActivityData, ChartDataItem } from './types';

export const useDashboardData = () => {
  const [stats, setStats] = useState({
    totalActivities: 0,
    pendingActivities: 0,
    totalUsers: 0,
    approvedActivities: 0,
  });
  const [featuredActivities, setFeaturedActivities] = useState<(ActivityData & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const db = getFirestore();
      const [activitiesSnapshot, usersSnapshot] = await Promise.all([
        getDocs(collection(db, 'activities')),
        getDocs(collection(db, 'users'))
      ]);

      const totalActivities = activitiesSnapshot.size;
      const pendingActivities = activitiesSnapshot.docs.filter(doc => doc.data().status === 'pending').length;
      const approvedActivities = activitiesSnapshot.docs.filter(doc => doc.data().status === 'approved').length;
      const totalUsers = usersSnapshot.size;

      setStats({
        totalActivities,
        pendingActivities,
        totalUsers,
        approvedActivities,
      });

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

      // Fetch featured activities
      const featuredQuery = query(
        collection(db, 'activities'),
        orderBy('participants', 'desc'),
        limit(10)
      );
      
      const featuredSnapshot = await getDocs(featuredQuery);
      const featuredActivitiesData = featuredSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (ActivityData & { id: string })[];

      setFeaturedActivities(featuredActivitiesData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    stats,
    featuredActivities,
    loading,
    error,
    chartData,
    refetch: fetchData
  };
}; 

export default useDashboardData;