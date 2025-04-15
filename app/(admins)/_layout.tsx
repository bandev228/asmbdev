import { Tabs } from "expo-router"
import { StyleSheet } from "react-native"
import { FontAwesome5 } from "@expo/vector-icons"

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: {
          backgroundColor: "white",
          borderTopWidth: 1,
          borderTopColor: "#E5E5E5",
          height: 60,
          paddingBottom: 8,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="(index)"
        options={{
          title: "Trang chủ",
          tabBarIcon: ({ color }) => <FontAwesome5 name="home" size={24} color={color} />,
        }}
      />

      <Tabs.Screen
        name="AdminTaoHD"
        options={{
          title: "Tạo hoạt động",
          tabBarIcon: ({ color }) => <FontAwesome5 name="plus-circle" size={24} color={color} />,
        }}
      />

      <Tabs.Screen
        name="AdminTaiKhoan"
        options={{
          title: "Tài khoản",
          tabBarIcon: ({ color }) => <FontAwesome5 name="user" size={24} color={color} />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
    height: 60,
  },
  tabBarIcon: {
    marginBottom: 4,
  },
})
