import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from '@react-native-firebase/firestore';

interface Activity {
  id: string;
  name: string;
  description: string;
  location: string;
  startDate: Timestamp;
  endDate: Timestamp;
  participants?: string[];
}

const ChiTietHoatDong = () => {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const db = getFirestore();

  useEffect(() => {
    const fetchActivityDetails = async () => {
      if (!activityId) return;
      
      try {
        const activityDoc = await getDoc(doc(db, 'activities', activityId));
        if (activityDoc.exists) {
          setActivity({
            id: activityDoc.id,
            ...activityDoc.data()
          } as Activity);
        } else {
          console.log('No such activity!');
        }
      } catch (error) {
        console.error('Error fetching activity details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivityDetails();
  }, [activityId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={styles.container}>
        <Text>Không tìm thấy hoạt động.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết hoạt động</Text>
      </View>
      <ScrollView style={styles.content}>
        <Text style={styles.activityName}>{activity.name}</Text>
        <Text style={styles.activityDate}>
          Từ: {activity.startDate.toDate().toLocaleString()}
        </Text>
        <Text style={styles.activityDate}>
          Đến: {activity.endDate.toDate().toLocaleString()}
        </Text>
        <Text style={styles.activityDescription}>Nội dung: {activity.description}</Text>
        <Text style={styles.activityLocation}>Địa điểm: {activity.location}</Text>
        <Text style={styles.activityParticipants}>
          Số người tham gia: {activity.participants ? activity.participants.length : 0}
        </Text>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  activityName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  activityDate: {
    fontSize: 16,
    marginBottom: 8,
  },
  activityDescription: {
    fontSize: 16,
    marginBottom: 16,
  },
  activityLocation: {
    fontSize: 16,
    marginBottom: 8,
  },
  activityParticipants: {
    fontSize: 16,
    marginBottom: 8,
  },
});

export default ChiTietHoatDong;