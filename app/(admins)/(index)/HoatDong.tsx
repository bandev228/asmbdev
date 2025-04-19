import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  StatusBar,
  Image,
  Dimensions,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useActivities, Activity } from './hooks/useActivities';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc, updateDoc } from '@react-native-firebase/firestore';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

const HoatDong = () => {
  const router = useRouter();
  const { theme, isDarkMode } = useTheme();
  const { activities, loading, error, refetch } = useActivities();
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    try {
      return date.toDate().toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const formatTime = (date: any) => {
    if (!date) return 'N/A';
    try {
      return date.toDate().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const handleEditActivity = (activityId: string) => {
    setModalVisible(false);
    router.push({
      pathname: "./ChinhSuaHD",
      params: { id: activityId }
    });
  };

  const renderActivityItem = ({ item }: { item: Activity }) => (
    <TouchableOpacity
      style={styles.activityCard}
      onPress={() => {
        setSelectedActivity(item);
        setModalVisible(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.activityImageContainer}>
        {item.bannerImageUrl ? (
          <Image source={{ uri: item.bannerImageUrl }} style={styles.activityImage} />
        ) : (
          <View style={styles.activityImagePlaceholder}>
            <Ionicons name="image-outline" size={40} color="#cbd5e1" />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.imageGradient}
        />
        <View style={styles.activityStatus}>
          <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.statusText}>Đang diễn ra</Text>
        </View>
      </View>

      <View style={styles.activityContent}>
        <Text style={styles.activityTitle} numberOfLines={2}>
          {item.name}
        </Text>
        
        <View style={styles.activityMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.metaText}>{formatDate(item.startDate)} - {formatDate(item.endDate)}</Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.metaText}>
              {formatTime(item.startDate)} - {formatTime(item.endDate)}
            </Text>
          </View>
          
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.location}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.metaText}>
              {(item.participants?.length || 0) + (item.pendingParticipants?.length || 0)} người tham gia
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.metaText}>
              {item.creatorDisplayName}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Đã có lỗi xảy ra</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refetch}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      <LinearGradient
        colors={["#3b82f6", "#2563eb"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Hoạt động đang diễn ra</Text>
          <TouchableOpacity onPress={refetch} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={activities}
        renderItem={renderActivityItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} colors={["#3b82f6"]} />
        }
        ListEmptyComponent={() => !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyStateText}>Không có hoạt động nào đang diễn ra</Text>
          </View>
        )}
      />

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedActivity && (
              <>
                <View style={styles.modalImageContainer}>
                  {selectedActivity.bannerImageUrl ? (
                    <Image
                      source={{ uri: selectedActivity.bannerImageUrl }}
                      style={styles.modalImage}
                    />
                  ) : (
                    <View style={styles.modalImagePlaceholder}>
                      <Ionicons name="image-outline" size={60} color="#cbd5e1" />
                    </View>
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.modalImageGradient}
                  />
                </View>

                <View style={styles.modalBody}>
                  <Text style={styles.modalTitle}>{selectedActivity.name}</Text>
                  
                  <View style={styles.modalMetaSection}>
                    <View style={styles.modalMetaItem}>
                      <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                      <Text style={styles.modalMetaText}>
                        {formatDate(selectedActivity.startDate)}
                      </Text>
                    </View>

                    <View style={styles.modalMetaItem}>
                      <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                      <Text style={styles.modalMetaText}>
                        {formatTime(selectedActivity.startDate)} - {formatTime(selectedActivity.endDate)}
                      </Text>
                    </View>
                    
                    <View style={styles.modalMetaItem}>
                      <Ionicons name="location-outline" size={18} color={theme.colors.primary} />
                      <Text style={styles.modalMetaText}>
                        {selectedActivity.location}
                      </Text>
                    </View>

                    <View style={styles.modalMetaItem}>
                      <Ionicons name="person-outline" size={18} color={theme.colors.primary} />
                      <Text style={styles.modalMetaText}>
                        {selectedActivity.creatorDisplayName}
                      </Text>
                    </View>

                    <View style={styles.modalMetaItem}>
                      <Ionicons name="people-outline" size={18} color={theme.colors.primary} />
                      <Text style={styles.modalMetaText}>
                        {(selectedActivity.participants?.length || 0)} người tham gia
                      </Text>
                    </View>

                    <View style={styles.modalMetaItem}>
                      <Ionicons name="hourglass-outline" size={18} color={theme.colors.primary} />
                      <Text style={styles.modalMetaText}>
                        {(selectedActivity.pendingParticipants?.length || 0)} người chờ duyệt
                      </Text>
                    </View>
                  </View>

                  {selectedActivity.description && (
                    <View style={styles.descriptionSection}>
                      <Text style={styles.descriptionTitle}>Mô tả hoạt động</Text>
                      <Text style={styles.descriptionText}>
                        {selectedActivity.description}
                      </Text>
                    </View>
                  )}

                  <View style={styles.modalActions}>
                    <TouchableOpacity 
                      style={styles.editButton}
                      onPress={() => handleEditActivity(selectedActivity.id)}
                    >
                      <Ionicons name="create-outline" size={18} color="#fff" />
                      <Text style={styles.editButtonText}>Chỉnh sửa</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => setModalVisible(false)}
                    >
                      <Text style={styles.closeButtonText}>Đóng</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 5,
    paddingBottom: 5,
    paddingHorizontal: 5,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  listContent: {
    padding: 16,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  activityImageContainer: {
    height: 200,
    position: 'relative',
  },
  activityImage: {
    width: '100%',
    height: '100%',
  },
  activityImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  activityStatus: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  activityContent: {
    padding: 16,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  activityMeta: {
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metaText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#333',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalImageContainer: {
    height: 180,
    position: 'relative',
    backgroundColor: '#f1f5f9',
  },
  modalImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  modalImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  modalBody: {
    padding: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  modalMetaSection: {
    gap: 6,
    marginBottom: 12,
  },
  modalMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalMetaText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#334155',
    flex: 1,
  },
  descriptionSection: {
    marginBottom: 12,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  closeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default HoatDong;
