import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getDatabase, ref, update } from '@react-native-firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

interface SettingsState {
  notifications: boolean;
  activityReminders: boolean;
  feedbackNotifications: boolean;
  darkMode: boolean;
  language: 'vi' | 'en';
}

const CaiDat = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsState>({
    notifications: true,
    activityReminders: true,
    feedbackNotifications: true,
    darkMode: false,
    language: 'vi',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('user_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<SettingsState>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      await AsyncStorage.setItem('user_settings', JSON.stringify(updatedSettings));
      setSettings(updatedSettings);

      // Update notification settings in database
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        const database = getDatabase();
        await update(ref(database, `users/${user.uid}/settings`), newSettings);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Lỗi', 'Không thể lưu cài đặt. Vui lòng thử lại sau.');
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Cần quyền truy cập',
          'Vui lòng cấp quyền thông báo trong cài đặt thiết bị để nhận thông báo.',
          [
            { text: 'Để sau' },
            { 
              text: 'Mở cài đặt',
              onPress: () => Linking.openSettings()
            }
          ]
        );
        return;
      }
    }
    saveSettings({ notifications: value });
  };

  const handleLogout = async () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(getAuth());
              router.replace('/login');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Lỗi', 'Không thể đăng xuất. Vui lòng thử lại sau.');
            }
          },
        },
      ]
    );
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    value: boolean,
    onToggle: (value: boolean) => void,
    description?: string
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingContent}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon as any} size={24} color="#007AFF" />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {description && (
            <Text style={styles.settingDescription}>{description}</Text>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#D1D1D6', true: '#34C759' }}
        thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : value ? '#FFFFFF' : '#F4F4F4'}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cài đặt</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông báo</Text>
          {renderSettingItem(
            'notifications-outline',
            'Thông báo',
            settings.notifications,
            handleNotificationToggle,
            'Nhận thông báo về hoạt động và cập nhật'
          )}
          {renderSettingItem(
            'calendar-outline',
            'Nhắc nhở hoạt động',
            settings.activityReminders,
            (value) => saveSettings({ activityReminders: value }),
            'Nhận thông báo trước khi hoạt động diễn ra'
          )}
          {renderSettingItem(
            'chatbubble-outline',
            'Thông báo phản hồi',
            settings.feedbackNotifications,
            (value) => saveSettings({ feedbackNotifications: value }),
            'Nhận thông báo khi có phản hồi mới'
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Giao diện</Text>
          {renderSettingItem(
            'moon-outline',
            'Chế độ tối',
            settings.darkMode,
            (value) => saveSettings({ darkMode: value }),
            'Thay đổi giao diện sang tông màu tối'
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ngôn ngữ</Text>
          <TouchableOpacity
            style={styles.languageSelector}
            onPress={() => saveSettings({ language: settings.language === 'vi' ? 'en' : 'vi' })}
          >
            <View style={styles.settingContent}>
              <View style={styles.settingIcon}>
                <Ionicons name="language-outline" size={24} color="#007AFF" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>
                  {settings.language === 'vi' ? 'Tiếng Việt' : 'English'}
                </Text>
                <Text style={styles.settingDescription}>
                  Nhấn để thay đổi ngôn ngữ
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F0F0F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666666',
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  }
});

export default CaiDat;