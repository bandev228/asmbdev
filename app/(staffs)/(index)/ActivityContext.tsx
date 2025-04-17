import { createContext, useContext, useState, ReactNode } from "react"

interface ActivityContextType {
  activities: any[];
  updateActivities: (newActivities: any[]) => void;
}

const ActivityContext = createContext<ActivityContextType>({
  activities: [],
  updateActivities: () => {}
})

export const ActivityProvider = ({ children }: { children: ReactNode }) => {
  const [activities, setActivities] = useState<any[]>([])

  const updateActivities = (newActivities: any[]) => {
    setActivities(newActivities)
  }

  return <ActivityContext.Provider value={{ activities, updateActivities }}>{children}</ActivityContext.Provider>
}

export const useActivity = () => {
  return useContext(ActivityContext)
}
export default ActivityContext;
