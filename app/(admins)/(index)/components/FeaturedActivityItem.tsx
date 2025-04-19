import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityData } from '../hooks/types';

interface FeaturedActivityItemProps {
  item: ActivityData & { id: string };
  index: number;
  onPress: () => void;
  itemAnimations: {
    fade: Animated.Value;
    translateX: Animated.Value;
  }[];
}

export const FeaturedActivityItem: React.FC<FeaturedActivityItemProps> = ({ 
  item, 
  index, 
  onPress,
  itemAnimations 
}) => {
  const isApproved = item.status === 'approved';
  const formattedDate = item.date ? item.date.toDate().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) : 'Chưa có ngày';

  const itemAnim = itemAnimations[index] || { fade: new Animated.Value(1), translateX: new Animated.Value(0) };

  return (
    <Animated.View 
      style={[
        styles.featuredActivityItem,
        { 
          opacity: itemAnim.fade,
          transform: [{ translateX: itemAnim.translateX }],
          borderLeftColor: isApproved ? '#4CAF50' : '#FFC107',
        }
      ]}
    >
      <TouchableOpacity 
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={styles.featuredActivityName} numberOfLines={1}>{item.name || 'Không có tiêu đề'}</Text>
        <View style={styles.activityInfoRow}>
          <Ionicons name="people-outline" size={16} color="#666" />
          <Text style={styles.featuredActivityInfo}>{item.participants?.length || 0} người tham gia</Text>
        </View>
        <View style={styles.activityInfoRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.featuredActivityInfo}>{formattedDate}</Text>
        </View>
        <View style={styles.activityInfoRow}>
          <Ionicons name="location-outline" size={16} color="#666" />
          <Text style={styles.featuredActivityInfo} numberOfLines={1}>{item.location || 'Chưa có địa điểm'}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={[
            styles.statusText, 
            { color: isApproved ? '#4CAF50' : '#FFC107' }
          ]}>
            {isApproved ? 'Đã duyệt' : 'Chờ duyệt'}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  featuredActivityItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginRight: 16,
    width: 250,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  featuredActivityName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  activityInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  featuredActivityInfo: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  statusBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
}); 

export default FeaturedActivityItem;