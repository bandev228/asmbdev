import { useState, useEffect } from "react"
import { getAuth } from "@react-native-firebase/auth"
import { getFirestore, collection, doc, getDoc, updateDoc, serverTimestamp } from "@react-native-firebase/firestore"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useNetInfo } from "@react-native-community/netinfo"
import useStudentInfo from "./useStudentInfo"

export interface StudentProfile {
  uid: string
  displayName: string
  email: string
  photoURL?: string
  studentId: string
  faculty: string
  class: string
  major?: string
  enrollmentYear?: string
  lastActive?: Date
}

export function useStudentProfile() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const auth = getAuth()
  const db = getFirestore()
  const netInfo = useNetInfo()
  const { studentInfo } = useStudentInfo()

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
        const cachedProfile = await AsyncStorage.getItem(`student_profile_${currentUser.uid}`)
        if (cachedProfile && isMounted) {
          setProfile(JSON.parse(cachedProfile))
          setLoading(false)
        }

        // If offline and we have cached data, use it
        if (!netInfo.isConnected && cachedProfile) {
          return
        }

        // Get fresh data from Firestore
        const userDoc = await getDoc(doc(db, "users", currentUser.uid))

        if (!userDoc.exists) {
          throw new Error("User profile not found")
        }

        const userData = userDoc.data()
        const userProfile: StudentProfile = {
          uid: currentUser.uid,
          displayName: userData?.displayName || currentUser.displayName || "Sinh viên",
          email: userData?.email || currentUser.email || "",
          photoURL: userData?.photoURL || currentUser.photoURL,
          studentId: userData?.studentId || "Chưa cập nhật",
          faculty: userData?.faculty || "Chưa cập nhật",
          class: studentInfo?.['Mã lớp'] || userData?.class || "Chưa cập nhật",
          major: userData?.major || "Chưa cập nhật",
          enrollmentYear: userData?.enrollmentYear || "",
          lastActive: new Date(),
        }

        // Update Firestore with last active timestamp
        await updateDoc(doc(db, "users", currentUser.uid), {
          lastActive: serverTimestamp(),
        })

        // Cache the profile
        await AsyncStorage.setItem(`student_profile_${currentUser.uid}`, JSON.stringify(userProfile))

        if (isMounted) {
          setProfile(userProfile)
          setLoading(false)
        }
      } catch (err) {
        console.error("Error fetching student profile:", err)
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
  }, [netInfo.isConnected, studentInfo])

  const updateProfile = async (updates: Partial<StudentProfile>) => {
    try {
      if (!profile || !auth.currentUser) {
        throw new Error("User not authenticated")
      }

      await updateDoc(doc(db, "users", auth.currentUser.uid), updates)

      // Update local state and cache
      const updatedProfile = { ...profile, ...updates }
      setProfile(updatedProfile)
      await AsyncStorage.setItem(`student_profile_${auth.currentUser.uid}`, JSON.stringify(updatedProfile))

      return true
    } catch (err) {
      console.error("Error updating profile:", err)
      setError(err instanceof Error ? err : new Error("Unknown error occurred"))
      return false
    }
  }

  return { profile, loading, error, updateProfile }
}
export default useStudentProfile;