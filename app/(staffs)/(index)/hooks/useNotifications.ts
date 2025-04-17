import { useState, useEffect } from "react"
import { getFirestore, collection, query, where, orderBy, limit, getDocs, doc, updateDoc, addDoc, deleteField, onSnapshot } from "@react-native-firebase/firestore"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { getAuth } from "@react-native-firebase/auth"

export interface Notification {
  id: string
  title: string
  message: string
  createdAt: Date
  read: boolean
  type: "activity" | "approval" | "announcement" | "system"
  relatedId?: string
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const auth = getAuth()
  const db = getFirestore()

  const fetchNotifications = async (forceRefresh = false) => {
    try {
      setLoading(true)

      const userId = auth.currentUser?.uid
      if (!userId) {
        throw new Error("User not authenticated")
      }

      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedNotifications = await AsyncStorage.getItem(`notifications_${userId}`)
        if (cachedNotifications) {
          const { data, timestamp } = JSON.parse(cachedNotifications)
          const isExpired = Date.now() - timestamp > 5 * 60 * 1000 // 5 minutes

          if (!isExpired) {
            setNotifications(
              data.map((notification: any) => ({
                ...notification,
                createdAt: new Date(notification.createdAt),
              })),
            )
            setUnreadCount(data.filter((notification: any) => !notification.read).length)
            setLoading(false)
            return
          }
        }
      }

      // Fetch fresh data
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(20)
      )
      const notificationsSnapshot = await getDocs(notificationsQuery)

      const notificationsData = notificationsSnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          title: data.title || "Thông báo mới",
          message: data.message || "",
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          read: data.read || false,
          type: data.type || "system",
          relatedId: data.relatedId,
        }
      })

      // Cache the results
      await AsyncStorage.setItem(
        `notifications_${userId}`,
        JSON.stringify({
          data: notificationsData,
          timestamp: Date.now(),
        }),
      )

      setNotifications(notificationsData)
      setUnreadCount(notificationsData.filter((notification) => !notification.read).length)
      setLoading(false)
    } catch (err) {
      console.error("Error fetching notifications:", err)
      setError(err instanceof Error ? err : new Error("Unknown error occurred"))
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) {
        throw new Error("User not authenticated")
      }

      // Update in Firestore
      await updateDoc(doc(db, "notifications", notificationId), {
        read: true,
      })

      // Update local state
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? { ...notification, read: true } : notification,
        ),
      )

      // Update unread count
      setUnreadCount((prev) => Math.max(0, prev - 1))

      // Update cache
      const currentUserId = auth.currentUser?.uid
      if (currentUserId) {
        const cachedNotifications = await AsyncStorage.getItem(`notifications_${currentUserId}`)
        if (cachedNotifications) {
          const { data, timestamp } = JSON.parse(cachedNotifications)
          const updatedData = data.map((notification: any) =>
            notification.id === notificationId ? { ...notification, read: true } : notification,
          )

          await AsyncStorage.setItem(
            `notifications_${currentUserId}`,
            JSON.stringify({
              data: updatedData,
              timestamp,
            }),
          )
        }
      }

      return true
    } catch (err) {
      console.error("Error marking notification as read:", err)
      return false
    }
  }

  const markAllAsRead = async () => {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) {
        throw new Error("User not authenticated")
      }

      // Get all unread notification IDs
      const unreadIds = notifications
        .filter((notification) => !notification.read)
        .map((notification) => notification.id)

      if (unreadIds.length === 0) return true

      // Update in Firestore
      const batch = db.batch()
      unreadIds.forEach((id) => {
        const notificationRef = doc(db, "notifications", id)
        batch.update(notificationRef, { read: true })
      })

      await batch.commit()

      // Update local state
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))

      // Update unread count
      setUnreadCount(0)

      // Update cache
      const cachedNotifications = await AsyncStorage.getItem(`notifications_${userId}`)
      if (cachedNotifications) {
        const { data, timestamp } = JSON.parse(cachedNotifications)
        const updatedData = data.map((notification: any) => ({
          ...notification,
          read: true,
        }))

        await AsyncStorage.setItem(
          `notifications_${userId}`,
          JSON.stringify({
            data: updatedData,
            timestamp,
          }),
        )
      }

      return true
    } catch (err) {
      console.error("Error marking all notifications as read:", err)
      return false
    }
  }

  useEffect(() => {
    fetchNotifications()

    // Set up real-time listener for new notifications
    const userId = auth.currentUser?.uid
    if (!userId) return

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("read", "==", false)
    )

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        if (snapshot.docChanges().length > 0) {
          // Refresh notifications if there are changes
          fetchNotifications(true)
        }
      },
      (error) => {
        console.error("Notifications listener error:", error)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refreshNotifications: () => fetchNotifications(true),
    markAsRead,
    markAllAsRead,
  }
}
export default useNotifications;