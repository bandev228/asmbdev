import { useState, useEffect, useCallback } from 'react';
import { getFirestore, collection, query, where, orderBy, getDocs, Timestamp, doc, getDoc } from '@react-native-firebase/firestore';

interface UserData {
  displayName?: string;
  email?: string;
}

export interface Activity {
  id: string;
  name: string;
  description?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  location: string;
  bannerImageUrl?: string;
  isHidden?: boolean;
  participants?: string[];
  pendingParticipants?: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdBy: string;
  creatorDisplayName?: string;
  createdAt: Timestamp;
}

export const useActivities = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getFirestore();
      const now = Timestamp.fromDate(new Date());

      const activitiesQuery = query(
        collection(db, 'activities'),
        where('status', '==', 'approved'),
        where('endDate', '>=', now),
        orderBy('endDate', 'asc')
      );

      const snapshot = await getDocs(activitiesQuery);
      const activitiesList = await Promise.all(
        snapshot.docs
          .filter(doc => {
            const data = doc.data();
            return !data.isHidden && data.startDate.toDate() <= now.toDate();
          })
          .map(async (docSnapshot) => {
            const data = docSnapshot.data();
            try {
              // Lấy thông tin người tạo
              const creatorRef = doc(db, 'users', data.createdBy);
              const creatorDoc = await getDoc(creatorRef);
              const creatorData = creatorDoc.data() as UserData | undefined;
              
              return {
                id: docSnapshot.id,
                ...data,
                creatorDisplayName: creatorData?.displayName || 'Người dùng ' + data.createdBy.slice(0, 6)
              } as Activity;
            } catch (err) {
              console.error('Error fetching creator data:', err);
              return {
                id: docSnapshot.id,
                ...data,
                creatorDisplayName: 'Người dùng ' + data.createdBy.slice(0, 6)
              } as Activity;
            }
          })
      );

      setActivities(activitiesList);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError('Không thể tải danh sách hoạt động. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return {
    activities,
    loading,
    error,
    refetch: fetchActivities
  };
};

export default useActivities;
