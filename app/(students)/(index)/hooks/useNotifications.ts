import { useState, useEffect, useCallback } from 'react';
import { getFirestore, collection, query, where, orderBy, onSnapshot, doc, updateDoc } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { Timestamp } from '@react-native-firebase/firestore';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'activity' | 'system';
  createdAt: Date;
  read: boolean;
  isRead: boolean;
  userId: string;
  activityId?: string;
  activityStartDate?: Date;
  senderId?: string;
  senderName?: string;
  senderRole?: 'staff' | 'admin';
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const auth = getAuth();
  const db = getFirestore();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('Người dùng chưa đăng nhập');
        setLoading(false);
        return () => {};
      }

      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', 'in', [currentUser.uid, 'all']),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(notificationsQuery, 
        (snapshot) => {
          const notificationsList: Notification[] = [];
          
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            
            // Chỉ lấy thông báo từ staff hoặc về hoạt động mới
            if (data.senderRole === 'staff' || data.type === 'activity') {
              const notification: Notification = {
                id: doc.id,
                title: data.title || "Không có tiêu đề",
                message: data.message || "Không có nội dung",
                type: data.type || 'system',
                createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
                read: data.read || false,
                isRead: data.read || false,
                userId: data.userId || currentUser.uid,
                activityId: data.activityId,
                activityStartDate: data.activityStartDate ? data.activityStartDate.toDate() : undefined,
                senderId: data.senderId,
                senderName: data.senderName,
                senderRole: data.senderRole
              };

              // Nếu là thông báo hoạt động, kiểm tra thời gian diễn ra
              if (notification.type === 'activity' && notification.activityStartDate) {
                const now = new Date();
                if (notification.activityStartDate <= now) {
                  notificationsList.push(notification);
                }
              } else {
                notificationsList.push(notification);
              }
            }
          });
          
          // Đếm số thông báo chưa đọc
          const unread = notificationsList.filter(notification => !notification.isRead).length;
          setUnreadCount(unread);
          setNotifications(notificationsList);
          setLoading(false);
        },
        (err) => {
          console.error('Error fetching notifications:', err);
          setError('Không thể tải thông báo');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error("Error in fetchNotifications:", error);
      setError("Không thể tải thông báo. Vui lòng thử lại sau.");
      setLoading(false);
      return () => {};
    }
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true
      });
    } catch (err) {
      console.error('Error marking notification as read:', err);
      throw new Error('Không thể đánh dấu thông báo đã đọc');
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    fetchNotifications().then(cleanup => {
      unsubscribe = cleanup;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [fetchNotifications]);

  return {
    notifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    refetch: fetchNotifications
  };
}; 

export default useNotifications;