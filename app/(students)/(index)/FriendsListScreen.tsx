import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFriends, Friend } from './hooks/useFriends';
import { useStudentProfile } from './hooks/useStudentProfile';
import { useSuggestedFriends, SuggestedFriend } from './hooks/useSuggestedFriends';
import { router } from 'expo-router';

type ListItem = Friend | SuggestedFriend;

const FriendsListScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'suggested'>('friends');
  const { friends, friendRequests, loading, error, acceptFriendRequest, rejectFriendRequest, sendFriendRequest } = useFriends();
  const { suggestedFriends, loading: suggestedLoading, error: suggestedError, refreshSuggestedFriends } = useSuggestedFriends();
  const { profile } = useStudentProfile();

  const filteredFriends = friends.filter((friend) =>
    friend.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderFriendItem = ({ item }: { item: Friend }) => (
    <TouchableOpacity
      style={styles.friendItem}
      onPress={() => router.push(`/(students)/(index)/ChatScreen?friendId=${item.uid}&friendName=${item.displayName}&friendPhotoURL=${item.photoURL}`)}
    >
      <Image
        source={{ uri: item.photoURL || 'https://via.placeholder.com/50' }}
        style={styles.avatar}
      />
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.displayName}</Text>
        <Text style={styles.studentId}>{item.studentId}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#999" />
    </TouchableOpacity>
  );

  const renderRequestItem = ({ item }: { item: Friend }) => (
    <View style={styles.requestItem}>
      <Image
        source={{ uri: item.photoURL || 'https://via.placeholder.com/50' }}
        style={styles.avatar}
      />
      <View style={styles.requestInfo}>
        <Text style={styles.friendName}>{item.displayName}</Text>
        <Text style={styles.studentId}>{item.studentId}</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => acceptFriendRequest(item.uid)}
        >
          <Ionicons name="checkmark" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => rejectFriendRequest(item.uid)}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSuggestedItem = ({ item }: { item: SuggestedFriend }) => (
    <View style={styles.suggestedItem}>
      <Image
        source={{ uri: item.photoURL || 'https://via.placeholder.com/50' }}
        style={styles.avatar}
      />
      <View style={styles.suggestedInfo}>
        <Text style={styles.friendName}>{item.displayName}</Text>
        <Text style={styles.studentId}>{item.studentId}</Text>
        <Text style={styles.faculty}>{item.faculty || 'Chưa cập nhật'} - {item.class || 'Chưa cập nhật'}</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => sendFriendRequest(item.uid)}
      >
        <Ionicons name="person-add" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: { item: ListItem }) => {
    if (activeTab === 'friends') {
      return renderFriendItem({ item: item as Friend });
    } else if (activeTab === 'requests') {
      return renderRequestItem({ item: item as Friend });
    } else {
      return renderSuggestedItem({ item: item as SuggestedFriend });
    }
  };

  const getData = () => {
    switch (activeTab) {
      case 'friends':
        return filteredFriends.filter(friend => friend && friend.uid);
      case 'requests':
        return friendRequests.filter(request => request && request.uid);
      case 'suggested':
        return suggestedFriends.filter(suggested => suggested && suggested.uid);
      default:
        return [];
    }
  };

  const getKeyExtractor = (item: ListItem) => {
    const itemId = item.uid || Math.random().toString();
    return `${activeTab}-${itemId}`;
  };

  if (loading || suggestedLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || suggestedError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || suggestedError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bạn bè</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm bạn bè..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
            Bạn bè ({friends.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
            Lời mời ({friendRequests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'suggested' && styles.activeTab]}
          onPress={() => setActiveTab('suggested')}
        >
          <Text style={[styles.tabText, activeTab === 'suggested' && styles.activeTabText]}>
            Gợi ý ({suggestedFriends.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={getData()}
        renderItem={renderItem}
        keyExtractor={getKeyExtractor}
        contentContainerStyle={styles.listContainer}
        onRefresh={activeTab === 'suggested' ? refreshSuggestedFriends : undefined}
        refreshing={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
  },
  header: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 10,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  suggestedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  friendInfo: {
    flex: 1,
  },
  requestInfo: {
    flex: 1,
  },
  suggestedInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  studentId: {
    fontSize: 14,
    color: '#666',
  },
  faculty: {
    fontSize: 12,
    color: '#999',
  },
  requestActions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default FriendsListScreen; 