import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getApiBase } from "@/lib/api-base";
import { authenticatedJsonRequest } from "@/lib/authenticated-api";
import { getLocalDateKey, getMillisecondsUntilNextLocalDate } from "@/lib/date-key";
import { generateId } from "@/lib/id";
import { getRecentUniqueFoodEntries } from "@/lib/nutrition-history";

export type MealType = "breakfast" | "lunch" | "dinner" | "snacks" | "pre_workout" | "post_workout";

export interface FoodEntry {
  id: string;
  foodId: string;
  name: string;
  mealType: MealType;
  servings: number;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  timestamp: number;
  fromPhoto?: boolean;
  photoUri?: string;
  source?: "manual" | "photo" | "search" | "recent" | "barcode" | "label";
  confidence?: "high" | "medium" | "low";
  ingredients?: string[];
  servingGrams?: number;
  barcode?: string;
  brand?: string;
  catalogItemId?: string;
  memberFoodItemId?: string;
  sourceProductId?: string;
  provider?: string;
  providerCached?: boolean;
  providerQualityScore?: number;
  portionOptions?: Array<{
    label: string;
    grams?: number;
    milliliters?: number;
    aliases?: string[];
  }>;
  correctionOf?: string;
  correctedAt?: number;
  relogOf?: string;
  notes?: string;
}

export interface DailyLog {
  date: string;
  entries: FoodEntry[];
  waterIntake: number;
}

export interface NutritionSummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  water: number;
}

interface NutritionContextType {
  todayLog: DailyLog;
  getLogForDate: (date: string) => DailyLog;
  addFoodEntry: (entry: Omit<FoodEntry, "id" | "timestamp">, date?: string) => Promise<void>;
  removeFoodEntry: (entryId: string, date?: string) => Promise<void>;
  updateWaterIntake: (glasses: number, date?: string) => Promise<void>;
  getLogsForRange: (startDate: string, endDate: string) => DailyLog[];
  getRecentFoodEntries: (limit?: number) => FoodEntry[];
  getWeeklyCalories: () => { date: string; calories: number }[];
  get30DayCalories: () => { date: string; calories: number }[];
  isLoading: boolean;
}

const NutritionContext = createContext<NutritionContextType | null>(null);
const NUTRITION_STORAGE_KEY = "@gymapp_nutrition";

type ServerNutritionLog = DailyLog & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
};

function logsArrayToMap(logs: DailyLog[]): Record<string, DailyLog> {
  return Object.fromEntries(logs.map((log) => [log.date, log]));
}

