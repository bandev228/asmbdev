import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';

const DuyetSinhVien = ({ }) => {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
  
    useEffect(() => {
      fetchActivities();
    }, []);
  
    const fetchActivities = async () => {
      setLoading(true);
      try {
        const activitiesSnapshot = await firestore()
          .collection('activities')
          .where('pendingParticipants', '!=', [])
          .get();

        const activitiesList = await Promise.all(activitiesSnapshot.docs.map(async (doc) => {
          const activityData = doc.data();
          const pendingParticipants = await Promise.all(activityData.pendingParticipants.map(async (userId) => {
            const userDoc = await firestore().collection('users').doc(userId).get();
            return { id: userId, ...userDoc.data() };
          }));
          return { id: doc.id, ...activityData, pendingParticipants };
        }));

        setActivities(activitiesList);
      } catch (error) {
        console.error('Error fetching activities:', error);
        Alert.alert('Lỗi', 'Không thể tải danh sách hoạt động. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };
  
    const handleApprove = async (activityId, userId) => {
      try {
        await firestore().collection('activities').doc(activityId).update({
          participants: firestore.FieldValue.arrayUnion(userId),
          pendingParticipants: firestore.FieldValue.arrayRemove(userId),
        });
        fetchActivities(); // Refresh the list
        Alert.alert('Thành công', 'Đã phê duyệt sinh viên tham gia hoạt động.');
      } catch (error) {
        console.error('Error approving student:', error);
        Alert.alert('Lỗi', 'Không thể phê duyệt sinh viên. Vui lòng thử lại.');
      }
    };
  
    const handleReject = async (activityId, userId) => {
      try {
        await firestore().collection('activities').doc(activityId).update({
          pendingParticipants: firestore.FieldValue.arrayRemove(userId),
        });
        fetchActivities(); // Refresh the list
        Alert.alert('Thành công', 'Đã từ chối sinh viên tham gia hoạt động.');
      } catch (error) {
        console.error('Error rejecting student:', error);
        Alert.alert('Lỗi', 'Không thể từ chối sinh viên. Vui lòng thử lại.');
      }
    };
  
    const renderActivityItem = ({ item }) => {
      const formatDate = (date) => {
        if (date && typeof date.toDate === 'function') {
          return date.toDate().toLocaleDateString();
        }
        return 'Chưa xác định';
      };

      return (
        <View style={styles.activityItem}>
          <Text style={styles.activityName}>{item.name || 'Hoạt động không tên'}</Text>
          <Text style={styles.activityDate}>
            {formatDate(item.startDate)} - {formatDate(item.endDate)}
          </Text>
          <Text style={styles.pendingCount}>Sinh viên chờ duyệt: {item.pendingParticipants.length}</Text>
          <FlatList
            data={item.pendingParticipants}
            keyExtractor={(student) => student.id}
            renderItem={({ item: student }) => (
              <View style={styles.studentItem}>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.fullname || 'Chưa có tên'}</Text>
                  <Text style={styles.studentEmail}>{student.email || 'Chưa có email'}</Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleApprove(item.id, student.id)}
                  >
                    <Ionicons name="checkmark-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleReject(item.id, student.id)}
                  >
                    <Ionicons name="close-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      );
    };
  
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Duyệt sinh viên tham gia</Text>
          <TouchableOpacity onPress={fetchActivities} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        ) : activities.length > 0 ? (
          <FlatList
            data={activities}
            renderItem={renderActivityItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#CCC" />
            <Text style={styles.emptyStateText}>Không có sinh viên nào chờ duyệt.</Text>
          </View>
        )}
      </SafeAreaView>
    );
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
      padding: 16,
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#E0E0E0',
    },
    backButton: {
      padding: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#333333',
    },
    refreshButton: {
      padding: 8,
    },
    listContainer: {
      padding: 16,
    },
    activityItem: {
      backgroundColor: '#FFFFFF',
      borderRadius: 8,
      padding: 16,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.23,
      shadowRadius: 2.62,
      elevation: 4,
    },
    activityName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333333',
      marginBottom: 8,
    },
    activityDate: {
      fontSize: 14,
      color: '#666666',
      marginBottom: 8,
    },
    pendingCount: {
      fontSize: 14,
      color: '#007AFF',
      marginBottom: 16,
    },
    studentItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#E0E0E0',
    },
    studentInfo: {
      flex: 1,
    },
    studentName: {
      fontSize: 16,
      fontWeight: '500',
      color: '#333333',
    },
    studentEmail: {
      fontSize: 14,
      color: '#666666',
    },
    actionButtons: {
      flexDirection: 'row',
    },
    actionButton: {
      padding: 8,
      borderRadius: 4,
      marginLeft: 8,
    },
    approveButton: {
      backgroundColor: '#4CAF50',
    },
    rejectButton: {
      backgroundColor: '#F44336',
    },
    loader: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyStateText: {
      fontSize: 16,
      color: '#666666',
      marginTop: 16,
    },
  });
  
  export default DuyetSinhVien;
