import { View, Text, StyleSheet } from "react-native"

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 20,
    fontWeight: "bold",
  },
})

export default function Page() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome to the App!</Text>
    </View>
  )
}
