import { useState, useEffect } from "react"
import { getFirestore, collection, query, where, orderBy, limit, getDocs, getDoc, doc } from "@react-native-firebase/firestore"
import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useNetInfo } from "@react-native-community/netinfo"

interface UserData {
  name: string;
  email: string;
  [key: string]: any;
}

export interface PendingActivity {
  id: string
  title: string
  date: Date
  location: string
  createdBy: string
  creatorName: string
  participantsCount: number
  description: string
  category: string
  createdAt: Date
}

export function usePendingActivities(limitCount = 5) {
  const [activities, setActivities] = useState<PendingActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const netInfo = useNetInfo()
  const db = getFirestore()

  const fetchActivities = async (forceRefresh = false) => {
    try {
      setLoading(true)

      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedActivities = await AsyncStorage.getItem(`pending_activities_${limitCount}`)
        if (cachedActivities) {
          const { data, timestamp } = JSON.parse(cachedActivities)
          const isExpired = Date.now() - timestamp > 2 * 60 * 1000 // 2 minutes

          if (!isExpired || !netInfo.isConnected) {
            setActivities(
              data.map((activity: any) => ({
                ...activity,
                date: new Date(activity.date),
                createdAt: new Date(activity.createdAt),
              })),
            )
            setLoading(false)
            return
          }
        }
      }

      // If offline and we have cached data, use it
      if (!netInfo.isConnected) {
        const cachedActivities = await AsyncStorage.getItem(`pending_activities_${limitCount}`)
        if (cachedActivities) {
          const { data } = JSON.parse(cachedActivities)
          setActivities(
            data.map((activity: any) => ({
              ...activity,
              date: new Date(activity.date),
              createdAt: new Date(activity.createdAt),
            })),
          )
          setLoading(false)
          return
        }
      }

      // Fetch fresh data
      const activitiesSnapshot = await getDocs(
        query(
          collection(db, "activities"),
          where("status", "==", "pending"),
          orderBy("createdAt", "desc"),
          limit(limitCount)
        )
      )

      // Get creator names in parallel
      const activitiesData = await Promise.all(activitiesSnapshot.docs.map(async (doc) => {
        const data = doc.data()
        const activity: PendingActivity = {
          id: doc.id,
          title: data.name || "Hoạt động không tên",
          date: data.date ? data.date.toDate() : new Date(),
          location: data.location || "Chưa cập nhật",
          createdBy: data.createdBy || "",
          creatorName: "Đang tải...",
          participantsCount: data.participants ? data.participants.length : 0,
          description: data.description || "",
          category: data.category || "Khác",
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        }

        // Fetch creator name
        const creatorRef = getFirestore().collection('users').doc(activity.createdBy)
        const creatorDoc = await getDoc(creatorRef)
        if (creatorDoc.exists) {
          const creatorData = creatorDoc.data() as UserData
          activity.creatorName = creatorData.name || "Người dùng"
        } else {
          activity.creatorName = "Người dùng không xác định"
        }

        return activity
      }))

      setActivities(activitiesData)

      // Cache the results
      await AsyncStorage.setItem(
        `pending_activities_${limitCount}`,
        JSON.stringify({
          data: activitiesData,
          timestamp: Date.now(),
        }),
      )

      setLoading(false)
    } catch (err) {
      console.error("Error fetching pending activities:", err)
      setError(err instanceof Error ? err : new Error("Unknown error occurred"))
      setLoading(false)

      // Try to load from cache if we have a network error
      try {
        const cachedActivities = await AsyncStorage.getItem(`pending_activities_${limitCount}`)
        if (cachedActivities) {
          const { data } = JSON.parse(cachedActivities)
          setActivities(
            data.map((activity: any) => ({
              ...activity,
              date: new Date(activity.date),
              createdAt: new Date(activity.createdAt),
            })),
          )
        }
      } catch (cacheErr) {
        console.error("Error loading from cache:", cacheErr)
      }
    }
  }

  useEffect(() => {
    fetchActivities()
  }, [netInfo.isConnected, limitCount])

  return {
    activities,
    loading,
    error,
    refreshActivities: () => fetchActivities(true),
    filterActivities: (query: string) => {
      if (!query.trim()) return activities

      return activities.filter(
        (activity) =>
          activity.title.toLowerCase().includes(query.toLowerCase()) ||
          activity.location.toLowerCase().includes(query.toLowerCase()) ||
          activity.creatorName.toLowerCase().includes(query.toLowerCase()) ||
          activity.category.toLowerCase().includes(query.toLowerCase()),
      )
    },
  }
}
export default usePendingActivities;