import React, { useRef } from "react"
import { TouchableOpacity, Text, StyleSheet, Animated, type ViewStyle, TextStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from 'expo-router'

interface NavigationButtonProps {
  title: string
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  color?: string
  containerStyle?: ViewStyle
  delay?: number
  route: string
  style?: ViewStyle
  textStyle?: TextStyle
}

export const NavigationButton: React.FC<NavigationButtonProps> = ({
  title,
  icon,
  onPress,
  color = "#007AFF",
  containerStyle,
  delay = 0,
  route,
  style,
  textStyle,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(20)).current
  const router = useRouter()

  React.useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start()
  }, [delay])

  const onPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start()
  }

  const onPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start()
  }

  return (
    <Animated.View
      style={[
        styles.container,
        containerStyle,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }, { translateY }],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.button, { borderLeftColor: color }, style]}
        onPress={() => router.push(route as any)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.7}
      >
        <Ionicons name={icon} size={24} color={color} />
        <Text style={[styles.text, { color: "#333" }, textStyle]}>{title}</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: "48%",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  text: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
})

export default NavigationButton;
