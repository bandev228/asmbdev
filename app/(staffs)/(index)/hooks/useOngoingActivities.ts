import { useState, useEffect, useCallback } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  Timestamp
} from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';

interface OngoingActivity {
  id: string;
  title: string;
  date: Date;
  location: string;
  creatorName: string;
  participantsCount: number;
  status: string;
}

const useOngoingActivities = (limitCount: number = 5) => {
  const [activities, setActivities] = useState<OngoingActivity[]>([]);
  const [loading, setLoading] = useState(true);
  
  const app = getApp();
  const db = getFirestore(app);

  const fetchActivities = useCallback(async () => {
    try {
      const now = Timestamp.fromDate(new Date());
      const activitiesRef = collection(db, 'activities');
      
      const activitiesQuery = query(
        activitiesRef,
        where('status', '==', 'approved'),
        where('endDate', '>=', now),
        orderBy('endDate', 'asc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(activitiesQuery);
      const usersRef = collection(db, 'users');

      const activitiesData = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();
          // Chỉ lấy những hoạt động đã bắt đầu
          if (data.startDate.toDate() <= new Date()) {
            const creatorRef = doc(usersRef, data.createdBy);
            const creatorDoc = await getDoc(creatorRef);
            const creatorData = creatorDoc.data();

            return {
              id: docSnapshot.id,
              title: data.name,
              date: data.startDate.toDate(),
              location: data.location || 'Chưa cập nhật',
              creatorName: creatorData?.displayName || 'Không xác định',
              participantsCount: data.participantLimit || 0,
              status: data.status
            };
          }
          return null;
        })
      );

      // Lọc bỏ các giá trị null và sắp xếp theo thời gian bắt đầu
      const filteredActivities = activitiesData
        .filter((activity): activity is OngoingActivity => activity !== null)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      setActivities(filteredActivities);
    } catch (error) {
      console.error('Error fetching ongoing activities:', error);
    } finally {
      setLoading(false);
    }
  }, [db, limitCount]);

  const refreshActivities = useCallback(async () => {
    setLoading(true);
    await fetchActivities();
  }, [fetchActivities]);

  const filterActivities = useCallback(
    (query: string) => {
      const searchTerm = query.toLowerCase();
      return activities.filter(
        (activity) =>
          activity.title.toLowerCase().includes(searchTerm) ||
          activity.location.toLowerCase().includes(searchTerm) ||
          activity.creatorName.toLowerCase().includes(searchTerm)
      );
    },
    [activities]
  );

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return {
    activities,
    loading,
    refreshActivities,
    filterActivities,
  };
};

export default useOngoingActivities;