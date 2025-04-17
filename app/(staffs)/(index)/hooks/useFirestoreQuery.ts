import { useState, useEffect, useRef } from "react"
import { getFirestore, collection, query, where, orderBy, limit, getDocs, onSnapshot } from "@react-native-firebase/firestore"
import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore"
import { useNetInfo } from "@react-native-community/netinfo"
import AsyncStorage from "@react-native-async-storage/async-storage"

type QueryConfig = {
  collection: string
  where?: [string, FirebaseFirestoreTypes.WhereFilterOp, any][]
  orderBy?: [string, "asc" | "desc"][]
  limit?: number
  cacheKey?: string
  cacheDuration?: number // in milliseconds
  dependencies?: any[]
}

export function useFirestoreQuery<T>({
  collection: collectionName,
  where: whereClauses = [],
  orderBy: orderByClauses = [],
  limit: queryLimit,
  cacheKey,
  cacheDuration = 5 * 60 * 1000, // 5 minutes default
  dependencies = [],
}: QueryConfig) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [lastFetched, setLastFetched] = useState<number>(0)
  const isMounted = useRef(true)
  const netInfo = useNetInfo()
  const db = getFirestore()

  const fetchData = async (forceRefresh = false) => {
    if (!isMounted.current) return

    try {
      setLoading(true)
      setError(null)

      // Check cache first if we have a cacheKey and not forcing refresh
      if (cacheKey && !forceRefresh) {
        const cachedData = await AsyncStorage.getItem(`firestore_cache_${cacheKey}`)
        if (cachedData) {
          const { data: parsedData, timestamp } = JSON.parse(cachedData)
          const isExpired = Date.now() - timestamp > cacheDuration

          if (!isExpired) {
            if (isMounted.current) {
              setData(parsedData)
              setLoading(false)
              setLastFetched(timestamp)
              return
            }
          }
        }
      }

      // If offline and we have cached data, use it
      if (!netInfo.isConnected && cacheKey) {
        const cachedData = await AsyncStorage.getItem(`firestore_cache_${cacheKey}`)
        if (cachedData) {
          const { data: parsedData, timestamp } = JSON.parse(cachedData)
          if (isMounted.current) {
            setData(parsedData)
            setLoading(false)
            setLastFetched(timestamp)
            return
          }
        }
      }

      // Build query
      let q = query(collection(db, collectionName))

      // Apply where clauses
      whereClauses.forEach(([field, operator, value]) => {
        q = query(q, where(field, operator, value))
      })

      // Apply orderBy
      orderByClauses.forEach(([field, direction]) => {
        q = query(q, orderBy(field, direction))
      })

      // Apply limit
      if (queryLimit) {
        q = query(q, limit(queryLimit))
      }

      // Execute query
      const querySnapshot = await getDocs(q)

      const results = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[]

      if (isMounted.current) {
        setData(results)
        setLoading(false)
        setLastFetched(Date.now())

        // Cache the results if we have a cacheKey
        if (cacheKey) {
          await AsyncStorage.setItem(
            `firestore_cache_${cacheKey}`,
            JSON.stringify({
              data: results,
              timestamp: Date.now(),
            }),
          )
        }
      }
    } catch (err) {
      console.error("Error fetching Firestore data:", err)
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error("Unknown error occurred"))
        setLoading(false)

        // Try to load from cache if we have a network error
        if (cacheKey) {
          try {
            const cachedData = await AsyncStorage.getItem(`firestore_cache_${cacheKey}`)
            if (cachedData) {
              const { data: parsedData } = JSON.parse(cachedData)
              setData(parsedData)
            }
          } catch (cacheErr) {
            console.error("Error loading from cache:", cacheErr)
          }
        }
      }
    }
  }

  useEffect(() => {
    isMounted.current = true
    fetchData()

    return () => {
      isMounted.current = false
    }
  }, [netInfo.isConnected, ...dependencies])

  const refresh = () => fetchData(true)

  return { data, loading, error, refresh, lastFetched }
}
export default useFirestoreQuery;