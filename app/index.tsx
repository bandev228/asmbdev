import { Redirect } from 'expo-router';
import { useAuth } from './_layout';

export default function Index() {
  const { user } = useAuth();
  
  // Nếu không có user, chuyển hướng về trang login
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }
  
  // Nếu có user, chuyển hướng dựa vào vai trò
  if (user.email === "admin@gmail.com") {
    return <Redirect href="/(admins)/(index)" />;
  } else if (user.email?.endsWith("@tdmu.edu.vn")) {
    return <Redirect href="/(staffs)/(index)" />;
  } else {
    return <Redirect href="/(students)/(index)" />;
  }
}