export function NutritionProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded: authLoaded, userId } = useAuth();
  const [logs, setLogs] = useState<Record<string, DailyLog>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [today, setToday] = useState(() => getLocalDateKey());
  const getTokenRef = useRef(getToken);
  const storageKey = `${NUTRITION_STORAGE_KEY}:${userId ?? "guest"}`;

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextDayRefresh = () => {
      timeoutId = setTimeout(() => {
        setToday(getLocalDateKey());
        scheduleNextDayRefresh();
      }, getMillisecondsUntilNextLocalDate());
    };

    scheduleNextDayRefresh();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (!authLoaded) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        const storedLogs = stored ? (JSON.parse(stored) as Record<string, DailyLog>) : {};
        if (userId) {
          const apiBase = getApiBase();
          if (apiBase) {
            try {
              const serverLogs = await authenticatedJsonRequest<ServerNutritionLog[]>({
                apiBase,
                getToken: getTokenRef.current,
                path: "/api/nutrition/logs",
              });
              const mergedLogs = { ...storedLogs, ...logsArrayToMap(serverLogs) };
              if (!cancelled) {
                setLogs(mergedLogs);
                await AsyncStorage.setItem(storageKey, JSON.stringify(mergedLogs));
              }
              return;
            } catch (error) {
              console.error("Failed to load nutrition logs from server", error);
            }
          }
        }

        if (!cancelled) {
          setLogs(storedLogs);
        }
      } catch (e) {
        console.error("Failed to load nutrition", e);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [authLoaded, storageKey, userId]);

  const syncLogToServer = useCallback(
    async (log: DailyLog) => {
      if (!userId) return;
      const apiBase = getApiBase();
      if (!apiBase) return;

      try {
        await authenticatedJsonRequest<unknown>({
          apiBase,
          getToken,
          path: `/api/nutrition/logs/${encodeURIComponent(log.date)}`,
          method: "PUT",
          body: {
            entries: log.entries,
            waterIntake: log.waterIntake,
          },
        });
      } catch (error) {
        console.error("Failed to sync nutrition log", error);
      }
    },
    [getToken, userId],
  );

  const saveLogs = useCallback(
    async (newLogs: Record<string, DailyLog>) => {
      setLogs(newLogs);
      await AsyncStorage.setItem(storageKey, JSON.stringify(newLogs));
    },
    [storageKey],
  );

  const getLogForDate = useCallback(
    (date: string): DailyLog => logs[date] || { date, entries: [], waterIntake: 0 },
    [logs],
  );

  const todayLog = getLogForDate(today);

  const addFoodEntry = useCallback(
    async (entry: Omit<FoodEntry, "id" | "timestamp">, date: string = today) => {
      const currentLog = logs[date] || { date, entries: [], waterIntake: 0 };
      const newEntry: FoodEntry = { ...entry, id: generateId(), timestamp: Date.now() };
      const newLogs = {
        ...logs,
        [date]: { ...currentLog, entries: [...currentLog.entries, newEntry] },
      };
      await saveLogs(newLogs);
      await syncLogToServer(newLogs[date]);
    },
    [logs, saveLogs, syncLogToServer, today],
  );

  const removeFoodEntry = useCallback(
    async (entryId: string, date: string = today) => {
      const currentLog = logs[date];
      if (!currentLog) return;
      const newLogs = {
        ...logs,
        [date]: { ...currentLog, entries: currentLog.entries.filter((e) => e.id !== entryId) },
      };
      await saveLogs(newLogs);
      await syncLogToServer(newLogs[date]);
    },
    [logs, saveLogs, syncLogToServer, today],
  );

  const updateWaterIntake = useCallback(
    async (glasses: number, date: string = today) => {
      const currentLog = logs[date] || { date, entries: [], waterIntake: 0 };
      const newLogs = { ...logs, [date]: { ...currentLog, waterIntake: glasses } };
      await saveLogs(newLogs);
      await syncLogToServer(newLogs[date]);
    },
    [logs, saveLogs, syncLogToServer, today],
  );

  const getLogsForRange = useCallback(
    (startDate: string, endDate: string) => {
      return Object.values(logs)
        .filter((log) => log.date >= startDate && log.date <= endDate)
        .sort((left, right) => left.date.localeCompare(right.date));
    },
    [logs],
  );

  const getRecentFoodEntries = useCallback(
    (limit = 8) => getRecentUniqueFoodEntries(logs, limit),
    [logs],
  );

  const getWeeklyCalories = useCallback(() => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = getLocalDateKey(d);
      const log = logs[dateKey] || { date: dateKey, entries: [], waterIntake: 0 };
      const calories = log.entries.reduce((sum, e) => sum + e.calories, 0);
      result.push({ date: dateKey, calories });
    }
    return result;
  }, [logs]);

  const get30DayCalories = useCallback(() => {
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = getLocalDateKey(d);
      const log = logs[dateKey] || { date: dateKey, entries: [], waterIntake: 0 };
      const calories = log.entries.reduce((sum, e) => sum + e.calories, 0);
      result.push({ date: dateKey, calories });
    }
    return result;
  }, [logs]);

  const contextValue = useMemo<NutritionContextType>(
    () => ({
      todayLog,
      getLogForDate,
      addFoodEntry,
      removeFoodEntry,
      updateWaterIntake,
      getLogsForRange,
      getRecentFoodEntries,
      getWeeklyCalories,
      get30DayCalories,
      isLoading,
    }),
    [
      todayLog,
      getLogForDate,
      addFoodEntry,
      removeFoodEntry,
      updateWaterIntake,
      getLogsForRange,
      getRecentFoodEntries,
      getWeeklyCalories,
      get30DayCalories,
      isLoading,
    ],
  );

  return <NutritionContext.Provider value={contextValue}>{children}</NutritionContext.Provider>;
}

export function useNutrition() {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error("useNutrition must be used within NutritionProvider");
  return ctx;
}
