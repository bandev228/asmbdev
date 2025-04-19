import React from "react"
import { useState, useEffect, useRef } from "react"
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Animated, Dimensions,
  KeyboardAvoidingView, Platform, StatusBar, Keyboard, ActivityIndicator, TouchableWithoutFeedback, Pressable,
} from "react-native"
import { GoogleSignin } from "@react-native-google-signin/google-signin"
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
} from "@react-native-firebase/auth"
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "@react-native-firebase/firestore"

import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as Haptics from "expo-haptics"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useAuth } from "../_layout"
import * as LocalAuthentication from 'expo-local-authentication'
import AsyncStorage from "@react-native-async-storage/async-storage"

// Initialize Firebase services
const auth = getAuth()
const firestore = getFirestore()

const { width, height } = Dimensions.get("window")

export default function Login() {
  const router = useRouter()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false) // Tách riêng loading cho Google
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isBiometricSupported, setIsBiometricSupported] = useState(false)
  const [showBiometric, setShowBiometric] = useState(false)

  // Animations
  const fadeAnim = useState(new Animated.Value(0))[0]
  const slideAnim = useState(new Animated.Value(50))[0]
  const inputScaleAnim = useState(new Animated.Value(1))[0]
  const loadingSpinValue = useRef(new Animated.Value(0)).current

  // Add refs for direct text input focus
  const emailInputRef = useRef<TextInput>(null)
  const passwordInputRef = useRef<TextInput>(null)

  // Animation cho loading spinner
  useEffect(() => {
    if (loading || loadingGoogle) {
      Animated.loop(
        Animated.timing(loadingSpinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      loadingSpinValue.setValue(0);
    }
  }, [loading, loadingGoogle]);

  // Function to handle routing based on user email
  const handleRouting = (userEmail: string) => {
    console.log("Routing user with email:", userEmail);
    
    if (userEmail === "admin@gmail.com") {
      console.log("Routing to admin dashboard");
      router.replace("/(admins)/(index)");
    } else if (userEmail.endsWith("@student.tdmu.edu.vn")) {
      console.log("Routing to student dashboard");
      router.replace("/(students)/(index)");
    } else if (userEmail.endsWith("@tdmu.edu.vn")) {
      console.log("Routing to staff dashboard");
      router.replace("/(staffs)/(index)");
    } else {
      console.log("Default routing to student dashboard");
      router.replace("/(students)/(index)");
    }
  };

  // Redirect if already logged in
  useEffect(() => {
    if (user && user.email) {
      handleRouting(user.email);
    }
  }, [user, router]);

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const animateInput = (focused: boolean) => {
    Animated.timing(inputScaleAnim, {
      toValue: focused ? 1.02 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }

  const validateEmail = (text: string) => {
    setEmail(text)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!text) {
      setEmailError("Email is required")
    } else if (!emailRegex.test(text)) {
      setEmailError("Please enter a valid email")
    } else {
      setEmailError("")
    }
  }

  const validatePassword = (text: string) => {
    setPassword(text)
    if (!text) {
      setPasswordError("Password is required")
    } else if (text.length < 6) {
      setPasswordError("Password must be at least 6 characters")
    } else {
      setPasswordError("")
    }
  }

  // Function to save user data to Firestore
  const saveUserToFirestore = async (user: any) => {
    try {
      const userRef = doc(firestore, "users", user.uid)

      // Check if user document already exists
      const userDoc = await getDoc(userRef)

      // Determine role based on email
      let role = "user"
      if (user.email === "admin@gmail.com") {
        role = "admin"
      } else if (user.email?.endsWith("@student.tdmu.edu.vn")) {
        role = "student"
      } else if (user.email?.endsWith("@tdmu.edu.vn")) {
        role = "staff"
      }

      if (!userDoc.exists) {
        // Nếu user chưa tồn tại, tạo document mới
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName || "Anonymous User",
          photoURL: user.photoURL || null,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          role: role, // Add role field
        })
        console.log("New user added to Firestore with role:", role)
      } else {
        // Nếu user đã tồn tại, cập nhật lastLoginAt và role
        await updateDoc(userRef, {
          lastLoginAt: serverTimestamp(),
          role: role, // Update role field
        })
        console.log("Existing user updated in Firestore with role:", role)
      }

      // Luôn thêm mục nhập lịch sử đăng nhập mới
      await addDoc(collection(firestore, "loginHistory"), {
        userId: user.uid,
        email: user.email,
        displayName: user.displayName || "Anonymous User",
        timestamp: serverTimestamp(),
        device: Platform.OS,
        appVersion: "1.0.0", 
        loginMethod: user._authCredential ? "google" : "email", // Thêm thông tin phương thức đăng nhập
      })

      console.log("Login history recorded")
    } catch (error) {
      console.error("Error saving user data to Firestore:", error)
    }
  }

  // Google Sign-In function
  async function onGoogleButtonPress() {
    try {
      setLoadingGoogle(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
      const signInResult = await GoogleSignin.signIn()
      const idToken = signInResult.data?.idToken

      if (!idToken) {
        throw new Error("No ID token found")
      }

      const googleCredential = GoogleAuthProvider.credential(idToken)
      const userCredential = await signInWithCredential(auth, googleCredential)
      console.log("Signed in with Google:", userCredential.user.email)

      // Save user data to Firestore
      await saveUserToFirestore(userCredential.user)

      // If biometric is supported, save credentials
      if (isBiometricSupported) {
        // For Google sign-in, we'll use the email and a special token
        await AsyncStorage.setItem('userEmail', userCredential.user.email || '')
        await AsyncStorage.setItem('userPassword', 'google_sign_in')
        setShowBiometric(true)
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Use the new routing function
      if (userCredential.user.email) {
        handleRouting(userCredential.user.email);
      }
    } catch (error) {
      console.error("Google Sign-In error:", error)
      Alert.alert("Authentication Failed", "Unable to sign in with Google. Please try again.")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setLoadingGoogle(false)
    }
  }

  // Email/Password sign in
  async function signInWithEmail() {
    Keyboard.dismiss()

    // Validate inputs
    if (!email) setEmailError("Email is required")
    if (!password) setPasswordError("Password is required")

    if (!email || !password || emailError || passwordError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    try {
      setLoading(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      
      // If login successful, save credentials for biometric login
      if (isBiometricSupported) {
        await AsyncStorage.setItem('userEmail', email)
        await AsyncStorage.setItem('userPassword', password)
        setShowBiometric(true)
      }

      await saveUserToFirestore(userCredential.user)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      if (userCredential.user.email) {
        handleRouting(userCredential.user.email)
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)

      if (error.code === "auth/user-not-found") {
        Alert.alert("Account Not Found", "Would you like to create a new account with these credentials?", [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Create Account",
            onPress: async () => {
              try {
                setLoading(true)
                const userCredential = await createUserWithEmailAndPassword(auth, email, password)

                // Update user profile with a default display name
                await userCredential.user.updateProfile({
                  displayName: email.split("@")[0], // Use part of email as display name
                })

                // Save user data to Firestore
                await saveUserToFirestore(userCredential.user)

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                console.log("User account created & signed in!")

                // Use the new routing function for new accounts too
                if (userCredential.user.email) {
                  handleRouting(userCredential.user.email);
                }
              } catch (signUpError: any) {
                console.error(signUpError)
                Alert.alert("Registration Failed", signUpError.message)
              } finally {
                setLoading(false)
              }
            },
          },
        ])
      } else if (error.code === "auth/wrong-password") {
        setPasswordError("Incorrect password")
      } else if (error.code === "auth/invalid-email") {
        setEmailError("Invalid email format")
      } else {
        console.error(error)
        Alert.alert("Authentication Failed", error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Đăng nhập bằng sinh trắc học',
        disableDeviceFallback: false,
        cancelLabel: 'Hủy',
      })

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        
        const savedEmail = await AsyncStorage.getItem('userEmail')
        const savedPassword = await AsyncStorage.getItem('userPassword')
        
        if (savedEmail && savedPassword) {
          setLoading(true)
          
          if (savedPassword === 'google_sign_in') {
            // Handle Google sign-in
            await onGoogleButtonPress()
          } else {
            // Handle email/password sign-in
            const userCredential = await signInWithEmailAndPassword(auth, savedEmail, savedPassword)
            await saveUserToFirestore(userCredential.user)
            
            if (userCredential.user.email) {
              handleRouting(userCredential.user.email)
            }
          }
        }
      }
    } catch (error) {
      console.error('Biometric authentication error:', error)
      Alert.alert('Lỗi', 'Không thể xác thực sinh trắc học. Vui lòng thử lại.')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setLoading(false)
    }
  }

  // Hiệu ứng xoay cho loading spinner
  const spin = loadingSpinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  useEffect(() => {
    checkBiometricAvailability()
  }, [])

  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync()
      console.log('Biometric hardware available:', compatible)
      setIsBiometricSupported(compatible)

      if (!compatible) {
        console.log('Biometric hardware not available')
        return
      }

      const enrolled = await LocalAuthentication.isEnrolledAsync()
      console.log('Biometric enrolled:', enrolled)

      if (!enrolled) {
        console.log('No biometrics enrolled')
        return
      }

      // Check for saved credentials
      const savedEmail = await AsyncStorage.getItem('userEmail')
      const savedPassword = await AsyncStorage.getItem('userPassword')
      
      console.log('Has saved credentials:', !!savedEmail && !!savedPassword)
      
      if (savedEmail && savedPassword) {
        setShowBiometric(true)
      }
    } catch (error) {
      console.error('Error checking biometric availability:', error)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>ASM TDMU APP</Text>
            <Text style={styles.subtitle}>Đăng nhập để trải nghiệm !</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Tài khoản</Text>
              <Pressable
                onPress={() => emailInputRef.current?.focus()}
                style={({ pressed }) => [
                  styles.inputWrapper,
                  emailFocused && styles.inputWrapperFocused,
                  emailError && styles.inputWrapperError,
                  pressed && styles.inputWrapperPressed,
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={emailFocused ? "#6C5CE7" : "#A0A0A0"}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={emailInputRef}
                  style={styles.input}
                  placeholder="Nhập tài khoản của bạn"
                  value={email}
                  onChangeText={validateEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  accessibilityLabel="Email input"
                  onFocus={() => {
                    setEmailFocused(true)
                    animateInput(true)
                  }}
                  onBlur={() => {
                    setEmailFocused(false)
                    animateInput(false)
                    if (email && !emailError) validateEmail(email)
                  }}
                />
              </Pressable>
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mật khẩu</Text>
              <Pressable
                onPress={() => passwordInputRef.current?.focus()}
                style={({ pressed }) => [
                  styles.inputWrapper,
                  passwordFocused && styles.inputWrapperFocused,
                  passwordError && styles.inputWrapperError,
                  pressed && styles.inputWrapperPressed,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={passwordFocused ? "#6C5CE7" : "#A0A0A0"}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordInputRef}
                  style={styles.input}
                  placeholder="Nhập mật khẩu của bạn"
                  value={password}
                  onChangeText={validatePassword}
                  secureTextEntry={!isPasswordVisible}
                  accessibilityLabel="Password input"
                  onFocus={() => {
                    setPasswordFocused(true)
                    animateInput(true)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                  onBlur={() => {
                    setPasswordFocused(false)
                    animateInput(false)
                    if (password && !passwordError) validatePassword(password)
                  }}
                />
                <TouchableOpacity
                  style={styles.visibilityIcon}
                  onPress={() => {
                    setIsPasswordVisible(!isPasswordVisible)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                  accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
                >
                  <Ionicons name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} size={20} color="#A0A0A0" />
                </TouchableOpacity>
              </Pressable>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            </View>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Quên mật khẩu</Text>
            </TouchableOpacity>

            {isBiometricSupported && showBiometric && (
              <TouchableOpacity
                style={[styles.biometricButton, { marginBottom: 16 }]}
                onPress={handleBiometricAuth}
                disabled={loading}
              >
                <Ionicons name="finger-print" size={24} color="#FFFFFF" />
                <Text style={styles.biometricButtonText}>Đăng nhập bằng sinh trắc học</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.signInButton, loading && styles.buttonLoading]}
              onPress={signInWithEmail}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="sync" size={24} color="#FFFFFF" />
                  </Animated.View>
                  <Text style={styles.loadingText}>Đang đăng nhập...</Text>
                </View>
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>hoặc đăng nhập với</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialButtonsContainer}>
              <TouchableOpacity
                style={[styles.socialButton, loadingGoogle && styles.buttonLoading]}
                onPress={onGoogleButtonPress}
                disabled={loadingGoogle}
                activeOpacity={0.8}
              >
                {loadingGoogle ? (
                  <View style={styles.loadingContainer}>
                    <Animated.View style={{ transform: [{ rotate: spin }] }}>
                      <Ionicons name="sync" size={20} color="#DB4437" />
                    </Animated.View>
                  </View>
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#DB4437" />
                    <Text style={styles.socialButtonText}>Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
                <Ionicons name="logo-apple" size={20} color="#000000" />
                <Text style={styles.socialButtonText}>Apple</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Chưa có tài khoản ? </Text>
            <TouchableOpacity>
              <Text style={styles.signUpText}>Đăng ký</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666666",
    lineHeight: 22,
  },
  form: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    backgroundColor: "#F8F8F8",
    paddingHorizontal: 16,
    height: 56,
  },
  inputWrapperFocused: {
    borderColor: "#6C5CE7",
    backgroundColor: "#F8F7FF",
    shadowColor: "#6C5CE7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputWrapperError: {
    borderColor: "#FF4D4F",
    backgroundColor: "#FFF8F8",
  },
  inputWrapperPressed: {
    opacity: 0.9,
    backgroundColor: "#F0F0F0",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1A1A1A",
    height: 50, // Add explicit height
    paddingVertical: 8, // Add padding to increase touchable area
  },
  visibilityIcon: {
    padding: 4,
  },
  errorText: {
    color: "#FF4D4F",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: "#6C5CE7",
    fontSize: 14,
    fontWeight: "600",
  },
  signInButton: {
    backgroundColor: "#6C5CE7",
    borderRadius: 12,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#6C5CE7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonLoading: {
    backgroundColor: "#8a7cd9", // Màu nhạt hơn khi loading
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  biometricContainer: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C5CE7',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginVertical: 16,
    shadowColor: "#6C5CE7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  biometricButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  dividerText: {
    color: "#666666",
    fontSize: 14,
    marginHorizontal: 16,
  },
  socialButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 24,
    flex: 0.48,
  },
  socialButtonText: {
    color: "#1A1A1A",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  footerText: {
    color: "#666666",
    fontSize: 14,
  },
  signUpText: {
    color: "#6C5CE7",
    fontSize: 14,
    fontWeight: "700",
  },
})
