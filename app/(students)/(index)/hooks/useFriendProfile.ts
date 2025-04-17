import { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';

interface FriendProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  studentId?: string;
  faculty?: string;
  class?: string;
}

export function useFriendProfile(friendId: string) {
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = getFirestore();

  useEffect(() => {
    const fetchFriendProfile = async () => {
      try {
        if (!friendId) {
          setError('Không tìm thấy thông tin người dùng');
          return;
        }

        // Try to get user document by ID first
        const userDoc = await getDoc(doc(db, 'users', friendId));
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData) {
            setProfile({
              uid: friendId,
              displayName: userData.displayName || 'Người dùng',
              photoURL: userData.photoURL,
              studentId: userData.studentId,
              faculty: userData.faculty,
              class: userData.class,
            });
          }
        } else {
          // If document not found by ID, try to find by uid field
          const userQuery = await getDoc(doc(db, 'users', friendId));
          if (userQuery.exists) {
            const userData = userQuery.data();
            if (userData) {
              setProfile({
                uid: friendId,
                displayName: userData.displayName || 'Người dùng',
                photoURL: userData.photoURL,
                studentId: userData.studentId,
                faculty: userData.faculty,
                class: userData.class,
              });
            }
          } else {
            setError('Không tìm thấy thông tin người dùng');
          }
        }
      } catch (err) {
        console.error('Error fetching friend profile:', err);
        setError('Không thể tải thông tin người dùng');
      } finally {
        setLoading(false);
      }
    };

    fetchFriendProfile();
  }, [friendId]);

  return { profile, loading, error };
}
export default useFriendProfile;