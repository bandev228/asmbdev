import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  SafeAreaView, 
  ActivityIndicator, 
  StatusBar, 
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { getFirestore, collection, query as firestoreQuery, where, getDocs } from '@react-native-firebase/firestore';
import { getDatabase, ref, query, orderByChild, equalTo, get } from '@react-native-firebase/database';
import { Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

interface StudentInfo {
  'Mã SV': string;
  'Họ lót': string;
  'Họ và tên': string;
  'Mã bậc': string;
  'Mã khoa': string;
  'Mã khối': string;
  'Mã lớp': string;
  'Mã ngành': string;
  'Ngày sinh': string;
  'Nơi sinh': string;
  'Phái': string;
  'STT': string;
  'Tên': string;
  'Tên bậc hệ': string;
  'Tên khoa': string;
  'Tên ngành': string;
  'Điện thoại': string;
  'Hiện diện': string;
}

interface Activity {
  id: string;
  participants?: string[];
}

interface Student {
  id: string;
  info: StudentInfo;
  totalActivities: number;
  participatedActivities: number;
}

interface RealTimeDBInfo {
  'Mã SV': string;
  'Họ và tên': string;
  'Điện thoại': string;
  'Tên khoa': string;
  'Mã lớp': string;
  'Tên ngành': string;
  'Họ lót': string;
  'Mã bậc': string;
  'Mã khoa': string;
  'Mã khối': string;
  'Mã ngành': string;
  'Ngày sinh': string;
  'Nơi sinh': string;
  'Phái': string;
  'STT': string;
  'Tên': string;
  'Tên bậc hệ': string;
  'Hiện diện': string;
}

const QuanLySinhVien = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const db = getFirestore();

  useEffect(() => {
    fetchStudentsStatistics();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredStudents(students);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = students.filter(student => 
        student.info['Họ và tên'].toLowerCase().includes(query) ||
        student.info['Mã SV'].toLowerCase().includes(query) ||
        student.info['Mã lớp'].toLowerCase().includes(query) ||
        student.info['Tên khoa'].toLowerCase().includes(query)
      );
      setFilteredStudents(filtered);
    }
  }, [searchQuery, students]);

  const fetchStudentsStatistics = async () => {
    setLoading(true);
    try {
      // Get students from Firestore
      const studentsSnapshot = await getDocs(
        firestoreQuery(collection(db, 'users'), where('role', '==', 'student'))
      );

      // Get activities
      const activitiesSnapshot = await getDocs(collection(db, 'activities'));
      const activities = activitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Activity));

      // Setup Realtime Database reference
      const database = getDatabase();
      const studentRef = ref(database, '/');

      const studentsList = await Promise.all(studentsSnapshot.docs.map(async doc => {
        const studentData = doc.data();
        const studentId = doc.id;
        const email = studentData.email;
        const mssv = email?.split('@')[0];

        // Get student info from Realtime Database
        let realtimeDbInfo: RealTimeDBInfo | null = null;
        if (mssv) {
          try {
            const studentQuery = query(studentRef, orderByChild('Mã SV'), equalTo(mssv));
            const snapshot = await get(studentQuery);
            if (snapshot.exists()) {
              const data = snapshot.val();
              realtimeDbInfo = Object.values(data)[0] as RealTimeDBInfo;
            }
          } catch (error) {
            console.error('Error fetching from RDB:', error);
          }
        }

        // Count participated activities
        const participatedActivities = activities.filter(activity => 
          activity.participants && activity.participants.includes(studentId)
        );

        // Combine Firestore and Realtime Database info
        return {
          id: studentId,
          info: {
            'Mã SV': mssv || 'Chưa cập nhật',
            'Họ và tên': studentData.displayName || 'Chưa cập nhật',
            'Điện thoại': realtimeDbInfo ? realtimeDbInfo['Điện thoại'] : (studentData.phoneNumber || 'Chưa cập nhật'),
            'Tên khoa': realtimeDbInfo ? realtimeDbInfo['Tên khoa'] : 'Chưa cập nhật',
            'Mã lớp': realtimeDbInfo ? realtimeDbInfo['Mã lớp'] : 'Chưa cập nhật',
            'Tên ngành': realtimeDbInfo ? realtimeDbInfo['Tên ngành'] : 'Chưa cập nhật',
            'Họ lót': realtimeDbInfo ? realtimeDbInfo['Họ lót'] : '',
            'Mã bậc': realtimeDbInfo ? realtimeDbInfo['Mã bậc'] : '',
            'Mã khoa': realtimeDbInfo ? realtimeDbInfo['Mã khoa'] : '',
            'Mã khối': realtimeDbInfo ? realtimeDbInfo['Mã khối'] : '',
            'Mã ngành': realtimeDbInfo ? realtimeDbInfo['Mã ngành'] : '',
            'Ngày sinh': realtimeDbInfo ? realtimeDbInfo['Ngày sinh'] : '',
            'Nơi sinh': realtimeDbInfo ? realtimeDbInfo['Nơi sinh'] : '',
            'Phái': realtimeDbInfo ? realtimeDbInfo['Phái'] : '',
            'STT': realtimeDbInfo ? realtimeDbInfo['STT'] : '',
            'Tên': realtimeDbInfo ? realtimeDbInfo['Tên'] : '',
            'Tên bậc hệ': realtimeDbInfo ? realtimeDbInfo['Tên bậc hệ'] : '',
            'Hiện diện': realtimeDbInfo ? realtimeDbInfo['Hiện diện'] : '',
          },
          totalActivities: activities.length,
          participatedActivities: participatedActivities.length
        } as Student;
      }));

      setStudents(studentsList);
      setFilteredStudents(studentsList);
    } catch (error) {
      console.error('Error fetching students statistics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStudentsStatistics();
  };

  const getParticipationRate = (total: number, participated: number) => {
    if (total === 0) return 0;
    return (participated / total) * 100;
  };

  const renderStudentItem = ({ item }: { item: Student }) => {
    const participationRate = getParticipationRate(item.totalActivities, item.participatedActivities);
    
    return (
      <View style={styles.studentItem}>
        <View style={styles.studentHeader}>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>{item.info['Họ và tên']}</Text>
            <Text style={styles.studentId}>MSSV: {item.info['Mã SV']}</Text>
            <Text style={styles.studentClass}>Lớp: {item.info['Mã lớp']}</Text>
          </View>
          <View style={[styles.participationBadge, {
            backgroundColor: participationRate >= 70 ? '#34C759' : 
                           participationRate >= 40 ? '#FF9500' : '#FF3B30'
          }]}>
            <Text style={styles.participationText}>{Math.round(participationRate)}%</Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Ionicons name="school-outline" size={16} color="#666666" />
            <Text style={styles.detailText}>Viện: {item.info['Tên khoa']}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="book-outline" size={16} color="#666666" />
            <Text style={styles.detailText}>Ngành: {item.info['Tên ngành']}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={16} color="#666666" />
            <Text style={styles.detailText}>SĐT: {item.info['Điện thoại']}</Text>
          </View>
        </View>

        <View style={styles.statisticsContainer}>
          <View style={styles.statisticBox}>
            <Text style={styles.statisticValue}>{item.totalActivities}</Text>
            <Text style={styles.statisticLabel}>Tổng hoạt động</Text>
          </View>
          <View style={styles.statisticBox}>
            <Text style={styles.statisticValue}>{item.participatedActivities}</Text>
            <Text style={styles.statisticLabel}>Đã tham gia</Text>
          </View>
          <View style={styles.statisticBox}>
            <Text style={styles.statisticValue}>{item.totalActivities - item.participatedActivities}</Text>
            <Text style={styles.statisticLabel}>Chưa tham gia</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#666666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm sinh viên..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666666" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.statsOverview}>
        <View style={styles.overviewItem}>
          <Text style={styles.overviewValue}>{students.length}</Text>
          <Text style={styles.overviewLabel}>Tổng số SV</Text>
        </View>
        <View style={styles.overviewDivider} />
        <View style={styles.overviewItem}>
          <Text style={styles.overviewValue}>
            {students.filter(s => getParticipationRate(s.totalActivities, s.participatedActivities) >= 70).length}
          </Text>
          <Text style={styles.overviewLabel}>Hoạt động tốt</Text>
        </View>
        <View style={styles.overviewDivider} />
        <View style={styles.overviewItem}>
          <Text style={styles.overviewValue}>
            {students.filter(s => getParticipationRate(s.totalActivities, s.participatedActivities) < 40).length}
          </Text>
          <Text style={styles.overviewLabel}>Cần cải thiện</Text>
        </View>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quản lý sinh viên</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý sinh viên</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={filteredStudents}
        renderItem={renderStudentItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#CCCCCC" />
            <Text style={styles.emptyText}>
              {searchQuery ? 'Không tìm thấy sinh viên' : 'Chưa có sinh viên nào'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 8,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#333333',
  },
  statsOverview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
  },
  overviewItem: {
    flex: 1,
    alignItems: 'center',
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  overviewDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  studentItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  studentId: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  studentClass: {
    fontSize: 14,
    color: '#666666',
  },
  participationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  participationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailsContainer: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
  },
  statisticsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
  },
  statisticBox: {
    flex: 1,
    alignItems: 'center',
  },
  statisticValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statisticLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
  },
});

export default QuanLySinhVien;
