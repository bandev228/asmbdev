import type React from "react"
import { useEffect, useRef } from "react"
import { View, Text, StyleSheet, Animated } from "react-native"
import { Ionicons } from "@expo/vector-icons"

interface StatCardProps {
  value: number
  label: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  previousValue?: number
  delay?: number
}

export const StatCard: React.FC<StatCardProps> = ({ value, label, icon, color, previousValue, delay = 0 }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(20)).current
  const scaleAnim = useRef(new Animated.Value(0.9)).current
  const countAnim = useRef(new Animated.Value(previousValue || 0)).current

  const animatedValue = countAnim.interpolate({
    inputRange: [0, value],
    outputRange: [0, value],
    extrapolate: "clamp",
  })

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
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
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start()

    Animated.timing(countAnim, {
      toValue: value,
      duration: 1000,
      useNativeDriver: false,
    }).start()
  }, [value, delay])

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY }, { scale: scaleAnim }],
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.contentContainer}>
        <Animated.Text style={[styles.value, { color }]}>
          {animatedValue.interpolate({
            inputRange: [0, value],
            outputRange: [0, value].map((v) => Math.round(v).toString()),
          })}
        </Animated.Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    width: "48%",
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  value: {
    fontSize: 24,
    fontWeight: "bold",
  },
  label: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
})
export default StatCard;