import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { getFirestore, collection, query, where, getDocs, Timestamp } from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

interface Activity {
  id: string;
  name: string;
  pendingCount: number;
  pendingParticipants?: string[];
}

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const DuyetSVTGHD = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { theme } = useTheme();

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getFirestore();
      const activitiesQuery = query(
        collection(db, 'activities'),
        where('pendingParticipants', '!=', [])
      );

      const snapshot = await getDocs(activitiesQuery);
      const activitiesList = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          const pendingParticipants = data.pendingParticipants || [];
          const pendingCount = pendingParticipants.length;

          return {
            id: doc.id,
            name: data.name,
            pendingCount,
            pendingParticipants
          } as Activity;
        })
      );

      setActivities(activitiesList.filter(activity => activity.pendingCount > 0));
    } catch (error) {
      console.error('Error fetching activities:', error);
      setError('Không thể lấy danh sách hoạt động. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const renderActivityItem = ({ item }: { item: Activity }) => (
    <TouchableOpacity
      style={[styles.activityItem, { backgroundColor: theme.colors.card }]}
      onPress={() => router.push({
        pathname: './DuyetSV',
        params: { activityId: item.id, activityName: item.name }
      })}
    >
      <Text style={[styles.activityName, { color: theme.colors.text }]}>{item.name}</Text>
      <Text style={[styles.pendingCount, { color: theme.colors.secondary }]}>
        Sinh viên chờ duyệt: {item.pendingCount}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Danh sách sinh viên chờ duyệt</Text>
        <TouchableOpacity onPress={fetchActivities} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={fetchActivities}
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : activities.length > 0 ? (
        <FlatList
          data={activities}
          renderItem={renderActivityItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <Text style={[styles.noActivitiesText, { color: theme.colors.secondary }]}>
          Không có hoạt động nào có sinh viên chờ duyệt.
        </Text>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: screenWidth * 0.04,
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
    flex: 1,
    textAlign: 'center',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: screenWidth * 0.04,
  },
  activityItem: {
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.02,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityName: {
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    marginBottom: screenHeight * 0.01,
  },
  pendingCount: {
    fontSize: screenWidth * 0.035,
  },
  noActivitiesText: {
    fontSize: screenWidth * 0.04,
    textAlign: 'center',
    padding: screenWidth * 0.04,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DuyetSVTGHD;
