import { View, Text } from 'react-native'
import React from 'react'
import { Stack } from 'expo-router';



export default function IndexLayout() {
  return (
    <Stack initialRouteName="index">
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
      name="CaiDat"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="HoiDapAI"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="TaiLieuSH"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="HDDangDienRa"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="HDThamGia"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="LSDiemDanh"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="PhanHoi"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="SuKien"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="ThoiKhoaBieu"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="ThongKeHD"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
        name="ThongTinSV"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="ChiTietHD"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="XemThongBao"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      {/* <Stack.Screen
        name="StudentTaiKhoan"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      /> */}
    </Stack>
  );
}