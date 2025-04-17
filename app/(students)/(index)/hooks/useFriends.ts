import { useState, useEffect } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from '@react-native-firebase/firestore';
import { useNetInfo } from '@react-native-community/netinfo';

export interface Friend {
  uid: string;
  displayName: string;
  photoURL?: string;
  studentId: string;
  faculty: string;
  class: string;
  email: string;
}

export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friend[]>([]);
  const [pendingFriends, setPendingFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const auth = getAuth();
  const db = getFirestore();
  const netInfo = useNetInfo();

  const fetchFriends = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const currentUser = auth.currentUser;
      if (!currentUser?.uid) {
        throw new Error('Vui lòng đăng nhập để xem danh sách bạn bè');
      }

      // Lấy thông tin người dùng hiện tại
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists) {
        // Nếu không tìm thấy document bằng ID, thử tìm bằng uid
        const userQuery = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
        const userQuerySnap = await getDocs(userQuery);
        
        if (userQuerySnap.empty) {
          throw new Error('Không tìm thấy thông tin người dùng');
        }
      }

      const userData = userDocSnap.exists ? userDocSnap.data() : (await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)))).docs[0].data();

      if (!userData) {
        throw new Error('Không tìm thấy dữ liệu người dùng');
      }

      // Lấy danh sách bạn bè
      const friendsList = userData.friends || [];
      const friendsData = await Promise.all(
        friendsList.map(async (friend: any) => {
          try {
            const friendDocRef = doc(db, 'users', friend.uid);
            const friendDocSnap = await getDoc(friendDocRef);

            if (friendDocSnap.exists) {
              const friendData = friendDocSnap.data();
              if (!friendData) return null;
              return {
                uid: friend.uid,
                displayName: friendData.displayName || 'Người dùng',
                photoURL: friendData.photoURL,
                studentId: friendData.email?.split('@')[0] || '',
                faculty: friendData.faculty || '',
                class: friendData.class || '',
                email: friendData.email || ''
              };
            }
            return null;
          } catch (err) {
            console.error('Error fetching friend data:', err);
            return null;
          }
        })
      );
      setFriends(friendsData.filter((friend): friend is Friend => friend !== null));

      // Lấy danh sách lời mời kết bạn
      const requestsList = userData.friendRequests || [];
      const requestsData = await Promise.all(
        requestsList.map(async (request: any) => {
          try {
            const requestDocRef = doc(db, 'users', request.uid);
            const requestDocSnap = await getDoc(requestDocRef);

            if (requestDocSnap.exists) {
              const requestData = requestDocSnap.data();
              if (!requestData) return null;
              return {
                uid: request.uid,
                displayName: requestData.displayName || 'Người dùng',
                photoURL: requestData.photoURL,
                studentId: requestData.email?.split('@')[0] || '',
                faculty: requestData.faculty || '',
                class: requestData.class || '',
                email: requestData.email || ''
              };
            }
            return null;
          } catch (err) {
            console.error('Error fetching request data:', err);
            return null;
          }
        })
      );
      setFriendRequests(requestsData.filter((request): request is Friend => request !== null));

      // Lấy danh sách lời mời đã gửi
      const pendingList = userData.pendingFriends || [];
      const pendingData = await Promise.all(
        pendingList.map(async (pending: any) => {
          try {
            const pendingDocRef = doc(db, 'users', pending.uid);
            const pendingDocSnap = await getDoc(pendingDocRef);

            if (pendingDocSnap.exists) {
              const pendingData = pendingDocSnap.data();
              if (!pendingData) return null;
              return {
                uid: pending.uid,
                displayName: pendingData.displayName || 'Người dùng',
                photoURL: pendingData.photoURL,
                studentId: pendingData.email?.split('@')[0] || '',
                faculty: pendingData.faculty || '',
                class: pendingData.class || '',
                email: pendingData.email || ''
              };
            }
            return null;
          } catch (err) {
            console.error('Error fetching pending data:', err);
            return null;
          }
        })
      );
      setPendingFriends(pendingData.filter((pending): pending is Friend => pending !== null));

      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching friends:', err);
      setError(err.message || 'Không thể tải danh sách bạn bè');
      setLoading(false);
    }
  };

  const sendFriendRequest = async (friendId: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser?.uid) {
        throw new Error('Vui lòng đăng nhập để gửi lời mời kết bạn');
      }

      // Get document references using ID directly
      const usersRef = collection(db, 'users');
      const currentUserDoc = doc(usersRef, currentUser.uid);
      const friendDoc = doc(usersRef, friendId);

      // Check if documents exist
      const [currentUserSnap, friendSnap] = await Promise.all([
        getDoc(currentUserDoc),
        getDoc(friendDoc)
      ]);

      if (!currentUserSnap.exists) {
        throw new Error('Không tìm thấy thông tin người dùng của bạn');
      }
      if (!friendSnap.exists) {
        throw new Error('Không tìm thấy thông tin người dùng được mời');
      }

      const currentUserData = currentUserSnap.data();
      const friendData = friendSnap.data();

      // Initialize arrays if they don't exist
      const updates = [];

      if (!Array.isArray(currentUserData?.pendingFriends)) {
        updates.push(
          updateDoc(currentUserDoc, {
            pendingFriends: []
          })
        );
      }

      if (!Array.isArray(friendData?.friendRequests)) {
        updates.push(
          updateDoc(friendDoc, {
            friendRequests: []
          })
        );
      }

      if (updates.length > 0) {
        await Promise.all(updates);
      }

      // Check if friend request already exists
      const pendingFriends = currentUserData?.pendingFriends || [];
      const friendRequests = friendData?.friendRequests || [];

      if (pendingFriends.some((f: any) => f.uid === friendId)) {
        throw new Error('Bạn đã gửi lời mời kết bạn cho người này rồi');
      }

      if (friendRequests.some((f: any) => f.uid === currentUser.uid)) {
        throw new Error('Đã tồn tại lời mời kết bạn từ người này');
      }

      // Send friend request
      await Promise.all([
        updateDoc(currentUserDoc, {
          pendingFriends: arrayUnion({ uid: friendId })
        }),
        updateDoc(friendDoc, {
          friendRequests: arrayUnion({ uid: currentUser.uid })
        })
      ]);

      // Refresh friends list
      await fetchFriends();
    } catch (err: any) {
      console.error('Error sending friend request:', err);
      throw new Error(err.message || 'Không thể gửi lời mời kết bạn');
    }
  };

  const acceptFriendRequest = async (friendId: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Vui lòng đăng nhập để chấp nhận lời mời kết bạn');

      // Get document references
      const usersRef = collection(db, 'users');
      const currentUserDoc = doc(usersRef, currentUser.uid);
      const friendDoc = doc(usersRef, friendId);

      // Remove from friendRequests and add to friends for current user
      await updateDoc(currentUserDoc, {
        friendRequests: arrayRemove({ uid: friendId }),
        friends: arrayUnion({ uid: friendId })
      });

      // Remove from pendingFriends and add to friends for friend
      await updateDoc(friendDoc, {
        pendingFriends: arrayRemove({ uid: currentUser.uid }),
        friends: arrayUnion({ uid: currentUser.uid })
      });

      // Refresh the lists
      await fetchFriends();
    } catch (err) {
      console.error('Error accepting friend request:', err);
      throw new Error('Không thể chấp nhận lời mời kết bạn');
    }
  };

  const rejectFriendRequest = async (friendId: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Vui lòng đăng nhập để từ chối lời mời kết bạn');

      // Get document references
      const usersRef = collection(db, 'users');
      const currentUserDoc = doc(usersRef, currentUser.uid);
      const friendDoc = doc(usersRef, friendId);

      // Remove from friendRequests for current user
      await updateDoc(currentUserDoc, {
        friendRequests: arrayRemove({ uid: friendId })
      });

      // Remove from pendingFriends for friend
      await updateDoc(friendDoc, {
        pendingFriends: arrayRemove({ uid: currentUser.uid })
      });

      // Refresh the lists
      await fetchFriends();
    } catch (err) {
      console.error('Error rejecting friend request:', err);
      throw new Error('Không thể từ chối lời mời kết bạn');
    }
  };

  useEffect(() => {
    if (netInfo.isConnected) {
      fetchFriends();
    }
  }, [netInfo.isConnected]);

  return {
    friends,
    friendRequests,
    pendingFriends,
    loading,
    error,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    refreshFriends: fetchFriends
  };
}

export default useFriends;