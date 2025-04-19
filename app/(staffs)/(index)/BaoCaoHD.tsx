import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, TextInput, Platform, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getFirestore, collection, query, where, getDocs, Timestamp } from '@react-native-firebase/firestore';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Dimensions } from 'react-native';
import { useRouter } from 'expo-router';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

interface Activity {
  id: string;
  name: string;
  createdAt: Timestamp;
  status: 'pending' | 'approved' | 'completed' | 'cancelled';
  participants?: string[];
  location?: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  attendanceTime?: {
    [key: string]: Timestamp;
  };
}

interface User {
  studentId?: string;
  fullname?: string;
  email?: string;
  className?: string;
  phoneNumber?: string;
}

const BaoCaoHoatDong = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterType, setFilterType] = useState<'all' | 'created' | 'completed'>('all');
  const router = useRouter();
  const db = getFirestore();

  useEffect(() => {
    fetchActivities();
  }, [selectedDate, filterType]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, 'activities'));

      // Lọc theo ngày
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Tách query thành 2 phần để tránh lỗi index
      if (filterType === 'completed') {
        // Lấy tất cả hoạt động trong ngày trước
        const snapshot = await getDocs(
          query(q, 
            where('createdAt', '>=', startOfDay),
            where('createdAt', '<=', endOfDay)
          )
        );

        // Lọc status ở client side
        const activitiesList = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Activity))
          .filter(activity => activity.status === 'completed');

        setActivities(activitiesList);
      } else {
        // Trường hợp 'all' hoặc 'created', chỉ lọc theo ngày
        const snapshot = await getDocs(
          query(q,
            where('createdAt', '>=', startOfDay),
            where('createdAt', '<=', endOfDay)
          )
        );

        const activitiesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Activity));

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
        'Địa điểm': activity.location || 'Chưa cập nhật',
        'Thời gian bắt đầu': activity.startDate?.toDate().toLocaleDateString() || 'Chưa cập nhật',
        'Thời gian kết thúc': activity.endDate?.toDate().toLocaleDateString() || 'Chưa cập nhật',
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

  const exportParticipantsList = async (activity: Activity) => {
    try {
      // Lấy danh sách user IDs từ activity.participants
      const participantIds = activity.participants || [];
      
      // Fetch thông tin chi tiết của từng sinh viên
      const participantsData = await Promise.all(
        participantIds.map(async (userId) => {
          const userDoc = await getDocs(
            query(collection(db, 'users'), where('uid', '==', userId))
          );
          
          const userData = userDoc.docs[0]?.data() as User;
          return {
            'MSSV': userData?.studentId || 'N/A',
            'Họ và tên': userData?.fullname || 'N/A',
            'Email': userData?.email || 'N/A',
            'Lớp': userData?.className || 'N/A',
            'Số điện thoại': userData?.phoneNumber || 'N/A',
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

  const renderActivityItem = ({ item }: { item: Activity }) => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'completed':
          return '#4CAF50';
        case 'pending':
          return '#FF9800';
        case 'cancelled':
          return '#F44336';
        default:
          return '#666666';
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case 'completed':
          return 'Hoàn thành';
        case 'pending':
          return 'Đang chờ';
        case 'cancelled':
          return 'Đã hủy';
        default:
          return 'Không xác định';
      }
    };

    return (
      <View style={styles.activityItem}>
        <View style={styles.activityHeader}>
          <View style={styles.activityTitleContainer}>
            <Text style={styles.activityName}>{item.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.activityDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color="#666666" />
            <Text style={styles.detailText}>
              Ngày tạo: {item.createdAt.toDate().toLocaleDateString('vi-VN')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color="#666666" />
            <Text style={styles.detailText}>
              Địa điểm: {item.location || 'Chưa cập nhật'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={16} color="#666666" />
            <Text style={styles.detailText}>
              Số người tham gia: {item.participants?.length || 0} người
            </Text>
          </View>
          {item.startDate && item.endDate && (
            <View style={styles.timelineContainer}>
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color="#666666" />
                <Text style={styles.detailText}>
                  Bắt đầu: {item.startDate.toDate().toLocaleString('vi-VN')}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color="#666666" />
                <Text style={styles.detailText}>
                  Kết thúc: {item.endDate.toDate().toLocaleString('vi-VN')}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.exportParticipantsButton}
            onPress={() => exportParticipantsList(item)}
          >
            <Ionicons name="people-outline" size={20} color="#FFFFFF" />
            <Text style={styles.exportParticipantsText}>Xuất danh sách sinh viên</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Báo cáo hoạt động</Text>
          <TouchableOpacity onPress={exportToExcel} style={styles.exportButton}>
            <Ionicons name="download-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.filterContainer}>
          <View style={styles.datePickerRow}>
            <TouchableOpacity 
              style={styles.datePickerButton} 
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#666666" />
              <Text style={styles.dateText}>{selectedDate.toLocaleDateString('vi-VN')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={fetchActivities}
            >
              <Ionicons name="refresh-outline" size={20} color="#666666" />
            </TouchableOpacity>
          </View>

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
                Hoàn thành
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color="#666666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm hoạt động..."
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
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : (
          <FlatList
            data={activities.filter(activity => 
              activity.name.toLowerCase().includes(searchQuery.toLowerCase())
            )}
            renderItem={renderActivityItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={48} color="#CCCCCC" />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'Không tìm thấy hoạt động' : 'Chưa có hoạt động nào'}
                </Text>
              </View>
            }
          />
        )}

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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
  },
  exportButton: {
    padding: 8,
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  datePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  refreshButton: {
    padding: 12,
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
  },
  dateText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333333',
  },
  filterButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    padding: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F0F0F5',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666666',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#333333',
  },
  listContent: {
    padding: 16,
  },
  activityItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activityHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  activityTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  activityDetails: {
    padding: 16,
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
  timelineContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F5',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F5',
  },
  exportParticipantsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportParticipantsText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
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

export default BaoCaoHoatDong;