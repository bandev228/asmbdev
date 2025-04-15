import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const ChiTietHoatDong = () => {
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const route = useRoute();
  const { activityId } = route.params;

  useEffect(() => {
    const fetchActivityDetails = async () => {
      try {
        const activityDoc = await firestore().collection('activities').doc(activityId).get();
        if (activityDoc.exists) {
          setActivity({ id: activityDoc.id, ...activityDoc.data() });
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết hoạt động</Text>
      </View>
      <ScrollView style={styles.content}>
        <Text style={styles.activityName}>{activity.name}</Text>
        <Text style={styles.activityDate}>
          Từ: {new Date(activity.startDate.toDate()).toLocaleString()}
        </Text>
        <Text style={styles.activityDate}>
          Đến: {new Date(activity.endDate.toDate()).toLocaleString()}
        </Text>
        <Text style={styles.activityDescription}>Nội dung: {activity.description}</Text>
        <Text style={styles.activityLocation}>Địa điểm: {activity.location}</Text>
        <Text style={styles.activityParticipants}>
          Số người tham gia: {activity.participants ? activity.participants.length : 0}
        </Text>
        {/* Thêm các thông tin khác của hoạt động nếu cần */}
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