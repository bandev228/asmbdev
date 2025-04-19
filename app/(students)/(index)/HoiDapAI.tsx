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
import { useAIContext } from './hooks/useAIContext';

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

  // Sử dụng hook useAIContext
  const { generatePrompt, config } = useAIContext();

  // Khởi tạo Gemini API với cấu hình từ hook
  const genAI = new GoogleGenerativeAI('AIzaSyBTYV6dmJzpxINv80vnXQcC8mQXDNTWQ7Y');
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: config.temperature,
      topK: config.topK,
      topP: config.topP,
      maxOutputTokens: config.maxTokens,
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
      // console.log("No user ID found");
      return;
    }

    // console.log("Loading chat sessions for user:", userId);
    setIsLoadingHistory(true);
    setHistoryError(null);

    // Load chat sessions
    const sessionsQuery = query(
      collection(db, `users/${userId}/chat_sessions`),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeSessions = onSnapshot(sessionsQuery, 
      (snapshot) => {
        // console.log("Chat sessions snapshot:", snapshot.docs.length);
        
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
        // console.log("No user ID found when loading chat session");
        return;
      }

      // console.log("Loading chat session:", sessionId);
      const messagesQuery = query(
        collection(db, `users/${userId}/chat_sessions/${sessionId}/messages`),
        orderBy('timestamp', 'asc')
      );

      const messagesSnapshot = await getDocs(messagesQuery);
      // console.log("Messages loaded:", messagesSnapshot.docs.length);
      
      const loadedMessages = messagesSnapshot.docs.map(doc => {
        const data = doc.data();
        // console.log("Message data:", data);
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
        const sessionData = {
          title: inputText.substring(0, 30) + (inputText.length > 30 ? '...' : ''),
          lastMessage: inputText,
          timestamp: new Date(),
          userId: userId
        };
        
        const sessionRef = await addDoc(collection(db, `users/${userId}/chat_sessions`), sessionData);
        sessionId = sessionRef.id;
        setCurrentSessionId(sessionId);
      }

      await addDoc(collection(db, `users/${userId}/chat_sessions/${sessionId}/messages`), userMessage);

      // Sử dụng generatePrompt từ hook
      const contextualPrompt = generatePrompt(inputText);
      
      const result = await model.generateContent(contextualPrompt);
      const response = await result.response;
      const aiText = cleanAIResponse(response.text());

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: aiText,
        sender: 'ai',
        timestamp: new Date()
      };

      await addDoc(collection(db, `users/${userId}/chat_sessions/${sessionId}/messages`), aiResponse);

      const sessionRef = doc(db, `users/${userId}/chat_sessions/${sessionId}`);
      await updateDoc(sessionRef, {
        lastMessage: aiText,
        timestamp: new Date()
      });

      setIsLoading(false);

    } catch (error) {
      console.error("Error in AI response:", error);
      Alert.alert(
        "Lỗi", 
        "Không thể nhận được câu trả lời. Vui lòng thử lại sau hoặc liên hệ hỗ trợ nếu lỗi vẫn tiếp tục."
      );
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
        <View style={styles.messageHeader}>
          {message.sender === 'ai' && (
            <View style={styles.aiAvatar}>
              <Ionicons name="logo-android" size={20} color="#4CAF50" />
            </View>
          )}
        </View>
        <Text style={[
          styles.messageText,
          message.sender === 'user' ? styles.userMessageText : styles.aiMessageText
        ]}>
          {message.text}
        </Text>
        <Text style={[
          styles.timestamp,
          message.sender === 'user' ? styles.userTimestamp : styles.aiTimestamp
        ]}>
          {message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );

  const renderChatSession = ({ item }: { item: ChatSession }) => {
    const formattedDate = format(item.timestamp, "HH:mm - dd/MM/yyyy", { locale: vi });
    return (
      <TouchableOpacity
        style={[
          styles.sessionItem,
          currentSessionId === item.id && styles.activeSessionItem
        ]}
        onPress={() => {
          loadChatSession(item.id);
          setShowHistory(false);
        }}
      >
        <View style={styles.sessionIconContainer}>
          <Ionicons 
            name="chatbubble-ellipses" 
            size={24} 
            color={currentSessionId === item.id ? "#007AFF" : "#666"} 
          />
        </View>
        <View style={styles.sessionContent}>
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.sessionDate}>{formattedDate}</Text>
          </View>
          <Text style={styles.sessionLastMessage} numberOfLines={2}>
            {item.lastMessage}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHistoryContent = () => {
    if (isLoadingHistory) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Đang tải lịch sử...</Text>
        </View>
      );
    }

    return (
      <View style={styles.historyContainer}>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={() => {
            startNewChat();
            setShowHistory(false);
          }}
        >
          <Ionicons name="add-circle" size={24} color="#007AFF" />
          <Text style={styles.newChatText}>Bắt đầu cuộc trò chuyện mới</Text>
        </TouchableOpacity>

        {chatSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color="#999" />
            <Text style={styles.emptyStateTitle}>Chưa có cuộc trò chuyện nào</Text>
            <Text style={styles.emptyStateText}>
              Bắt đầu cuộc trò chuyện mới để lưu trữ lịch sử chat của bạn
            </Text>
          </View>
        ) : (
          <FlatList
            data={chatSessions}
            renderItem={renderChatSession}
            keyExtractor={item => item.id}
            style={styles.sessionsList}
            contentContainerStyle={styles.sessionsListContent}
            ItemSeparatorComponent={() => <View style={styles.sessionSeparator} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Hỏi đáp với AI</Text>
        <TouchableOpacity 
          onPress={() => setShowHistory(true)} 
          style={styles.historyButton}
        >
          <View style={styles.historyButtonContent}>
            <Ionicons name="time" size={24} color="#007AFF" />
            {chatSessions.length > 0 && (
              <View style={styles.historyBadge}>
                <Text style={styles.historyBadgeText}>{chatSessions.length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <View style={styles.welcomeContainer}>
            <View style={styles.aiWelcomeAvatar}>
              <Ionicons name="logo-android" size={40} color="#4CAF50" />
            </View>
            <Text style={styles.welcomeTitle}>Xin chào! Tôi có thể giúp gì cho bạn?</Text>
            <Text style={styles.welcomeText}>Hãy đặt câu hỏi, tôi sẽ cố gắng trả lời chi tiết nhất có thể.</Text>
          </View>
        ) : (
          messages.map(renderMessage)
        )}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingContent}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loadingText}>AI đang trả lời...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.inputContainer}
      >
        <TextInput
          style={styles.input}
          placeholder="Nhập câu hỏi của bạn..."
          placeholderTextColor="#999"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !inputText.trim() && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || isLoading}
        >
          <Ionicons
            name={isLoading ? "time" : "send"}
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
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: screenWidth * 0.04,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
  historyButtonContent: {
    position: 'relative',
  },
  historyBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: screenWidth * 0.04,
    paddingBottom: screenHeight * 0.02,
  },
  welcomeContainer: {
    alignItems: 'center',
    padding: screenWidth * 0.06,
    marginTop: screenHeight * 0.1,
  },
  aiWelcomeAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: screenWidth * 0.04,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  messageContainer: {
    maxWidth: '85%',
    marginBottom: screenHeight * 0.02,
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  aiMessage: {
    alignSelf: 'flex-start',
  },
  messageContent: {
    borderRadius: 16,
    padding: screenWidth * 0.04,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageText: {
    fontSize: screenWidth * 0.038,
    lineHeight: screenWidth * 0.052,
  },
  userMessageText: {
    color: '#FFFFFF',
    backgroundColor: '#007AFF',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    padding: screenWidth * 0.04,
  },
  aiMessageText: {
    color: '#333333',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: screenWidth * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  timestamp: {
    fontSize: screenWidth * 0.03,
    marginTop: 4,
  },
  userTimestamp: {
    color: '#rgba(255, 255, 255, 0.7)',
    alignSelf: 'flex-end',
  },
  aiTimestamp: {
    color: '#999',
    alignSelf: 'flex-start',
  },
  loadingContainer: {
    alignItems: 'flex-start',
    marginBottom: screenHeight * 0.02,
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    padding: screenWidth * 0.03,
    borderRadius: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: screenWidth * 0.035,
    color: '#666',
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
    paddingVertical: screenWidth * 0.03,
    fontSize: screenWidth * 0.038,
    maxHeight: 120,
    color: '#333',
  },
  sendButton: {
    marginLeft: screenWidth * 0.03,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
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
    height: screenHeight * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: screenWidth * 0.04,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: screenWidth * 0.02,
  },
  historyContainer: {
    flex: 1,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    margin: screenWidth * 0.04,
    padding: screenWidth * 0.04,
    borderRadius: 12,
  },
  newChatText: {
    marginLeft: screenWidth * 0.02,
    fontSize: screenWidth * 0.04,
    color: '#007AFF',
    fontWeight: '600',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: screenWidth * 0.04,
    backgroundColor: '#FFFFFF',
  },
  activeSessionItem: {
    backgroundColor: '#F0F7FF',
  },
  sessionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: screenWidth * 0.03,
  },
  sessionContent: {
    flex: 1,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionTitle: {
    flex: 1,
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
    color: '#333',
    marginRight: screenWidth * 0.02,
  },
  sessionDate: {
    fontSize: screenWidth * 0.03,
    color: '#999',
  },
  sessionLastMessage: {
    fontSize: screenWidth * 0.035,
    color: '#666',
    lineHeight: 20,
  },
  sessionSeparator: {
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  sessionsList: {
    flex: 1,
  },
  sessionsListContent: {
    paddingBottom: screenWidth * 0.04,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: screenWidth * 0.06,
  },
  emptyStateTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    color: '#333',
    marginTop: screenHeight * 0.02,
    marginBottom: screenHeight * 0.01,
  },
  emptyStateText: {
    fontSize: screenWidth * 0.035,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: screenWidth * 0.1,
  },
});

export default HoiDapAI;