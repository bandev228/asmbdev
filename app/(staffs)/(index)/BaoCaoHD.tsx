import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, TextInput, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import firestore from '@react-native-firebase/firestore';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const BaoCaoHoatDong = ({ }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterType, setFilterType] = useState('all'); // all, created, completed

  useEffect(() => {
    fetchActivities();
  }, [selectedDate, filterType]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      let query = firestore().collection('activities');

      // Lọc theo ngày
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Tách query thành 2 phần để tránh lỗi index
      if (filterType === 'completed') {
        // Lấy tất cả hoạt động trong ngày trước
        const snapshot = await query
          .where('createdAt', '>=', startOfDay)
          .where('createdAt', '<=', endOfDay)
          .get();

        // Lọc status ở client side
        const activitiesList = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(activity => activity.status === 'completed');

        setActivities(activitiesList);
      } else {
        // Trường hợp 'all' hoặc 'created', chỉ lọc theo ngày
        const snapshot = await query
          .where('createdAt', '>=', startOfDay)
          .where('createdAt', '<=', endOfDay)
          .get();

        const activitiesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setActivities(activitiesList);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      // Chuẩn bị dữ liệu cho file Excel
      const data = activities.map(activity => ({
        'Tên hoạt động': activity.name,
        'Ngày tạo': activity.createdAt.toDate().toLocaleDateString(),
        'Trạng thái': activity.status,
        'Số người tham gia': activity.participants?.length || 0,
        'Địa điểm': activity.location,
        'Thời gian bắt đầu': activity.startDate?.toDate().toLocaleDateString(),
        'Thời gian kết thúc': activity.endDate?.toDate().toLocaleDateString(),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Activities');

      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileName = `activities_report_${selectedDate.toISOString().split('T')[0]}.xlsx`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, wbout, {
        encoding: FileSystem.EncodingType.Base64
      });

      await Sharing.shareAsync(filePath, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Xuất báo cáo hoạt động',
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    }
  };

  const exportParticipantsList = async (activity) => {
    try {
      // Lấy danh sách user IDs từ activity.participants
      const participantIds = activity.participants || [];
      
      // Fetch thông tin chi tiết của từng sinh viên
      const participantsData = await Promise.all(
        participantIds.map(async (userId) => {
          const userDoc = await firestore()
            .collection('users')
            .doc(userId)
            .get();
          
          const userData = userDoc.data();
          return {
            'MSSV': userData.studentId || 'N/A',
            'Họ và tên': userData.fullname || 'N/A',
            'Email': userData.email || 'N/A',
            'Lớp': userData.className || 'N/A',
            'Số điện thoại': userData.phoneNumber || 'N/A',
            'Thời gian điểm danh': activity.attendanceTime?.[userId]?.toDate().toLocaleString() || 'Chưa điểm danh'
          };
        })
      );

      // Tạo và xuất file Excel
      const ws = XLSX.utils.json_to_sheet(participantsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Participants');

      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileName = `participants_${activity.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, wbout, {
        encoding: FileSystem.EncodingType.Base64
      });

      await Sharing.shareAsync(filePath, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Danh sách sinh viên - ${activity.name}`,
      });
    } catch (error) {
      console.error('Error exporting participants list:', error);
      Alert.alert('Lỗi', 'Không thể xuất danh sách sinh viên. Vui lòng thử lại sau.');
    }
  };

  const renderActivityItem = ({ item }) => (
    <View style={styles.activityItem}>
      <Text style={styles.activityName}>{item.name}</Text>
      <Text style={styles.activityInfo}>
        Ngày tạo: {item.createdAt.toDate().toLocaleDateString()}
      </Text>
      <Text style={styles.activityInfo}>
        Trạng thái: {item.status}
      </Text>
      <Text style={styles.activityInfo}>
        Số người tham gia: {item.participants?.length || 0}
      </Text>
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.exportParticipantsButton}
          onPress={() => exportParticipantsList(item)}
        >
          <Ionicons name="people-outline" size={screenWidth * 0.045} color="#007AFF" />
          <Text style={styles.exportParticipantsText}>Xuất DS sinh viên</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={screenWidth * 0.06} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Báo cáo hoạt động</Text>
          <TouchableOpacity 
            onPress={exportToExcel} 
            style={styles.exportButton}
          >
            <Ionicons name="download-outline" size={screenWidth * 0.06} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.filterContainer}>
          <TouchableOpacity 
            style={styles.datePickerButton} 
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={screenWidth * 0.05} color="#666666" />
            <Text style={styles.dateText}>
              {selectedDate.toLocaleDateString()}
            </Text>
          </TouchableOpacity>

          <View style={styles.filterButtons}>
            <TouchableOpacity 
              style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
              onPress={() => setFilterType('all')}
            >
              <Text style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>
                Tất cả
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterButton, filterType === 'created' && styles.filterButtonActive]}
              onPress={() => setFilterType('created')}
            >
              <Text style={[styles.filterButtonText, filterType === 'created' && styles.filterButtonTextActive]}>
                Đã tạo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterButton, filterType === 'completed' && styles.filterButtonActive]}
              onPress={() => setFilterType('completed')}
            >
              <Text style={[styles.filterButtonText, filterType === 'completed' && styles.filterButtonTextActive]}>
                Đã hoàn thành
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm hoạt động..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <FlatList
          data={activities.filter(activity => 
            activity.name.toLowerCase().includes(searchQuery.toLowerCase())
          )}
          renderItem={renderActivityItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (date) setSelectedDate(date);
            }}
          />
        )}
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
  headerTitle: {
    fontSize: screenWidth * 0.055,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: screenWidth * 0.02,
    marginRight: screenWidth * 0.02,
  },
  exportButton: {
    padding: screenWidth * 0.02,
    marginLeft: screenWidth * 0.02,
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    padding: screenWidth * 0.04,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    padding: screenWidth * 0.03,
    borderRadius: 8,
    marginBottom: screenWidth * 0.03,
  },
  dateText: {
    marginLeft: screenWidth * 0.02,
    fontSize: screenWidth * 0.04,
    color: '#333333',
  },
  filterButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: screenWidth * 0.03,
  },
  filterButton: {
    flex: 1,
    padding: screenWidth * 0.02,
    marginHorizontal: screenWidth * 0.01,
    borderRadius: 8,
    backgroundColor: '#F0F0F5',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  searchInput: {
    backgroundColor: '#F0F0F5',
    padding: screenWidth * 0.03,
    borderRadius: 8,
    fontSize: screenWidth * 0.04,
  },
  listContent: {
    padding: screenWidth * 0.04,
  },
  activityItem: {
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
  activityName: {
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: screenHeight * 0.01,
  },
  activityInfo: {
    fontSize: screenWidth * 0.04,
    color: '#666666',
    marginBottom: screenHeight * 0.005,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: screenHeight * 0.01,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: screenHeight * 0.01,
  },
  exportParticipantsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    padding: screenWidth * 0.02,
    borderRadius: 8,
  },
  exportParticipantsText: {
    marginLeft: screenWidth * 0.02,
    fontSize: screenWidth * 0.035,
    color: '#007AFF',
    fontWeight: '500',
  },
});

export default BaoCaoHoatDong;