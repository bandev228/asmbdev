import { useState, useEffect } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, setDoc } from '@react-native-firebase/firestore';
import { useNetInfo } from '@react-native-community/netinfo';

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

export function useMessages(friendId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const auth = getAuth();
  const db = getFirestore();
  const netInfo = useNetInfo();

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser || !friendId) return;

    // Create a conversation ID that is consistent regardless of the order of participants
    const conversationId = [currentUser.uid, friendId].sort().join('_');

    const messagesQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const newMessages = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date(),
          } as Message;
        });

        setMessages(newMessages);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching messages:', err);
        setError('Không thể tải tin nhắn');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [friendId, netInfo.isConnected]);

  const sendMessage = async (content: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');

      // Create a conversation ID that is consistent regardless of the order of participants
      const conversationId = [currentUser.uid, friendId].sort().join('_');

      // Create or update conversation document
      const conversationRef = doc(db, 'conversations', conversationId);
      await setDoc(conversationRef, {
        participants: [currentUser.uid, friendId],
        lastMessage: content,
        lastMessageTime: serverTimestamp(),
        unreadCount: increment(1),
      }, { merge: true });

      // Add message to messages collection
      const messageData = {
        senderId: currentUser.uid,
        receiverId: friendId,
        content,
        timestamp: serverTimestamp(),
        read: false,
        conversationId,
      };

      await addDoc(collection(db, 'messages'), messageData);

      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Không thể gửi tin nhắn');
      return false;
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');

      const messageRef = doc(db, 'messages', messageId);
      await updateDoc(messageRef, {
        read: true,
      });

      // Update unread count in conversation
      const conversationId = [currentUser.uid, friendId].sort().join('_');
      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        unreadCount: 0,
      });

      return true;
    } catch (err) {
      console.error('Error marking message as read:', err);
      return false;
    }
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
  };
}

export default useMessages;