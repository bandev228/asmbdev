import { View, Text } from 'react-native'
import React from 'react'
import { Stack } from 'expo-router';



export default function IndexLayout() {
  return (
    <Stack initialRouteName="index">
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
      name="QuanLyHD"
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
      name="BaoCaoHD"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="DuyetHD"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="DuyetSV"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="QuanLySV"
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
      name="QuanLyTB"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="KetThucHD"
      options={{
        headerShown: false,
        presentation: "card",
        
      }}
      />
      <Stack.Screen
      name="GuiTLSH"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="TiepNhanPH"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="ChinhSuaHD"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      {/* <Stack.Screen
        name="TaoHD"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="TaiKhoan"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      /> */}
    </Stack>
  );
}