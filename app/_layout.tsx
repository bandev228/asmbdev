"use client"

import { useEffect, useState, createContext, useContext } from "react"
import { Stack, Redirect } from "expo-router"
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native"
import { getApp } from "@react-native-firebase/app"
import { getAuth, type FirebaseAuthTypes } from "@react-native-firebase/auth"
import { GoogleSignin } from "@react-native-google-signin/google-signin"
import { getFirestore, collection, addDoc, serverTimestamp } from "@react-native-firebase/firestore"

type AuthContextType = {
  user: FirebaseAuthTypes.User | null
  signOut: () => Promise<void>
  initializing: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export default function RootLayout() {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null)
  const [initializing, setInitializing] = useState(true)

  const app = getApp()
  const auth = getAuth(app)
  const db = getFirestore(app)

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: "778849281834-ik29osktr3gs16dhcv23gtk9j1tn0arp.apps.googleusercontent.com",
    })


    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      console.log("Auth state changed:", currentUser ? `User: ${currentUser.email}` : "No user")

      if (currentUser && !user) {
        addDoc(collection(db, "userLogins"), {
          userId: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          loginTime: serverTimestamp(),
          device: Platform.OS,
          appVersion: "1.0.0",
        }).catch((error) => console.error("Error logging login event:", error))
      }

      setUser(currentUser)
      setInitializing(false)
    })

    return unsubscribe
  }, [db])

  const signOut = async () => {
    try {
      console.log("Signing out")
      await auth.signOut()
      await GoogleSignin.signOut()
      try {
        await GoogleSignin.revokeAccess()
      } catch (error) {
        console.log("Error revoking access (this is often normal):", error)
      }
      console.log("Sign out complete")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    )
  }

  // Thay đổi cách xử lý khi không có user
  if (!user) {
    return (
      <AuthContext.Provider value={{ user, signOut, initializing }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="index" options={{ headerShown: false }} redirect={true} />
        </Stack>
        <Redirect href="/(auth)/login" />
      </AuthContext.Provider>
    )
  }

  // Xác định route dựa vào user (chỉ dùng cho logging)
  const initialRoute = !user
    ? "/(auth)/login"
    : user.email === "admin@gmail.com"
      ? "/(admins)"
      : user.email?.endsWith("@tdmu.edu.vn")
        ? "/(staffs)"
        : "/(students)"

  console.log("Routing to:", initialRoute)

  return (
    <AuthContext.Provider value={{ user, signOut, initializing }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(admins)" options={{ headerShown: false }} />
        <Stack.Screen name="(students)" options={{ headerShown: false }} />
        <Stack.Screen name="(staffs)" options={{ headerShown: false }} />
      </Stack>
    </AuthContext.Provider>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
})
