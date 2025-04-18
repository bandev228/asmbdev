import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, orderBy, limit, Timestamp } from '@react-native-firebase/firestore';
import { getStorage, ref, getDownloadURL } from '@react-native-firebase/storage';

type FirebaseDocumentData = {
  [key: string]: any;
};

export interface Event {
  id: string;
  name: string;
  notes: string;
  location: string;
  startDate: Timestamp;
  endDate: Timestamp;
  duration: number;
  activityType: string;
  points: number;
  bannerImageUrl: string;
  participants: string[];
  pendingParticipants: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  organizerId: string;
  organizerName: string;
  organizerAvatar?: string;
  planFileUrl?: string;
  participantLimit: number;
}

export const useEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = getFirestore();
  const storage = getStorage();

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const now = Timestamp.now();
      
      const eventsQuery = query(
        collection(db, "activities"),
        where("startDate", ">", now),
        orderBy("startDate", "asc"),
        limit(20)
      );

      const snapshot = await getDocs(eventsQuery);
      const eventsData = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data() as FirebaseDocumentData;
        let organizerName = '';
        let organizerAvatar = '';

        // Fetch organizer info
        if (data.createdBy) {
          try {
            const organizerDoc = await getDocs(query(
              collection(db, "users"),
              where("uid", "==", data.createdBy)
            ));
            
            if (!organizerDoc.empty) {
              const organizerData = organizerDoc.docs[0].data();
              organizerName = organizerData.name || 'Không xác định';
              if (organizerData.avatar) {
                try {
                  const avatarRef = ref(storage, `users/${organizerData.avatar}`);
                  organizerAvatar = await getDownloadURL(avatarRef);
                } catch (error) {
                  console.error('Error fetching organizer avatar:', error);
                }
              }
            }
          } catch (error) {
            console.error('Error fetching organizer info:', error);
          }
        }

        const eventData = {
          id: doc.id,
          name: data.name || '',
          notes: data.notes || '',
          location: data.location || '',
          startDate: data.startDate,
          endDate: data.endDate,
          duration: data.duration || 0,
          activityType: data.activityType || 'Khác',
          points: data.points || 0,
          bannerImageUrl: data.bannerImageUrl || '',
          participants: data.participants || [],
          pendingParticipants: data.pendingParticipants || [],
          status: data.status || 'pending',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          organizerId: data.createdBy || '',
          organizerName,
          organizerAvatar,
          planFileUrl: data.planFileUrl || '',
          participantLimit: data.participantLimit || 0
        } as Event;

        // console.log('Processed event data:', eventData);
        return eventData;
      }));

    //   console.log('All events data:', eventsData);
      setEvents(eventsData);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const refetch = () => {
    fetchEvents();
  };

  return {
    events,
    loading,
    error,
    refetch
  };
}; 

export default useEvents;
