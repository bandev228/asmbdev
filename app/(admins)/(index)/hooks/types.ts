import { Timestamp } from '@react-native-firebase/firestore';

export interface ActivityData {
  id: string;
  name: string;
  participants: string[];
  status: 'pending' | 'approved' | 'rejected';
  date: Date;
  location: string;
  createdAt: Date;
  description: string;
}

export interface ChartDataItem {
  name: string;
  population: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

export interface DashboardStats {
  totalActivities: number;
  pendingActivities: number;
  totalUsers: number;
  approvedActivities: number;
}

// Default export to fix the warning
export default {
  ActivityData: {} as ActivityData,
  ChartDataItem: {} as ChartDataItem,
  DashboardStats: {} as DashboardStats
};

