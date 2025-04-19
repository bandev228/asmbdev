import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, SafeAreaView, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc, query, where } from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import type { Route } from 'expo-router';

interface Account {
  id: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'manager' | 'student';
  [key: string]: any;
}

const QuanLyTK = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'all' | 'admin' | 'manager' | 'student'>('all');
  const router = useRouter();
  const db = getFirestore();

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    filterAccounts();
  }, [searchQuery, accounts, selectedRole]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const accountList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Account[];
      setAccounts(accountList);
      setFilteredAccounts(accountList);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  };

  const filterAccounts = () => {
    let filtered = [...accounts];
    
    if (selectedRole !== 'all') {
      filtered = filtered.filter(account => account.role === selectedRole);
    }
    
    filtered = filtered.filter(account => 
      account.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (account.displayName && account.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    
    setFilteredAccounts(filtered);
  };

  const deleteAccount = async (accountId: string) => {
    Alert.alert(
      "Xác nhận xóa",
      "Bạn có chắc chắn muốn xóa tài khoản này?",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Xóa", 
          onPress: async () => {
            try {
              const userRef = doc(db, 'users', accountId);
              await deleteDoc(userRef);
              Alert.alert('Thành công', 'Tài khoản đã được xóa');
              fetchAccounts();
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Lỗi', 'Không thể xóa tài khoản');
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const updateRole = async (accountId: string, newRole: 'admin' | 'manager' | 'student') => {
    try {
      const userRef = doc(db, 'users', accountId);
      await updateDoc(userRef, { role: newRole });
      Alert.alert('Thành công', 'Vai trò tài khoản đã được cập nhật');
      fetchAccounts();
      setModalVisible(false);
    } catch (error) {
      console.error('Error updating account role:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật vai trò tài khoản');
    }
  };

  const renderAccountItem = ({ item }: { item: Account }) => (
    <TouchableOpacity 
      style={styles.accountItem}
      onPress={() => {
        setSelectedAccount(item);
        setModalVisible(true);
      }}
    >
      <View style={styles.accountInfo}>
        <Text style={styles.accountName}>{item.displayName || 'Không có tên'}</Text>
        <Text style={styles.accountEmail}>{item.email}</Text>
        <Text style={styles.accountRole}>Vai trò: {item.role}</Text>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity onPress={() => router.push({
          pathname: './SuaTaiKhoan',
          params: { accountId: item.id }
        })}>
          <Ionicons name="create-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Ionicons name="chevron-forward-outline" size={24} color="#007AFF" />
      </View>
    </TouchableOpacity>
  );

  const handleModalActions = () => {
    if (!selectedAccount) return null;

    return (
      <View style={styles.modalButtons}>
        <TouchableOpacity 
          style={[styles.modalButton, styles.updateButton]} 
          onPress={() => updateRole(selectedAccount.id, 'student')}
        >
          <Text style={styles.buttonText}>Đặt làm Sinh viên</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.modalButton, styles.updateButton]} 
          onPress={() => updateRole(selectedAccount.id, 'manager')}
        >
          <Text style={styles.buttonText}>Đặt làm Quản lý</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.modalButton, styles.updateButton]} 
          onPress={() => updateRole(selectedAccount.id, 'admin')}
        >
          <Text style={styles.buttonText}>Đặt làm Admin</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.modalButton, styles.deleteButton]} 
          onPress={() => {
            setModalVisible(false);
            deleteAccount(selectedAccount.id);
          }}
        >
          <Text style={styles.buttonText}>Xóa tài khoản</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderAccountModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Quản lý tài khoản</Text>
          <Text style={styles.modalText}>Tên: {selectedAccount?.displayName || 'Không có tên'}</Text>
          <Text style={styles.modalText}>Email: {selectedAccount?.email}</Text>
          <Text style={styles.modalText}>Vai trò hiện tại: {selectedAccount?.role}</Text>
          {handleModalActions()}
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.closeButtonText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderRoleFilter = () => (
    <View style={styles.roleFilterContainer}>
      {['all', 'admin', 'manager', 'student'].map((role) => (
        <TouchableOpacity
          key={role}
          style={[
            styles.roleFilterButton,
            selectedRole === role && styles.roleFilterButtonActive
          ]}
          onPress={() => setSelectedRole(role as 'all' | 'admin' | 'manager' | 'student')}
        >
          <Text style={[
            styles.roleFilterText,
            selectedRole === role && styles.roleFilterTextActive
          ]}>
            {role === 'all' ? 'Tất cả' : role}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Quản lý tài khoản</Text>
        <TouchableOpacity onPress={fetchAccounts} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm tài khoản..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      {renderRoleFilter()}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={filteredAccounts}
          renderItem={renderAccountItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
      {renderAccountModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    margin: 16,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  roleFilterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  roleFilterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  roleFilterButtonActive: {
    backgroundColor: '#007AFF',
  },
  roleFilterText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  roleFilterTextActive: {
    color: '#FFFFFF',
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  accountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  accountEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  accountRole: {
    fontSize: 14,
    color: '#007AFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalText: {
    textAlignVertical: 'center',
    fontSize: 16,
    marginBottom: 8,
  },
  modalButtons: {
    width: '100%',
    marginTop: 16,
  },
  modalButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  updateButton: {
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  closeButton: {
    marginTop: 16,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default QuanLyTK;
