import { useState, useEffect } from "react"
import { getFirestore, collection, query, where, getDocs } from "@react-native-firebase/firestore"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useNetInfo } from "@react-native-community/netinfo"

export interface ManagerStats {
  totalActivities: number
  pendingActivities: number
  approvedActivities: number
  rejectedActivities: number
  totalStudents: number
  activeStudents: number
  totalParticipations: number
  lastUpdated: Date
}

export function useManagerStats() {
  const [stats, setStats] = useState<ManagerStats>({
    totalActivities: 0,
    pendingActivities: 0,
    approvedActivities: 0,
    rejectedActivities: 0,
    totalStudents: 0,
    activeStudents: 0,
    totalParticipations: 0,
    lastUpdated: new Date(),
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const netInfo = useNetInfo()
  const db = getFirestore()

  const fetchStats = async (forceRefresh = false) => {
    try {
      setLoading(true)

      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedStats = await AsyncStorage.getItem("manager_stats")
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
        const cachedStats = await AsyncStorage.getItem("manager_stats")
        if (cachedStats) {
          const { data } = JSON.parse(cachedStats)
          setStats(data)
          setLoading(false)
          return
        }
      }

      // Fetch fresh data
      const [activitiesSnapshot, studentsSnapshot, participationsSnapshot] = await Promise.all([
        getDocs(collection(db, "activities")),
        getDocs(query(collection(db, "users"), where("role", "==", "student"))),
        getDocs(collection(db, "participations")),
      ])

      const activities = activitiesSnapshot.docs.map((doc) => doc.data())
      const pendingActivities = activities.filter((activity) => activity.status === "pending").length
      const approvedActivities = activities.filter((activity) => activity.status === "approved").length
      const rejectedActivities = activities.filter((activity) => activity.status === "rejected").length

      const totalStudents = studentsSnapshot.size

      // Count active students (participated in at least one activity)
      const participantIds = new Set()
      participationsSnapshot.docs.forEach((doc) => {
        const data = doc.data()
        if (data.studentId) {
          participantIds.add(data.studentId)
        }
      })

      const newStats: ManagerStats = {
        totalActivities: activitiesSnapshot.size,
        pendingActivities,
        approvedActivities,
        rejectedActivities,
        totalStudents,
        activeStudents: participantIds.size,
        totalParticipations: participationsSnapshot.size,
        lastUpdated: new Date(),
      }

      // Cache the results
      await AsyncStorage.setItem(
        "manager_stats",
        JSON.stringify({
          data: newStats,
          timestamp: Date.now(),
        }),
      )

      setStats(newStats)
      setLoading(false)
    } catch (err) {
      console.error("Error fetching stats:", err)
      setError(err instanceof Error ? err : new Error("Unknown error occurred"))
      setLoading(false)

      // Try to load from cache if we have a network error
      try {
        const cachedStats = await AsyncStorage.getItem("manager_stats")
        if (cachedStats) {
          const { data } = JSON.parse(cachedStats)
          setStats(data)
        }
      } catch (cacheErr) {
        console.error("Error loading from cache:", cacheErr)
      }
    }
  }

  useEffect(() => {
    fetchStats()
  }, [netInfo.isConnected])

  return { stats, loading, error, refreshStats: () => fetchStats(true) }
}
export default useManagerStats;