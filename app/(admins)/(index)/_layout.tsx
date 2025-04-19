import { View, Text } from 'react-native'
import React from 'react'
import { Stack } from 'expo-router';



export default function IndexLayout() {
  return (
    <Stack initialRouteName="index">
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
      name="HoatDong"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="SuaHD"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="SuaTaiKhoan"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="HDDaTao"
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
      name="DuyetSVTG"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="HDNoiBat"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="QuanLyTK"
      options={{
        headerShown: false,
        presentation: "card",
      }}
      />
      <Stack.Screen
      name="ThongBao"
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
        name="CaiDat"
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
        name="GuiTL"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      {/* <Stack.Screen
        name="AdminTaoHD"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="AdminTaiKhoan"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      /> */}
    </Stack>
  );
}