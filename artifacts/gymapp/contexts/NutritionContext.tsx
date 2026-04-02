import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

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

function getDateKey(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

interface NutritionContextType {
  todayLog: DailyLog;
  getLogForDate: (date: string) => DailyLog;
  addFoodEntry: (entry: Omit<FoodEntry, "id" | "timestamp">, date?: string) => Promise<void>;
  removeFoodEntry: (entryId: string, date?: string) => Promise<void>;
  updateWaterIntake: (glasses: number, date?: string) => Promise<void>;
  getWeeklyCalories: () => { date: string; calories: number }[];
  isLoading: boolean;
}

const NutritionContext = createContext<NutritionContextType | null>(null);

export function NutritionProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<Record<string, DailyLog>>({});
  const [isLoading, setIsLoading] = useState(true);
  const today = getDateKey();

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem("@gymapp_nutrition");
        if (stored) setLogs(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load nutrition", e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const saveLogs = useCallback(async (newLogs: Record<string, DailyLog>) => {
    setLogs(newLogs);
    await AsyncStorage.setItem("@gymapp_nutrition", JSON.stringify(newLogs));
  }, []);

  const getLogForDate = useCallback(
    (date: string): DailyLog => logs[date] || { date, entries: [], waterIntake: 0 },
    [logs],
  );

  const todayLog = getLogForDate(today);

  const addFoodEntry = useCallback(
    async (entry: Omit<FoodEntry, "id" | "timestamp">, date: string = today) => {
      const currentLog = logs[date] || { date, entries: [], waterIntake: 0 };
      const newEntry: FoodEntry = { ...entry, id: generateId(), timestamp: Date.now() };
      const newLogs = { ...logs, [date]: { ...currentLog, entries: [...currentLog.entries, newEntry] } };
      await saveLogs(newLogs);
    },
    [logs, saveLogs, today],
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
    },
    [logs, saveLogs, today],
  );

  const updateWaterIntake = useCallback(
    async (glasses: number, date: string = today) => {
      const currentLog = logs[date] || { date, entries: [], waterIntake: 0 };
      const newLogs = { ...logs, [date]: { ...currentLog, waterIntake: glasses } };
      await saveLogs(newLogs);
    },
    [logs, saveLogs, today],
  );

  const getWeeklyCalories = useCallback(() => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = getDateKey(d);
      const log = logs[dateKey] || { date: dateKey, entries: [], waterIntake: 0 };
      const calories = log.entries.reduce((sum, e) => sum + e.calories, 0);
      result.push({ date: dateKey, calories });
    }
    return result;
  }, [logs]);

  return (
    <NutritionContext.Provider
      value={{ todayLog, getLogForDate, addFoodEntry, removeFoodEntry, updateWaterIntake, getWeeklyCalories, isLoading }}
    >
      {children}
    </NutritionContext.Provider>
  );
}

export function useNutrition() {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error("useNutrition must be used within NutritionProvider");
  return ctx;
}
