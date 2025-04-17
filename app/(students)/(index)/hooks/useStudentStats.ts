import { useState, useEffect } from "react"
import { getFirestore, collection, getDocs } from "@react-native-firebase/firestore"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useNetInfo } from "@react-native-community/netinfo"
import { getAuth } from "@react-native-firebase/auth"

export interface StudentStats {
  participatedCount: number
  completedCount: number
  pendingCount: number
  totalHours: number
  lastUpdated: Date
}

export function useStudentStats() {
  const [stats, setStats] = useState<StudentStats>({
    participatedCount: 0,
    completedCount: 0,
    pendingCount: 0,
    totalHours: 0,
    lastUpdated: new Date(),
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const netInfo = useNetInfo()
  const auth = getAuth()
  const db = getFirestore()

  const fetchStats = async (forceRefresh = false) => {
    try {
      setLoading(true)

      const userId = auth.currentUser?.uid
      if (!userId) {
        setStats({
          participatedCount: 0,
          completedCount: 0,
          pendingCount: 0,
          totalHours: 0,
          lastUpdated: new Date(),
        })
        setLoading(false)
        return
      }

      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedStats = await AsyncStorage.getItem(`student_stats_${userId}`)
        if (cachedStats) {
          const { data, timestamp } = JSON.parse(cachedStats)
          const isExpired = Date.now() - timestamp > 5 * 60 * 1000 // 5 minutes

          if (!isExpired || !netInfo.isConnected) {
            setStats(data)
            setLoading(false)
            return
          }
        }
      }

      // If offline and we have cached data, use it
      if (!netInfo.isConnected) {
        const cachedStats = await AsyncStorage.getItem(`student_stats_${userId}`)
        if (cachedStats) {
          const { data } = JSON.parse(cachedStats)
          setStats(data)
          setLoading(false)
          return
        }
      }

      // Fetch fresh data
      const activitiesSnapshot = await getDocs(collection(db, "activities"))

      let participatedCount = 0
      let completedCount = 0
      let pendingCount = 0
      let totalHours = 0

      const now = new Date()

      activitiesSnapshot.docs.forEach((doc) => {
        const data = doc.data()
        if (data.participants && Array.isArray(data.participants) && data.participants.includes(userId)) {
          participatedCount++

          const endDate = data.endDate ? data.endDate.toDate() : null
          const startDate = data.startDate ? data.startDate.toDate() : null

          if (endDate && endDate < now) {
            completedCount++
          } else if (startDate && startDate > now) {
            pendingCount++
          }

          if (data.duration && typeof data.duration === "number") {
            totalHours += data.duration
          }
        }
      })

      const newStats: StudentStats = {
        participatedCount,
        completedCount,
        pendingCount,
        totalHours,
        lastUpdated: new Date(),
      }

      // Cache the results
      await AsyncStorage.setItem(
        `student_stats_${userId}`,
        JSON.stringify({
          data: newStats,
          timestamp: Date.now(),
        }),
      )

      setStats(newStats)
      setLoading(false)
    } catch (err) {
      console.error("Error fetching student stats:", err)
      setError(err instanceof Error ? err : new Error("Unknown error occurred"))

      // Try to load from cache if we have a network error
      try {
        const userId = auth.currentUser?.uid
        if (userId) {
          const cachedStats = await AsyncStorage.getItem(`student_stats_${userId}`)
          if (cachedStats) {
            const { data } = JSON.parse(cachedStats)
            setStats(data)
          }
        }
      } catch (cacheErr) {
        console.error("Error loading from cache:", cacheErr)
      }
    }
  }

  useEffect(() => {
    let isMounted = true
    fetchStats()
    return () => {
      isMounted = false
    }
  }, [netInfo.isConnected])

  return { stats, loading, error, refreshStats: () => fetchStats(true) }
}
export default useStudentStats;