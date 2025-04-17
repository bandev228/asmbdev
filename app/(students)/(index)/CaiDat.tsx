import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Dimensions,
  StatusBar,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAuth, signOut } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const screenWidth = Dimensions.get('window').width;

interface SettingItem {
  id: string;
  title: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  type: 'toggle' | 'button' | 'link';
  value?: boolean;
  onPress?: () => void;
  link?: string;
}

const CaiDat = () => {
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [faceIdEnabled, setFaceIdEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const handleLogout = useCallback(async () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất?',
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            try {
              const auth = getAuth();
              await signOut(auth);
              await AsyncStorage.clear();
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Lỗi khi đăng xuất:', error);
              Alert.alert('Lỗi', 'Không thể đăng xuất. Vui lòng thử lại.');
            }
          },
        },
      ]
    );
  }, []);

  const settingSections = [
    {
      title: 'Tài khoản',
      data: [
        {
          id: 'profile',
          title: 'Thông tin cá nhân',
          icon: 'person-outline' as const,
          type: 'button' as const,
          onPress: () => router.push('/(students)/profile' as any),
        },
        {
          id: 'security',
          title: 'Bảo mật',
          icon: 'shield-outline' as const,
          type: 'button' as const,
          onPress: () => router.push('/(students)/security' as any),
        },
        {
          id: 'faceId',
          title: 'Face ID',
          description: 'Sử dụng Face ID để đăng nhập',
          icon: 'scan-outline' as const,
          type: 'toggle' as const,
          value: faceIdEnabled,
          onPress: () => setFaceIdEnabled(!faceIdEnabled),
        },
      ],
    },
    {
      title: 'Ứng dụng',
      data: [
        {
          id: 'notification',
          title: 'Thông báo',
          description: 'Bật/tắt thông báo từ ứng dụng',
          icon: 'notifications-outline' as const,
          type: 'toggle' as const,
          value: notificationEnabled,
          onPress: () => setNotificationEnabled(!notificationEnabled),
        },
        {
          id: 'darkMode',
          title: 'Chế độ tối',
          description: 'Thay đổi giao diện sáng/tối',
          icon: 'moon-outline' as const,
          type: 'toggle' as const,
          value: darkMode,
          onPress: () => setDarkMode(!darkMode),
        },
        {
          id: 'language',
          title: 'Ngôn ngữ',
          icon: 'language-outline' as const,
          type: 'button' as const,
          onPress: () => router.push('/(students)/language' as any),
        },
      ],
    },
    {
      title: 'Hỗ trợ',
      data: [
        {
          id: 'help',
          title: 'Trợ giúp',
          icon: 'help-circle-outline' as const,
          type: 'link' as const,
          link: 'https://support.example.com',
        },
        {
          id: 'feedback',
          title: 'Góp ý',
          icon: 'chatbox-outline' as const,
          type: 'button' as const,
          onPress: () => router.push('/(students)/feedback' as any),
        },
        {
          id: 'about',
          title: 'Về ứng dụng',
          icon: 'information-circle-outline' as const,
          type: 'button' as const,
          onPress: () => router.push('/(students)/about' as any),
        },
      ],
    },
  ];

  const renderSettingItem = (item: SettingItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.settingItem}
      onPress={
        item.type === 'link'
          ? () => Linking.openURL(item.link!)
          : item.type === 'button'
          ? item.onPress
          : undefined
      }
    >
      <View style={styles.settingItemLeft}>
        <Ionicons name={item.icon} size={screenWidth * 0.06} color="#007AFF" />
        <View style={styles.settingItemContent}>
          <Text style={styles.settingItemTitle}>{item.title}</Text>
          {item.description && (
            <Text style={styles.settingItemDescription}>{item.description}</Text>
          )}
        </View>
      </View>
      {item.type === 'toggle' ? (
        <Switch
          value={item.value}
          onValueChange={item.onPress}
          trackColor={{ false: '#D1D1D6', true: '#34C759' }}
          thumbColor="#FFFFFF"
        />
      ) : (
        <Ionicons name="chevron-forward" size={screenWidth * 0.06} color="#C7C7CC" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Cài đặt</Text>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {settingSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionContent}>
                {section.data.map(renderSettingItem)}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={screenWidth * 0.06} color="#FF3B30" />
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F0F0F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenWidth * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: screenWidth * 0.055,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: screenWidth * 0.04,
  },
  sectionTitle: {
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
    color: '#666666',
    marginBottom: screenWidth * 0.02,
    paddingHorizontal: screenWidth * 0.04,
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: screenWidth * 0.04,
    paddingHorizontal: screenWidth * 0.04,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingItemContent: {
    marginLeft: screenWidth * 0.03,
    flex: 1,
  },
  settingItemTitle: {
    fontSize: screenWidth * 0.042,
    color: '#333333',
    marginBottom: 2,
  },
  settingItemDescription: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: screenWidth * 0.08,
    marginBottom: screenWidth * 0.08,
    padding: screenWidth * 0.04,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },
  logoutText: {
    fontSize: screenWidth * 0.042,
    color: '#FF3B30',
    fontWeight: '600',
    marginLeft: screenWidth * 0.02,
  },
});

export default CaiDat;