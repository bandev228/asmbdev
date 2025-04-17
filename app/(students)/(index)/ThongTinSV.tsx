import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  StatusBar,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Dimensions } from 'react-native';
import { router } from 'expo-router';
import useStudentInfo from './hooks/useStudentInfo';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const ThongTinSV = () => {
  const { studentInfo, loading, error, userAvatar, refreshStudentInfo } = useStudentInfo();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    refreshStudentInfo();
    setRefreshing(false);
  }, [refreshStudentInfo]);

  const fullName = useMemo(() => {
    if (!studentInfo) return '';
    return `${studentInfo['Họ lót'] || ''} ${studentInfo['Tên'] || ''}`.trim();
  }, [studentInfo]);

  const getGenderText = (gender: string | undefined) => {
    if (!gender) return 'Chưa cập nhật';
    return gender === '0' ? 'Nam' : gender === '1' ? 'Nữ' : 'Chưa cập nhật';
  };

  const renderHeader = () => (
    <View style={styles.profileHeader}>
      <View style={styles.avatarContainer}>
        {userAvatar ? (
          <Image
            source={{ uri: userAvatar }}
            style={[styles.avatar, { backgroundColor: 'transparent' }]}
          />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {fullName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.fullName}>{fullName}</Text>
      <Text style={styles.studentId}>{studentInfo?.['Mã SV']}</Text>
      <View style={styles.statusContainer}>
        <View style={[styles.statusBadge, { backgroundColor: studentInfo?.['Hiện diện'] === 'Đã nghỉ học' ? '#FF3B30' : '#34C759' }]}>
          <Text style={styles.statusText}>{studentInfo?.['Hiện diện'] || 'Đang học'}</Text>
        </View>
      </View>
    </View>
  );

  const renderInfoSection = (title: string, items: { label: string; value: string | undefined; icon: keyof typeof Ionicons.glyphMap }[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, index) => (
        <View key={index} style={styles.infoContainer}>
          <View style={styles.labelContainer}>
            <Ionicons name={item.icon} size={screenWidth * 0.055} color="#666666" style={styles.icon} />
            <Text style={styles.label}>{item.label}</Text>
          </View>
          <Text style={styles.value}>{item.value || 'Chưa cập nhật'}</Text>
        </View>
      ))}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={screenWidth * 0.06} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Thông tin sinh viên</Text>
            <TouchableOpacity onPress={refreshStudentInfo} style={styles.refreshButton}>
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

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={screenWidth * 0.06} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Thông tin sinh viên</Text>
            <TouchableOpacity onPress={refreshStudentInfo} style={styles.refreshButton}>
              <Ionicons name="refresh-outline" size={screenWidth * 0.06} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={screenWidth * 0.2} color="#FF3B30" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refreshStudentInfo}>
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </TouchableOpacity>
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={screenWidth * 0.06} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thông tin sinh viên</Text>
          <TouchableOpacity onPress={refreshStudentInfo} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={screenWidth * 0.06} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollViewContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
            />
          }
        >
          {renderHeader()}

          {renderInfoSection('Thông tin học tập', [
            { label: 'Lớp', value: studentInfo?.['Mã lớp'], icon: 'people-outline' },
            { label: 'Khoa', value: studentInfo?.['Tên khoa'], icon: 'school-outline' },
            { label: 'Ngành', value: studentInfo?.['Tên ngành'], icon: 'book-outline' },
            { label: 'Bậc đào tạo', value: studentInfo?.['Tên bậc hệ'], icon: 'library-outline' },
          ])}

          {renderInfoSection('Thông tin cá nhân', [
            { label: 'Ngày sinh', value: studentInfo?.['Ngày sinh'], icon: 'calendar-outline' },
            { label: 'Giới tính', value: getGenderText(studentInfo?.['Phái']), icon: 'male-female-outline' },
            { label: 'Nơi sinh', value: studentInfo?.['Nơi sinh'], icon: 'location-outline' },
            { label: 'Điện thoại', value: studentInfo?.['Điện thoại'], icon: 'call-outline' },
          ])}
        </ScrollView>
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
    backgroundColor: '#F0F0F5',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F0F0F5',
  },
  scrollViewContent: {
    paddingBottom: screenWidth * 0.06,
  },
  profileHeader: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    padding: screenWidth * 0.06,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  avatarContainer: {
    marginBottom: screenWidth * 0.04,
  },
  avatar: {
    width: screenWidth * 0.25,
    height: screenWidth * 0.25,
    borderRadius: screenWidth * 0.125,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatarText: {
    fontSize: screenWidth * 0.12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  fullName: {
    fontSize: screenWidth * 0.06,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: screenWidth * 0.02,
  },
  studentId: {
    fontSize: screenWidth * 0.045,
    color: '#666666',
    marginBottom: screenWidth * 0.03,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: screenWidth * 0.02,
  },
  statusBadge: {
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenWidth * 0.015,
    borderRadius: screenWidth * 0.04,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: screenWidth * 0.035,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: screenWidth * 0.04,
    paddingVertical: screenWidth * 0.04,
    borderRadius: screenWidth * 0.04,
    marginHorizontal: screenWidth * 0.04,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: screenWidth * 0.04,
    paddingHorizontal: screenWidth * 0.04,
  },
  infoContainer: {
    paddingHorizontal: screenWidth * 0.04,
    marginBottom: screenWidth * 0.04,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: screenWidth * 0.01,
  },
  icon: {
    marginRight: screenWidth * 0.03,
    width: screenWidth * 0.055,
    textAlign: 'center',
  },
  label: {
    fontSize: screenWidth * 0.04,
    color: '#666666',
  },
  value: {
    fontSize: screenWidth * 0.042,
    color: '#333333',
    fontWeight: '500',
    marginLeft: screenWidth * 0.085,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: screenWidth * 0.04,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: screenWidth * 0.045,
    marginBottom: screenWidth * 0.02,
  },
  retryButton: {
    padding: screenWidth * 0.04,
    borderRadius: screenWidth * 0.02,
    backgroundColor: '#007AFF',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: screenWidth * 0.04,
    fontWeight: 'bold',
  },
});

export default ThongTinSV;