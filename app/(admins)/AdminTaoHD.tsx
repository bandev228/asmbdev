import React, { useState, useEffect, useRef } from "react"
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Animated,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore"
import auth from "@react-native-firebase/auth"
import DateTimePicker from "@react-native-community/datetimepicker"
import { useActivity } from "./(index)/ActivityContext"
import * as Location from "expo-location"
import { useRouter } from "expo-router"

interface FormErrors {
  activityName?: string;
  location?: string;
  participantLimit?: string;
  date?: string;
  time?: string;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Activity {
  id: string;
  name: string;
  startDate: FirebaseFirestoreTypes.Timestamp;
  endDate: FirebaseFirestoreTypes.Timestamp;
  notes: string;
  participantLimit: number;
  createdBy: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  participants: string[];
  status: 'pending' | 'approved' | 'rejected';
  location: string;
  duration: number;
  coordinates: Coordinates | null;
}

const TaoHD = () => {
  const router = useRouter()
  const { updateActivities } = useActivity()
  const [activityName, setActivityName] = useState("")
  const [startDate, setStartDate] = useState(new Date())
  const [endDate, setEndDate] = useState(new Date(new Date().setDate(new Date().getDate() + 1)))
  const [startTime, setStartTime] = useState(new Date())
  const [endTime, setEndTime] = useState(new Date(new Date().setHours(new Date().getHours() + 2)))
  const [notes, setNotes] = useState("")
  const [participantLimit, setParticipantLimit] = useState("")
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)
  const [showStartTimePicker, setShowStartTimePicker] = useState(false)
  const [showEndTimePicker, setShowEndTimePicker] = useState(false)
  const [location, setLocation] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [locationError, setLocationError] = useState("")
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [currentCoordinates, setCurrentCoordinates] = useState<Coordinates | null>(null)

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(50)).current

  useEffect(() => {
    // Start entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const getCurrentLocation = async () => {
    try {
      setIsLoading(true)
      const { status } = await Location.requestForegroundPermissionsAsync()

      if (status !== "granted") {
        setLocationError("Quyền truy cập vị trí bị từ chối")
        setIsLoading(false)
        return
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })

      const { latitude, longitude } = location.coords
      setCurrentCoordinates({ latitude, longitude })
      setLocation(`Vị trí hiện tại (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`)
      setIsLoading(false)
      Alert.alert("Thành công", "Đã lưu tọa độ hiện tại cho hoạt động này", [{ text: "OK" }])
    } catch (error) {
      console.error("Error getting current location:", error)
      setLocationError("Không thể lấy vị trí hiện tại")
      setIsLoading(false)
    }
  }

  const validateForm = () => {
    const errors: FormErrors = {}

    if (!activityName.trim()) {
      errors.activityName = "Vui lòng nhập tên hoạt động"
    }

    if (!location.trim()) {
      errors.location = "Vui lòng nhập địa điểm tổ chức"
    }

    if (!participantLimit.trim()) {
      errors.participantLimit = "Vui lòng nhập số lượng tuyển"
    } else if (isNaN(Number(participantLimit)) || parseInt(participantLimit) <= 0) {
      errors.participantLimit = "Số lượng tuyển phải là số dương"
    }

    if (startDate > endDate) {
      errors.date = "Ngày bắt đầu phải trước ngày kết thúc"
    }

    if (startDate.toDateString() === endDate.toDateString() && startTime.getHours() > endTime.getHours()) {
      errors.time = "Thời gian bắt đầu phải trước thời gian kết thúc"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateActivity = async () => {
    if (!validateForm()) {
      Alert.alert("Lỗi", "Vui lòng kiểm tra lại thông tin hoạt động")
      return
    }

    try {
      setIsLoading(true)
      const user = auth().currentUser
      if (!user) {
        Alert.alert("Lỗi", "Bạn phải đăng nhập để tạo hoạt động")
        setIsLoading(false)
        return
      }

      const startDateTime = new Date(startDate)
      startDateTime.setHours(startTime.getHours(), startTime.getMinutes())

      const endDateTime = new Date(endDate)
      endDateTime.setHours(endTime.getHours(), endTime.getMinutes())

      const durationHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60)

      const activitiesRef = firestore().collection("activities")

      const newActivity = {
        name: activityName,
        startDate: firestore.Timestamp.fromDate(startDateTime),
        endDate: firestore.Timestamp.fromDate(endDateTime),
        notes,
        participantLimit: parseInt(participantLimit),
        createdBy: user.uid,
        createdAt: firestore.FieldValue.serverTimestamp(),
        participants: [],
        status: "pending",
        location: location,
        duration: durationHours,
        coordinates: currentCoordinates,
      }

      const docRef = await activitiesRef.add(newActivity)

      const activityWithId = {
        id: docRef.id,
        ...newActivity,
        startDate: firestore.Timestamp.fromDate(startDateTime),
        endDate: firestore.Timestamp.fromDate(endDateTime),
        createdAt: firestore.Timestamp.now()
      }
      
      updateActivities([activityWithId])

      const notificationsRef = firestore().collection("notifications")
      await notificationsRef.add({
        title: "Hoạt động mới",
        message: `Hoạt động "${activityName}" vừa được tạo và đang chờ duyệt.`,
        createdAt: firestore.FieldValue.serverTimestamp(),
        activityId: docRef.id,
        read: false,
        type: "new_activity",
      })

      setIsLoading(false)
      Alert.alert("Thành công", "Hoạt động đã được tạo và đang chờ duyệt", [
        { text: "OK", onPress: () => router.back() },
      ])
    } catch (error) {
      console.error("Error creating activity:", error)
      setIsLoading(false)
      Alert.alert("Lỗi", "Không thể tạo hoạt động. Vui lòng thử lại.")
    }
  }

  const onChangeDate = (
    event: any,
    selectedDate: Date | undefined,
    setDate: (date: Date) => void,
    type: string
  ) => {
    if (Platform.OS === "android") {
      setShowStartPicker(false)
      setShowEndPicker(false)
    }

    if (selectedDate) {
      setDate(selectedDate)
    }
  }

  const onChangeTime = (
    event: any,
    selectedTime: Date | undefined,
    setTime: (time: Date) => void,
    type: string
  ) => {
    if (Platform.OS === "android") {
      setShowStartTimePicker(false)
      setShowEndTimePicker(false)
    }

    if (selectedTime) {
      setTime(selectedTime)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY }],
            },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Tạo hoạt động mới</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.formContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Tên hoạt động <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, formErrors.activityName ? styles.inputError : null]}
              placeholder="Nhập tên hoạt động"
              value={activityName}
              onChangeText={(text) => {
                setActivityName(text)
                setFormErrors({ ...formErrors, activityName: "" })
              }}
            />
            {formErrors.activityName ? <Text style={styles.errorText}>{formErrors.activityName}</Text> : null}
          </View>

          <View style={styles.rowContainer}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>
                Ngày bắt đầu <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dateButton, formErrors.date ? styles.inputError : null]}
                onPress={() => setShowStartPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.dateButtonText}>{startDate.toLocaleDateString("vi-VN")}</Text>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>

            <View style={[styles.inputContainer, { flex: 1 }]}>
              <Text style={styles.label}>Thời gian bắt đầu</Text>
              <TouchableOpacity
                style={[styles.dateButton, formErrors.time ? styles.inputError : null]}
                onPress={() => setShowStartTimePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.dateButtonText}>
                  {startTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </Text>
                <Ionicons name="time-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedDate) => onChangeDate(event, selectedDate, setStartDate, "start")}
              minimumDate={new Date()}
            />
          )}

          {showStartTimePicker && (
            <DateTimePicker
              value={startTime}
              mode="time"
              is24Hour={true}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedTime) => onChangeTime(event, selectedTime, setStartTime, "start")}
            />
          )}

          <View style={styles.rowContainer}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>
                Ngày kết thúc <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dateButton, formErrors.date ? styles.inputError : null]}
                onPress={() => setShowEndPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.dateButtonText}>{endDate.toLocaleDateString("vi-VN")}</Text>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>

            <View style={[styles.inputContainer, { flex: 1 }]}>
              <Text style={styles.label}>Thời gian kết thúc</Text>
              <TouchableOpacity
                style={[styles.dateButton, formErrors.time ? styles.inputError : null]}
                onPress={() => setShowEndTimePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.dateButtonText}>
                  {endTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </Text>
                <Ionicons name="time-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>

          {formErrors.date || formErrors.time ? (
            <Text style={styles.errorText}>{formErrors.date || formErrors.time}</Text>
          ) : null}

          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedDate) => onChangeDate(event, selectedDate, setEndDate, "end")}
              minimumDate={startDate}
            />
          )}

          {showEndTimePicker && (
            <DateTimePicker
              value={endTime}
              mode="time"
              is24Hour={true}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedTime) => onChangeTime(event, selectedTime, setEndTime, "end")}
            />
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Số lượng tuyển <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, formErrors.participantLimit ? styles.inputError : null]}
              placeholder="Nhập số lượng"
              value={participantLimit}
              onChangeText={(text) => {
                setParticipantLimit(text)
                setFormErrors({ ...formErrors, participantLimit: "" })
              }}
              keyboardType="numeric"
            />
            {formErrors.participantLimit ? <Text style={styles.errorText}>{formErrors.participantLimit}</Text> : null}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Địa điểm tổ chức <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.locationInputContainer}>
              <TextInput
                style={[styles.input, styles.locationInput, formErrors.location ? styles.inputError : null]}
                placeholder="Nhập địa điểm"
                value={location}
                onChangeText={(text) => {
                  setLocation(text)
                  setFormErrors({ ...formErrors, location: "" })
                }}
              />
              <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation} activeOpacity={0.7}>
                <Ionicons name="locate" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {formErrors.location ?
            <Text style={styles.errorText}>{formErrors.location}</Text> : null}
            {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
            {currentCoordinates && (
              <View style={styles.coordinatesContainer}>
                <Ionicons name="location" size={16} color="#4CAF50" />
                <Text style={styles.coordinatesText}>
                  Đã lưu tọa độ: {currentCoordinates.latitude.toFixed(6)}, {currentCoordinates.longitude.toFixed(6)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Ghi chú</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Nhập ghi chú, mô tả chi tiết về hoạt động..."
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateActivity}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.createButtonText}>Tạo hoạt động</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F4F8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1A2138",
  },
  formContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  inputContainer: {
    marginBottom: 16,
  },
  rowContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A2138",
    marginBottom: 8,
  },
  required: {
    color: "#FF3B30",
  },
  input: {
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E9F0",
    color: "#1A2138",
  },
  inputError: {
    borderColor: "#FF3B30",
    borderWidth: 1,
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 12,
    marginTop: 4,
  },
  coordinatesContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  coordinatesText: {
    color: "#4CAF50",
    fontSize: 12,
    marginLeft: 4,
  },
  textArea: {
    height: 120,
    textAlignVertical: "top",
  },
  dateButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E5E9F0",
  },
  dateButtonText: {
    fontSize: 16,
    color: "#1A2138",
  },
  locationInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationInput: {
    flex: 1,
    marginRight: 8,
  },
  locationButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    width: 50,
  },
  createButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
  },
  buttonIcon: {
    marginRight: 8,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
})

export default TaoHD
