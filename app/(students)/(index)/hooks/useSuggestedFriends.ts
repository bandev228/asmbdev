import { useState, useEffect } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, collection, query, getDocs, where, doc, getDoc } from '@react-native-firebase/firestore';
import { useStudentInfo } from './useStudentInfo';

export interface SuggestedFriend {
  uid: string;
  displayName: string;
  photoURL?: string;
  studentId: string;
  faculty: string;
  class: string;
  email: string;
}

export function useSuggestedFriends() {
  const [suggestedFriends, setSuggestedFriends] = useState<SuggestedFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const auth = getAuth();
  const db = getFirestore();
  const { studentInfo } = useStudentInfo();

  const fetchSuggestedFriends = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Lấy thông tin user đăng nhập
      const currentUser = auth.currentUser;
      if (!currentUser?.uid || !currentUser?.email) {
        throw new Error('Vui lòng đăng nhập để xem gợi ý kết bạn');
      }

      // 2. Kiểm tra thông tin sinh viên từ useStudentInfo
      if (!studentInfo) {
        throw new Error('Đang tải thông tin sinh viên...');
      }

      // 3. Lấy danh sách kết nối hiện tại
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists) {
        throw new Error('Không tìm thấy thông tin người dùng');
      }

      const userData = userDocSnap.data();
      if (!userData) {
        throw new Error('Không tìm thấy dữ liệu người dùng');
      }

      const friends = (userData.friends || []).map((f: any) => f.uid);
      const pendingFriends = (userData.pendingFriends || []).map((f: any) => f.uid);
      const friendRequests = (userData.friendRequests || []).map((f: any) => f.uid);
      const allConnections = [currentUser.uid, ...friends, ...pendingFriends, ...friendRequests];

      // 4. Lấy danh sách tất cả người dùng có email student
      const usersRef = collection(db, 'users');
      const studentEmailQuery = query(
        usersRef,
        where('email', '>=', ''),
        where('email', '<=', 'z')
      );
      const allUsers = await getDocs(studentEmailQuery);

      const suggestions: SuggestedFriend[] = [];

      // 5. Lọc và thêm người dùng vào danh sách gợi ý
      allUsers.forEach(doc => {
        const data = doc.data();
        const email = data.email as string;
        
        // Kiểm tra email có đúng định dạng student không
        if (email && email.endsWith('@student.tdmu.edu.vn') && !allConnections.includes(doc.id)) {
          const studentId = email.split('@')[0];
          
          suggestions.push({
            uid: doc.id,
            displayName: data.displayName || 'Người dùng',
            photoURL: data.photoURL,
            studentId: studentId,
            faculty: data.faculty || '',
            class: data.class || '',
            email: email
          });
        }
      });

      // 6. Sắp xếp gợi ý theo thứ tự ưu tiên:
      // - Cùng lớp
      // - Cùng khoa
      // - Các sinh viên khác
      const currentUserClass = studentInfo['Mã lớp'];
      const currentUserFaculty = studentInfo['Tên khoa'];

      const sortedSuggestions = suggestions.sort((a, b) => {
        // Ưu tiên cùng lớp
        if (a.class === currentUserClass && b.class !== currentUserClass) return -1;
        if (a.class !== currentUserClass && b.class === currentUserClass) return 1;
        
        // Tiếp theo ưu tiên cùng khoa
        if (a.faculty === currentUserFaculty && b.faculty !== currentUserFaculty) return -1;
        if (a.faculty !== currentUserFaculty && b.faculty === currentUserFaculty) return 1;
        
        return 0;
      });

      setSuggestedFriends(sortedSuggestions);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching suggested friends:', err);
      setError(err.message || 'Không thể tải danh sách gợi ý kết bạn');
      setLoading(false);
      setSuggestedFriends([]);
    }
  };

  useEffect(() => {
    if (studentInfo) {
      fetchSuggestedFriends();
    }
  }, [studentInfo]);

  return {
    suggestedFriends,
    loading,
    error,
    refreshSuggestedFriends: fetchSuggestedFriends
  };
}

export default useSuggestedFriends;