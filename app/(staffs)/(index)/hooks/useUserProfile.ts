import { useState, useEffect } from "react"
import { getAuth } from "@react-native-firebase/auth"
import { getFirestore, collection, doc, getDoc, updateDoc, serverTimestamp } from "@react-native-firebase/firestore"
import AsyncStorage from "@react-native-async-storage/async-storage"

export interface UserProfile {
  uid: string
  displayName: string
  email: string
  photoURL?: string
  department: string
  position: string
  role: string
  lastActive?: Date
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const auth = getAuth()
  const db = getFirestore()

  useEffect(() => {
    let isMounted = true

    const fetchProfile = async () => {
      try {
        setLoading(true)

        // Check if user is authenticated
        const currentUser = auth.currentUser
        if (!currentUser) {
          if (isMounted) {
            setProfile(null)
            setLoading(false)
          }
          return
        }

        // Try to get from cache first
        const cachedProfile = await AsyncStorage.getItem(`user_profile_${currentUser.uid}`)
        if (cachedProfile && isMounted) {
          setProfile(JSON.parse(cachedProfile))
          setLoading(false)
        }

        // Get fresh data from Firestore
        const userDoc = await getDoc(doc(db, "users", currentUser.uid))

        if (!userDoc.exists) {
          throw new Error("User profile not found")
        }

        const userData = userDoc.data()
        const userProfile: UserProfile = {
          uid: currentUser.uid,
          displayName: userData?.displayName || currentUser.displayName || "Quản lý",
          email: userData?.email || currentUser.email || "",
          photoURL: userData?.photoURL || currentUser.photoURL,
          department: userData?.department || "Chưa cập nhật",
          position: userData?.position || "Quản lý",
          role: userData?.role || "manager",
          lastActive: new Date(),
        }

        // Update Firestore with last active timestamp
        await updateDoc(doc(db, "users", currentUser.uid), {
          lastActive: serverTimestamp(),
        })

        // Cache the profile
        await AsyncStorage.setItem(`user_profile_${currentUser.uid}`, JSON.stringify(userProfile))

        if (isMounted) {
          setProfile(userProfile)
          setLoading(false)
        }
      } catch (err) {
        console.error("Error fetching user profile:", err)
        if (isMounted) {
          setError(err instanceof Error ? err : new Error("Unknown error occurred"))
          setLoading(false)
        }
      }
    }

    fetchProfile()

    return () => {
      isMounted = false
    }
  }, [])

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      if (!profile || !auth.currentUser) {
        throw new Error("User not authenticated")
      }

      await updateDoc(doc(db, "users", auth.currentUser.uid), updates)

      // Update local state and cache
      const updatedProfile = { ...profile, ...updates }
      setProfile(updatedProfile)
      await AsyncStorage.setItem(`user_profile_${auth.currentUser.uid}`, JSON.stringify(updatedProfile))

      return true
    } catch (err) {
      console.error("Error updating profile:", err)
      setError(err instanceof Error ? err : new Error("Unknown error occurred"))
      return false
    }
  }

  return { profile, loading, error, updateProfile }
}
export default useUserProfile;