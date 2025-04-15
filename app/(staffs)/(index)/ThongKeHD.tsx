import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

const ThongKeHoatDong = ({ }) => {
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    totalActivities: 0,
    completedActivities: 0,
    ongoingActivities: 0,
    upcomingActivities: 0,
    totalParticipants: 0,
  });
  const [activities, setActivities] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const now = firestore.Timestamp.fromDate(new Date());
      const activitiesSnapshot = await firestore().collection('activities').get();

      let totalActivities = 0;
      let completedActivities = 0;
      let ongoingActivities = 0;
      let upcomingActivities = 0;
      let totalParticipants = 0;
      let activitiesList = [];

      activitiesSnapshot.forEach((doc) => {
        const activity = doc.data();
        const participantsCount = activity.participants ? activity.participants.length : 0;
        totalActivities++;
        totalParticipants += participantsCount;

        activitiesList.push({
          id: doc.id,
          name: activity.name,
          participantsCount: participantsCount,
          startDate: activity.startDate.toDate(),
          endDate: activity.endDate.toDate(),
        });

        if (activity.endDate.toDate() < now.toDate()) {
          completedActivities++;
        } else if (activity.startDate.toDate() <= now.toDate() && activity.endDate.toDate() >= now.toDate()) {
          ongoingActivities++;
        } else {
          upcomingActivities++;
        }
      });

      setStatistics({
        totalActivities,
        completedActivities,
        ongoingActivities,
        upcomingActivities,
        totalParticipants,
      });
      setActivities(activitiesList);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      alert('Không thể lấy thống kê. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const chartData = [
    { name: 'Đã hoàn thành', population: statistics.completedActivities, color: '#FF9800', legendFontColor: '#7F7F7F', legendFontSize: 12 },
    { name: 'Đang diễn ra', population: statistics.ongoingActivities, color: '#4CAF50', legendFontColor: '#7F7F7F', legendFontSize: 12 },
    { name: 'Sắp diễn ra', population: statistics.upcomingActivities, color: '#2196F3', legendFontColor: '#7F7F7F', legendFontSize: 12 },
  ];

  const StatisticCard = ({ title, value, icon }) => (
    <View style={styles.card}>
      <Ionicons name={icon} size={24} color="#007AFF" />
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );

  const renderActivityItem = ({ item }) => (
    <View style={styles.activityItem}>
      <Text style={styles.activityName}>{item.name}</Text>
      <Text style={styles.activityParticipants}>Số người tham gia: {item.participantsCount}</Text>
      <Text style={styles.activityDate}>
        {item.startDate.toLocaleDateString()} - {item.endDate.toLocaleDateString()}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Thống kê hoạt động</Text>
          <TouchableOpacity onPress={fetchStatistics} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.cardContainer}>
              <StatisticCard title="Tổng số hoạt động" value={statistics.totalActivities} icon="calendar-outline" />
              <StatisticCard title="Tổng số người tham gia" value={statistics.totalParticipants} icon="people-outline" />
            </View>
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Phân bố hoạt động</Text>
              <PieChart
                data={chartData}
                width={screenWidth - 40}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </View>
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#FF9800' }]} />
                <Text style={styles.legendText}>Đã hoàn thành: {statistics.completedActivities}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.legendText}>Đang diễn ra: {statistics.ongoingActivities}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#2196F3' }]} />
                <Text style={styles.legendText}>Sắp diễn ra: {statistics.upcomingActivities}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.viewDetailsButton} onPress={() => setModalVisible(true)}>
              <Text style={styles.viewDetailsButtonText}>Xem chi tiết số người tham gia</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Chi tiết số người tham gia</Text>
            <FlatList
              data={activities}
              renderItem={renderActivityItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.modalList}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F0F0F5',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    padding: 20,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    width: '48%',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
    textAlign: 'center',
  },
  legendContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#666666',
  },
  viewDetailsButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  viewDetailsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalList: {
    width: '100%',
  },
  activityItem: {
    backgroundColor: '#F0F0F5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  activityName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  activityParticipants: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  activityDate: {
    fontSize: 14,
    color: '#666',
  },
  closeButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 8,
    marginTop: 15,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ThongKeHoatDong;
