import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, ActivityIndicator, StatusBar, TouchableOpacity } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const QuanLySinhVien = ({ }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudentsStatistics();
  }, []);

  const fetchStudentsStatistics = async () => {
    setLoading(true);
    try {
      const studentsSnapshot = await firestore().collection('users').where('role', '==', 'student').get();
      const activitiesSnapshot = await firestore().collection('activities').get();
      const activities = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const studentsList = await Promise.all(studentsSnapshot.docs.map(async doc => {
        const studentData = doc.data();
        const participatedActivities = activities.filter(activity => 
          activity.participants && activity.participants.includes(doc.id)
        );
        const totalActivities = participatedActivities.length;

        return {
          id: doc.id,
          fullname: studentData.fullname,
          email: studentData.email,
          phoneNumber: studentData.phoneNumber,
          totalActivities,
          participatedActivities: participatedActivities.length
        };
      }));

      setStudents(studentsList);
    } catch (error) {
      console.error('Error fetching students statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStudentItem = ({ item }) => (
    <View style={styles.studentItem}>
      <Text style={styles.studentName}>{item.fullname}</Text>
      <Text style={styles.studentInfo}>Email: {item.email}</Text>
      <Text style={styles.studentInfo}>Số điện thoại: {item.phoneNumber || 'Chưa cập nhật'}</Text>
      <View style={styles.statisticsContainer}>
        <View style={styles.statisticBox}>
          <Text style={styles.statisticLabel}>Hoạt động đăng ký</Text>
          <Text style={styles.statisticValue}>{item.totalActivities}</Text>
        </View>
        <View style={styles.statisticBox}>
          <Text style={styles.statisticLabel}>Đã tham gia</Text>
          <Text style={styles.statisticValue}>{item.participatedActivities}</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()} 
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={screenWidth * 0.06} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Thống kê sinh viên</Text>
            <TouchableOpacity 
              onPress={fetchStudentsStatistics} 
              style={styles.refreshButton}
            >
              <Ionicons name="refresh-outline" size={screenWidth * 0.06} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={screenWidth * 0.06} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thống kê sinh viên</Text>
          <TouchableOpacity 
            onPress={fetchStudentsStatistics} 
            style={styles.refreshButton}
          >
            <Ionicons name="refresh-outline" size={screenWidth * 0.06} color="#007AFF" />
          </TouchableOpacity>
        </View>
        <FlatList
          data={students}
          renderItem={renderStudentItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F0F0F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenWidth * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: screenWidth * 0.02,
    marginRight: screenWidth * 0.02,
  },
  headerTitle: {
    fontSize: screenWidth * 0.055,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: screenWidth * 0.02,
    marginLeft: screenWidth * 0.02,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: screenWidth * 0.04,
  },
  studentItem: {
    backgroundColor: '#FFFFFF',
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.015,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 3,
  },
  studentName: {
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: screenHeight * 0.01,
  },
  studentInfo: {
    fontSize: screenWidth * 0.04,
    color: '#666666',
    marginBottom: screenHeight * 0.008,
  },
  statisticsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: screenHeight * 0.015,
  },
  statisticBox: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    padding: screenWidth * 0.03,
    borderRadius: 8,
    marginHorizontal: screenWidth * 0.01,
    alignItems: 'center',
  },
  statisticLabel: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
    marginBottom: screenHeight * 0.005,
    textAlign: 'center',
  },
  statisticValue: {
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    color: '#007AFF',
  },
});

export default QuanLySinhVien;
