import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMessages, Message } from './hooks/useMessages';
import { useStudentProfile } from './hooks/useStudentProfile';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { router, useLocalSearchParams } from 'expo-router';

const ChatScreen = () => {
  const { friendId, friendName, friendPhotoURL } = useLocalSearchParams<{
    friendId: string;
    friendName: string;
    friendPhotoURL?: string;
  }>();

  const [message, setMessage] = useState('');
  const { messages, loading, error, sendMessage, markAsRead } = useMessages(friendId || '');
  const { profile } = useStudentProfile();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!friendId) {
      router.back();
      return;
    }
    // Mark messages as read when opening chat
    messages.forEach((msg) => {
      if (!msg.read && msg.senderId === friendId) {
        markAsRead(msg.id);
      }
    });
  }, [messages, friendId]);

  const handleSend = async () => {
    if (message.trim() && friendId) {
      await sendMessage(message.trim());
      setMessage('');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === profile?.uid;
    return (
      <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
        {!isMe && (
          <Image
            source={{ uri: friendPhotoURL || 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
        )}
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
          <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>
            {item.content}
          </Text>
          <Text style={[styles.timeText, isMe ? styles.myTime : styles.theirTime]}>
            {format(item.timestamp, 'HH:mm', { locale: vi })}
          </Text>
        </View>
      </View>
    );
  };

  if (!friendId || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Image
          source={{ uri: friendPhotoURL || 'https://via.placeholder.com/40' }}
          style={styles.headerAvatar}
        />
        <Text style={styles.headerName}>{friendName}</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="Nhập tin nhắn..."
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!message.trim()}
          >
            <Ionicons
              name="send"
              size={24}
              color={message.trim() ? '#007AFF' : '#999'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 5,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  headerName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesList: {
    padding: 10,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 5,
    alignItems: 'flex-end',
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  theirMessage: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  messageBubble: {
    maxWidth: '70%',
    padding: 10,
    borderRadius: 15,
  },
  myBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 5,
  },
  theirBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
  },
  myText: {
    color: '#FFFFFF',
  },
  theirText: {
    color: '#000000',
  },
  timeText: {
    fontSize: 12,
    marginTop: 5,
  },
  myTime: {
    color: '#FFFFFF',
    textAlign: 'right',
  },
  theirTime: {
    color: '#999',
    textAlign: 'left',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default ChatScreen; 