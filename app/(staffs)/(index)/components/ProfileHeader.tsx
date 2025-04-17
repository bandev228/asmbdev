import type React from "react"
import { useRef, useEffect } from "react"
import { View, Text, StyleSheet, Image, Animated, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { UserProfile } from "../hooks/useUserProfile"

interface ProfileHeaderProps {
  profile: UserProfile | null
  onEditPress?: () => void
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ profile, onEditPress }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  if (!profile) {
    return (
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.loadingContainer}>
          <View style={styles.imagePlaceholder}>
            <Ionicons name="person" size={40} color="#3949AB" />
          </View>
          <View style={styles.infoPlaceholder}>
            <View style={[styles.placeholder, { width: "60%", height: 20 }]} />
            <View style={[styles.placeholder, { width: "80%", height: 16, marginTop: 8 }]} />
            <View style={[styles.placeholder, { width: "40%", height: 16, marginTop: 8 }]} />
          </View>
        </View>
      </Animated.View>
    )
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.info}>
          <Text style={styles.welcomeText}>Xin chào,</Text>
          <Text style={styles.name}>{profile.displayName}</Text>
          <Text style={styles.position}>{profile.position}</Text>
          <Text style={styles.department}>{profile.department}</Text>
        </View>
        <View style={styles.imageContainer}>
          {profile.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name="person" size={40} color="#3949AB" />
            </View>
          )}
          {onEditPress && (
            <TouchableOpacity style={styles.editButton} onPress={onEditPress}>
              <Ionicons name="pencil" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  info: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: "#7986CB",
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginTop: 4,
  },
  position: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  department: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: "#E8EAF6",
  },
  imagePlaceholder: {
    backgroundColor: "#E8EAF6",
    justifyContent: "center",
    alignItems: "center",
  },
  editButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#3949AB",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoPlaceholder: {
    flex: 1,
    marginLeft: 16,
  },
  placeholder: {
    backgroundColor: "#E8EAF6",
    borderRadius: 4,
  },
})
export default ProfileHeader;