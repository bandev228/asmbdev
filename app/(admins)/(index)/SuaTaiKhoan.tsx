import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

interface AccountData {
  fullname?: string;
  email?: string;
  role?: string;
}

type RouteParams = {
  accountId: string;
}

const SuaThongTinTaiKhoan = () => {
  const router = useRouter();
  const { accountId } = useLocalSearchParams<RouteParams>();
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) {
      Alert.alert('Lỗi', 'Không tìm thấy ID tài khoản');
      router.back();
      return;
    }
    fetchAccountDetails();
  }, [accountId]);

  const fetchAccountDetails = async () => {
    try {
      const accountDoc = await firestore().collection('users').doc(accountId).get();
      if (accountDoc.exists) {
        const accountData = accountDoc.data() as AccountData;
        setFullname(accountData.fullname || '');
        setEmail(accountData.email || '');
        setRole(accountData.role || '');
      } else {
        Alert.alert('Lỗi', 'Không tìm thấy tài khoản');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching account details:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin tài khoản');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAccount = async () => {
    if (!accountId) return;
    
    try {
      const updateData: AccountData = {
        fullname,
        email,
        role,
      };
      
      await firestore().collection('users').doc(accountId).update(updateData);
      Alert.alert('Thành công', 'Thông tin tài khoản đã được cập nhật');
      router.back();
    } catch (error) {
      console.error('Error updating account:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật thông tin tài khoản. Vui lòng thử lại.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chỉnh sửa tài khoản</Text>
      </View>
      <ScrollView style={styles.content}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Họ và tên</Text>
          <TextInput
            style={styles.input}
            value={fullname}
            onChangeText={setFullname}
            placeholder="Nhập họ và tên"
          />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Nhập email"
            keyboardType="email-address"
          />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Vai trò</Text>
          <TextInput
            style={styles.input}
            value={role}
            onChangeText={setRole}
            placeholder="Nhập vai trò"
          />
        </View>
        <TouchableOpacity style={styles.updateButton} onPress={handleUpdateAccount}>
          <Text style={styles.updateButtonText}>Cập nhật tài khoản</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#3498db',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  updateButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SuaThongTinTaiKhoan;
