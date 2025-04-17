import { useState, useEffect } from "react"
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from "@react-native-firebase/firestore"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useNetInfo } from "@react-native-community/netinfo"
import { getAuth } from "@react-native-firebase/auth"

export interface Event {
  id: string
  title: string
  date: Date
  location: string
  isParticipating: boolean
  description?: string
  category?: string
  organizer?: string
  imageUrl?: string
}

export function useUpcomingEvents(maxEvents = 5) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const netInfo = useNetInfo()
  const auth = getAuth()
  const db = getFirestore()

  const fetchEvents = async (forceRefresh = false) => {
    try {
      setLoading(true)

      const userId = auth.currentUser?.uid
      if (!userId) {
        setEvents([])
        setLoading(false)
        return
      }

      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedEvents = await AsyncStorage.getItem(`upcoming_events_${userId}_${maxEvents}`)
        if (cachedEvents) {
          const { data, timestamp } = JSON.parse(cachedEvents)
          const isExpired = Date.now() - timestamp > 5 * 60 * 1000 // 5 minutes

          if (!isExpired || !netInfo.isConnected) {
            setEvents(
              data.map((event: any) => ({
                ...event,
                date: new Date(event.date),
              })),
            )
            setLoading(false)
            return
          }
        }
      }

      // If offline and we have cached data, use it
      if (!netInfo.isConnected) {
        const cachedEvents = await AsyncStorage.getItem(`upcoming_events_${userId}_${maxEvents}`)
        if (cachedEvents) {
          const { data } = JSON.parse(cachedEvents)
          setEvents(
            data.map((event: any) => ({
              ...event,
              date: new Date(event.date),
            })),
          )
          setLoading(false)
          return
        }
      }

      // Fetch fresh data
      const now = new Date()
      const eventsQuery = query(
        collection(db, "activities"),
        where("startDate", ">", now),
        orderBy("startDate", "asc"),
        limit(maxEvents)
      )

      const eventsSnapshot = await getDocs(eventsQuery)

      const upcomingEventsData: Event[] = eventsSnapshot.docs.map((doc) => {
        const data = doc.data()
        const startDate = data.startDate ? data.startDate.toDate() : new Date()
        return {
          id: doc.id,
          title: data.name || "Sự kiện không tên",
          date: startDate,
          location: data.location || "Chưa cập nhật",
          isParticipating: data.participants && Array.isArray(data.participants) && data.participants.includes(userId),
          description: data.description || "",
          category: data.category || "Khác",
          organizer: data.organizer || "Chưa cập nhật",
          imageUrl: data.imageUrl || "",
        }
      })

      // Cache the results
      await AsyncStorage.setItem(
        `upcoming_events_${userId}_${maxEvents}`,
        JSON.stringify({
          data: upcomingEventsData,
          timestamp: Date.now(),
        }),
      )

      setEvents(upcomingEventsData)
      setLoading(false)
    } catch (err) {
      console.error("Error fetching upcoming events:", err)
      setError(err instanceof Error ? err : new Error("Unknown error occurred"))
      setLoading(false)

      // Try to load from cache if we have a network error
      try {
        const userId = auth.currentUser?.uid
        if (userId) {
          const cachedEvents = await AsyncStorage.getItem(`upcoming_events_${userId}_${maxEvents}`)
          if (cachedEvents) {
            const { data } = JSON.parse(cachedEvents)
            setEvents(
              data.map((event: any) => ({
                ...event,
                date: new Date(event.date),
              })),
            )
          }
        }
      } catch (cacheErr) {
        console.error("Error loading from cache:", cacheErr)
      }
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [netInfo.isConnected, maxEvents])

  return {
    events,
    loading,
    error,
    refreshEvents: () => fetchEvents(true),
    filterEvents: (query: string) => {
      if (!query.trim()) return events

      return events.filter(
        (event) =>
          event.title.toLowerCase().includes(query.toLowerCase()) ||
          event.location.toLowerCase().includes(query.toLowerCase()) ||
          (event.description && event.description.toLowerCase().includes(query.toLowerCase())) ||
          (event.category && event.category.toLowerCase().includes(query.toLowerCase())),
      )
    },
  }
}
export default useUpcomingEvents;