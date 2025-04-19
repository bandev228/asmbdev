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
    const showAvatar = !isMe && item.senderId === friendId;
    const showTime = true; // Always show time for now

    return (
      <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
        {showAvatar && (
          <Image
            source={{ uri: friendPhotoURL || 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
        )}
        <View style={[styles.messageContent, isMe ? styles.myContent : styles.theirContent]}>
          <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
            <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>
              {item.content}
            </Text>
          </View>
          {showTime && (
            <Text style={[styles.timeText, isMe ? styles.myTime : styles.theirTime]}>
              {format(item.timestamp, 'HH:mm', { locale: vi })}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (!friendId || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0084ff" />
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
          <Ionicons name="arrow-back" size={24} color="#0084ff" />
        </TouchableOpacity>
        <Image
          source={{ uri: friendPhotoURL || 'https://via.placeholder.com/40' }}
          style={styles.headerAvatar}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{friendName}</Text>
          <Text style={styles.headerStatus}>Đang hoạt động</Text>
        </View>
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
          <TouchableOpacity style={styles.attachmentButton}>
            <Ionicons name="attach" size={24} color="#0084ff" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="#8e8e93"
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
              color={message.trim() ? '#0084ff' : '#c7c7cc'}
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
    backgroundColor: '#ffffff',
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
    color: '#ff3b30',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  headerStatus: {
    fontSize: 12,
    color: '#8e8e93',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesList: {
    padding: 10,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  theirMessage: {
    justifyContent: 'flex-start',
  },
  messageContent: {
    maxWidth: '70%',
  },
  myContent: {
    alignItems: 'flex-end',
  },
  theirContent: {
    alignItems: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 18,
    maxWidth: '100%',
  },
  myBubble: {
    backgroundColor: '#0084ff',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#e9ecef',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myText: {
    color: '#ffffff',
  },
  theirText: {
    color: '#000000',
  },
  timeText: {
    fontSize: 11,
    marginTop: 4,
  },
  myTime: {
    color: '#8e8e93',
    textAlign: 'right',
  },
  theirTime: {
    color: '#8e8e93',
    textAlign: 'left',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  attachmentButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 8,
    maxHeight: 100,
    fontSize: 16,
    color: '#000000',
  },
  sendButton: {
    padding: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default ChatScreen; 