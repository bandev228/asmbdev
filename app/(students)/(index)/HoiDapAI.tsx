import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Modal,
  FlatList,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, getDocs, where, doc, updateDoc, limit } from '@react-native-firebase/firestore';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messages: Message[];
}

const HoiDapAI = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();
  const auth = getAuth();
  const db = getFirestore();

  // Khởi tạo Gemini API với cấu hình tối ưu
  const genAI = new GoogleGenerativeAI('AIzaSyBTYV6dmJzpxINv80vnXQcC8mQXDNTWQ7Y');
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0.9,
      topK: 1,
      topP: 0.8,
      maxOutputTokens: 2048,
    },
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ],
  });

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log("No user ID found");
      return;
    }

    console.log("Loading chat sessions for user:", userId);
    setIsLoadingHistory(true);
    setHistoryError(null);

    // Load chat sessions
    const sessionsQuery = query(
      collection(db, `users/${userId}/chat_sessions`),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeSessions = onSnapshot(sessionsQuery, 
      (snapshot) => {
        console.log("Chat sessions snapshot:", snapshot.docs.length);
        
        const sessions = snapshot.docs.map(doc => {
          const data = doc.data();
          // console.log("Session data:", data);
          
          return {
            id: doc.id,
            title: data.title || 'Cuộc trò chuyện mới',
            lastMessage: data.lastMessage || '',
            timestamp: data.timestamp?.toDate() || new Date(),
            messages: []
          } as ChatSession;
        });
        
        // console.log("Processed sessions:", sessions);
        setChatSessions(sessions);
        setIsLoadingHistory(false);
      },
      (error) => {
        console.error("Error loading chat sessions:", error);
        setHistoryError("Không thể tải lịch sử trò chuyện. Vui lòng thử lại.");
        setIsLoadingHistory(false);
      }
    );

    return () => unsubscribeSessions();
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const messagesQuery = query(
        collection(db, `users/${userId}/chat_sessions/${currentSessionId}/messages`),
        orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        const newMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate()
        })) as Message[];
        setMessages(newMessages);
      });

      return () => unsubscribe();
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  // Hàm xử lý văn bản từ AI
  const cleanAIResponse = (text: string): string => {
    // Chỉ loại bỏ các ký tự đặc biệt không cần thiết
    return text
      .replace(/\*\*/g, '') // Loại bỏ **
      .replace(/\*/g, '')   // Loại bỏ *
      .trim();              // Loại bỏ khoảng trắng thừa
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setInputText('');
  };

  const loadChatSession = async (sessionId: string) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log("No user ID found when loading chat session");
        return;
      }

      console.log("Loading chat session:", sessionId);
      const messagesQuery = query(
        collection(db, `users/${userId}/chat_sessions/${sessionId}/messages`),
        orderBy('timestamp', 'asc')
      );

      const messagesSnapshot = await getDocs(messagesQuery);
      console.log("Messages loaded:", messagesSnapshot.docs.length);
      
      const loadedMessages = messagesSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log("Message data:", data);
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate()
        } as Message;
      });

      setMessages(loadedMessages);
      setCurrentSessionId(sessionId);
      setShowHistory(false);
    } catch (error) {
      console.error("Error loading chat session:", error);
      Alert.alert("Lỗi", "Không thể tải cuộc trò chuyện. Vui lòng thử lại.");
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log("No user ID found when sending message");
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    };

    try {
      setIsLoading(true);
      setInputText('');

      let sessionId = currentSessionId;
      if (!sessionId) {
        console.log("Creating new chat session");
        // Tạo session mới
        const sessionData = {
          title: inputText.substring(0, 30) + (inputText.length > 30 ? '...' : ''),
          lastMessage: inputText,
          timestamp: new Date(),
          userId: userId // Thêm userId vào session data
        };
        
        const sessionRef = await addDoc(collection(db, `users/${userId}/chat_sessions`), sessionData);
        sessionId = sessionRef.id;
        console.log("New session created with ID:", sessionId);
        setCurrentSessionId(sessionId);
      }

      // Lưu tin nhắn người dùng
      console.log("Saving user message to session:", sessionId);
      await addDoc(collection(db, `users/${userId}/chat_sessions/${sessionId}/messages`), userMessage);

      // Gọi API Gemini
      const prompt = `Bạn là một trợ lý AI thân thiện và hữu ích. Hãy trả lời câu hỏi sau một cách tự nhiên và chi tiết: ${inputText}`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const aiText = cleanAIResponse(response.text());

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: aiText,
        sender: 'ai',
        timestamp: new Date()
      };

      // Lưu phản hồi của AI
      console.log("Saving AI response to session:", sessionId);
      await addDoc(collection(db, `users/${userId}/chat_sessions/${sessionId}/messages`), aiResponse);

      // Cập nhật session
      const sessionRef = doc(db, `users/${userId}/chat_sessions/${sessionId}`);
      await updateDoc(sessionRef, {
        lastMessage: aiText,
        timestamp: new Date()
      });

      console.log("Session updated successfully");
      setIsLoading(false);

    } catch (error) {
      console.error("Error in AI response:", error);
      Alert.alert("Lỗi", "Không thể gửi tin nhắn. Vui lòng thử lại.");
      setIsLoading(false);
    }
  };

  const renderMessage = (message: Message) => (
    <View
      key={message.id}
      style={[
        styles.messageContainer,
        message.sender === 'user' ? styles.userMessage : styles.aiMessage
      ]}
    >
      <View style={styles.messageContent}>
        <Text style={styles.messageText}>{message.text}</Text>
        <Text style={styles.timestamp}>
          {message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );

  const renderChatSession = ({ item }: { item: ChatSession }) => (
    <TouchableOpacity
      style={styles.sessionItem}
      onPress={() => loadChatSession(item.id)}
    >
      <View style={styles.sessionContent}>
        <Text style={styles.sessionTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.sessionLastMessage} numberOfLines={1}>{item.lastMessage}</Text>
        <Text style={styles.sessionTime}>
          {format(item.timestamp, "HH:mm dd/MM/yyyy", { locale: vi })}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#666" />
    </TouchableOpacity>
  );

  const renderHistoryContent = () => {
    if (isLoadingHistory) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Đang tải lịch sử...</Text>
        </View>
      );
    }

    if (historyError) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
          <Text style={styles.errorText}>{historyError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setHistoryError(null);
              // Reload history
              const userId = auth.currentUser?.uid;
              if (userId) {
                const sessionsQuery = query(
                  collection(db, `users/${userId}/chat_sessions`),
                  orderBy('timestamp', 'desc')
                );
                getDocs(sessionsQuery).then(snapshot => {
                  const sessions = snapshot.docs.map(doc => ({
                    id: doc.id,
                    title: doc.data().title || 'Cuộc trò chuyện mới',
                    lastMessage: doc.data().lastMessage || '',
                    timestamp: doc.data().timestamp?.toDate() || new Date(),
                    messages: []
                  }));
                  setChatSessions(sessions);
                }).catch(error => {
                  setHistoryError("Không thể tải lịch sử trò chuyện. Vui lòng thử lại.");
                });
              }
            }}
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (chatSessions.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubble-outline" size={48} color="#999" />
          <Text style={styles.emptyStateText}>Chưa có cuộc trò chuyện nào</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={chatSessions}
        renderItem={renderChatSession}
        keyExtractor={item => item.id}
        style={styles.sessionsList}
        contentContainerStyle={styles.sessionsListContent}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Hỏi đáp với AI</Text>
        <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.historyButton}>
          <Ionicons name="time-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(renderMessage)}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingText}>AI đang trả lời...</Text>
          </View>
        )}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <TextInput
          style={styles.input}
          placeholder="Nhập câu hỏi của bạn..."
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || isLoading}
        >
          <Ionicons
            name={isLoading ? "time-outline" : "send"}
            size={24}
            color={!inputText.trim() || isLoading ? "#999" : "#007AFF"}
          />
        </TouchableOpacity>
      </KeyboardAvoidingView>

      <Modal
        visible={showHistory}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lịch sử trò chuyện</Text>
              <TouchableOpacity 
                onPress={() => setShowHistory(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.newChatButton}
              onPress={() => {
                startNewChat();
                setShowHistory(false);
              }}
            >
              <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
              <Text style={styles.newChatText}>Cuộc trò chuyện mới</Text>
            </TouchableOpacity>

            {renderHistoryContent()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: screenWidth * 0.04,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: screenWidth * 0.02,
  },
  title: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  historyButton: {
    padding: screenWidth * 0.02,
  },
  messagesContainer: {
    flex: 1,
    padding: screenWidth * 0.04,
  },
  messageContainer: {
    maxWidth: '80%',
    marginBottom: screenHeight * 0.02,
    borderRadius: 12,
    padding: screenWidth * 0.04,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  messageContent: {
    flexDirection: 'column',
  },
  messageText: {
    fontSize: screenWidth * 0.035,
    color: '#333333',
    marginBottom: screenHeight * 0.01,
  },
  timestamp: {
    fontSize: screenWidth * 0.025,
    color: '#666666',
    alignSelf: 'flex-end',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: screenWidth * 0.1,
  },
  loadingText: {
    fontSize: screenWidth * 0.04,
    color: '#666666',
    marginTop: screenHeight * 0.02,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: screenWidth * 0.04,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenWidth * 0.02,
    maxHeight: 100,
    fontSize: screenWidth * 0.035,
  },
  sendButton: {
    marginLeft: screenWidth * 0.02,
    padding: screenWidth * 0.02,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: screenWidth * 0.04,
    maxHeight: screenHeight * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: screenHeight * 0.02,
  },
  modalTitle: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    color: '#333333',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: screenWidth * 0.04,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: screenHeight * 0.02,
  },
  newChatText: {
    fontSize: screenWidth * 0.04,
    color: '#007AFF',
    marginLeft: screenWidth * 0.02,
  },
  sessionsList: {
    flex: 1,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: screenWidth * 0.04,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sessionContent: {
    flex: 1,
    marginRight: screenWidth * 0.02,
  },
  sessionTitle: {
    fontSize: screenWidth * 0.04,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: screenHeight * 0.005,
  },
  sessionLastMessage: {
    fontSize: screenWidth * 0.035,
    color: '#666666',
    marginBottom: screenHeight * 0.005,
  },
  sessionTime: {
    fontSize: screenWidth * 0.03,
    color: '#999999',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: screenWidth * 0.1,
  },
  errorText: {
    fontSize: screenWidth * 0.04,
    color: '#FF3B30',
    marginTop: screenHeight * 0.02,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: screenHeight * 0.02,
    padding: screenWidth * 0.04,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: screenWidth * 0.04,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: screenWidth * 0.04,
    color: '#999',
    marginTop: screenHeight * 0.02,
  },
  closeButton: {
    padding: screenWidth * 0.02,
  },
  sessionsListContent: {
    padding: screenWidth * 0.04,
  },
});

export default HoiDapAI;