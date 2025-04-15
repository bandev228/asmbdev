import { Tabs } from "expo-router"
import { StyleSheet } from "react-native"
import { FontAwesome5 } from "@expo/vector-icons"

// Tab configuration object
const TAB_CONFIG = {
  home: {
    name: "(index)",
    title: "Trang chủ",
    iconName: "home",
  },
  diemdanh: {
    name: "DiemDanhHD",
    title: "Điểm Danh",
    iconName: "plus-circle",
  },
  account: {
    name: "StudentTaiKhoan",
    title: "Tài khoản",
    iconName: "user",
  },
} as const

const renderTabIcon = (iconName: string, color: string) => {
  return <FontAwesome5 name={iconName} size={24} color={color} />
}

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
          paddingBottom: 8, // Thêm padding để icon không quá sát đáy
          
        },
        headerShown: false, // Ẩn header mặc định

      }}
    >
      <Tabs.Screen
        name={TAB_CONFIG.home.name}
        options={{
          title: TAB_CONFIG.home.title,
          tabBarIcon: ({ color }: { color: string }) =>
            renderTabIcon(
              TAB_CONFIG.home.iconName,
              color
            ),
        }}
      />

      <Tabs.Screen
        name={TAB_CONFIG.diemdanh.name}
        options={{
          title: TAB_CONFIG.diemdanh.title,
          tabBarIcon: ({ color }: { color: string }) =>
            renderTabIcon(
              TAB_CONFIG.diemdanh.iconName,
              color
            ),
        }}
      />

      <Tabs.Screen
        name={TAB_CONFIG.account.name}
        options={{
          title: TAB_CONFIG.account.title,
          tabBarIcon: ({ color }: { color: string }) =>
            renderTabIcon(
              TAB_CONFIG.account.iconName,
              color
            ),
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
