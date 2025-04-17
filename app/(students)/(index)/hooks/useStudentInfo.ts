import { useState, useEffect, useCallback } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import { getDatabase, ref, query, orderByChild, equalTo, get } from '@react-native-firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes cache
const CACHE_KEY = 'student_info_cache';

export const useStudentInfo = () => {
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const getDataFromCache = async () => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        const now = new Date().getTime();
        if (now - timestamp < CACHE_EXPIRY) {
          setStudentInfo(data);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Lỗi khi đọc cache:', error);
      return false;
    }
  };

  const saveDataToCache = async (data: StudentInfo) => {
    try {
      const cacheData = {
        data,
        timestamp: new Date().getTime(),
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Lỗi khi lưu cache:', error);
    }
  };

  const fetchStudentInfo = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      const auth = getAuth();
      const user = auth.currentUser;
      if (!user?.email) {
        setError('Vui lòng đăng nhập lại');
        return;
      }

      setUserAvatar(user.photoURL);

      // Check cache first if not force refreshing
      if (!forceRefresh && await getDataFromCache()) {
        setLoading(false);
        return;
      }

      const studentId = user.email.split('@')[0];
      const database = getDatabase();
      database.setPersistenceEnabled(true); // Enable offline persistence
      
      const studentRef = ref(database, '/');
      const studentQuery = query(
        studentRef,
        orderByChild('Mã SV'),
        equalTo(studentId)
      );
      
      const snapshot = await get(studentQuery);
      const data = snapshot.val();
      
      if (data) {
        const studentData = Object.values(data)[0] as StudentInfo;
        setStudentInfo(studentData);
        saveDataToCache(studentData);
      } else {
        setError('Không tìm thấy thông tin sinh viên');
      }
    } catch (error) {
      console.error('Lỗi khi tải thông tin sinh viên:', error);
      setError('Không thể tải thông tin sinh viên. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudentInfo();
  }, [fetchStudentInfo]);

  const refreshStudentInfo = useCallback(() => {
    fetchStudentInfo(true);
  }, [fetchStudentInfo]);

  return {
    studentInfo,
    loading,
    error,
    userAvatar,
    refreshStudentInfo,
  };
}; 
export default useStudentInfo;