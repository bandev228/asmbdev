import type React from "react"
import { useRef, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from "react-native"
import { Ionicons } from "@expo/vector-icons"

interface EventCardProps {
  id: string
  title: string
  date: Date
  location: string
  isParticipating: boolean
  description?: string
  category?: string
  imageUrl?: string
  onPress: (id: string) => void
  index: number
}

export const EventCard: React.FC<EventCardProps> = ({
  id,
  title,
  date,
  location,
  isParticipating,
  description,
  category,
  imageUrl,
  onPress,
  index,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateX = useRef(new Animated.Value(50)).current

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 100),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start()
  }, [index])

  const formattedDate = date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateX }],
        },
      ]}
    >
      <TouchableOpacity onPress={() => onPress(id)} activeOpacity={0.7} style={styles.touchable}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="calendar" size={32} color="#C5CAE9" />
          </View>
        )}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#7986CB" />
            <Text style={styles.infoText}>{formattedDate}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#7986CB" />
            <Text style={styles.infoText} numberOfLines={1}>
              {location}
            </Text>
          </View>
          {category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{category}</Text>
            </View>
          )}
          {isParticipating && (
            <View style={styles.participatingBadge}>
              <Text style={styles.participatingText}>Đã đăng ký</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    marginRight: 16,
    width: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  touchable: {
    flexDirection: "column",
  },
  image: {
    width: "100%",
    height: 120,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  imagePlaceholder: {
    backgroundColor: "#E8EAF6",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },
  categoryBadge: {
    position: "absolute",
    top: -130,
    right: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(57, 73, 171, 0.8)",
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFF",
  },
  participatingBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#E8F5E9",
  },
  participatingText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#43A047",
  },
})
export default EventCard;