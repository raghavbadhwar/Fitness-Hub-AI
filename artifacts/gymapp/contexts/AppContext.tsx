import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type UserRole = "member" | "trainer" | "owner";
export type FitnessGoal = "lose_weight" | "build_muscle" | "maintain" | "improve_fitness";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type DietType = "veg" | "non_veg" | "vegan" | "eggetarian";

export interface UserProfile {
  name: string;
  age: number;
  gender: "male" | "female" | "other";
  height: number;
  weight: number;
  targetWeight: number;
  fitnessGoal: FitnessGoal;
  activityLevel: ActivityLevel;
  dietType: DietType;
  role: UserRole;
  dailyCalorieTarget: number;
  dailyProteinTarget: number;
  dailyCarbTarget: number;
  dailyFatTarget: number;
  onboardingComplete: boolean;
  profileImageUri?: string;
}

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface BodyMeasurement {
  date: string;
  chest?: number;
  waist?: number;
  hips?: number;
  biceps?: number;
  thighs?: number;
}

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  age: 25,
  gender: "male",
  height: 170,
  weight: 70,
  targetWeight: 65,
  fitnessGoal: "build_muscle",
  activityLevel: "moderate",
  dietType: "non_veg",
  role: "member",
  dailyCalorieTarget: 2000,
  dailyProteinTarget: 150,
  dailyCarbTarget: 200,
  dailyFatTarget: 60,
  onboardingComplete: false,
};

function calculateTargets(profile: Partial<UserProfile>): Partial<UserProfile> {
  const { weight = 70, height = 170, age = 25, gender = "male", activityLevel = "moderate", fitnessGoal = "maintain" } = profile;
  const activityMultiplier = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  const bmr = gender === "male"
    ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
    : 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;
  let tdee = Math.round(bmr * activityMultiplier[activityLevel]);
  if (fitnessGoal === "lose_weight") tdee -= 400;
  if (fitnessGoal === "build_muscle") tdee += 300;
  return {
    dailyCalorieTarget: tdee,
    dailyProteinTarget: Math.round(weight * 2.0),
    dailyCarbTarget: Math.round((tdee * 0.40) / 4),
    dailyFatTarget: Math.round((tdee * 0.30) / 9),
  };
}

interface AppContextType {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  completeOnboarding: (data: Partial<UserProfile>) => Promise<void>;
  isLoading: boolean;
  weightLog: WeightEntry[];
  logWeight: (weight: number) => Promise<void>;
  bodyMeasurements: BodyMeasurement[];
  logMeasurement: (measurement: Omit<BodyMeasurement, "date">) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const WEIGHT_LOG_KEY = "@gymapp_weight_log";
const MEASUREMENTS_KEY = "@gymapp_measurements";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState(true);
  const [weightLog, setWeightLog] = useState<WeightEntry[]>([]);
  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurement[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [storedProfile, storedWeightLog, storedMeasurements] = await Promise.all([
          AsyncStorage.getItem("@gymapp_profile"),
          AsyncStorage.getItem(WEIGHT_LOG_KEY),
          AsyncStorage.getItem(MEASUREMENTS_KEY),
        ]);
        if (storedProfile) setProfile(JSON.parse(storedProfile));
        if (storedWeightLog) setWeightLog(JSON.parse(storedWeightLog));
        if (storedMeasurements) setBodyMeasurements(JSON.parse(storedMeasurements));
      } catch (e) {
        console.error("Failed to load profile", e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);
    await AsyncStorage.setItem("@gymapp_profile", JSON.stringify(newProfile));
  }, [profile]);

  const completeOnboarding = useCallback(async (data: Partial<UserProfile>) => {
    const targets = calculateTargets({ ...profile, ...data });
    const newProfile: UserProfile = { ...profile, ...data, ...targets, onboardingComplete: true };
    setProfile(newProfile);
    await AsyncStorage.setItem("@gymapp_profile", JSON.stringify(newProfile));
  }, [profile]);

  const logWeight = useCallback(async (weight: number) => {
    const today = new Date().toISOString().slice(0, 10);
    const updated = weightLog.filter((e) => e.date !== today);
    updated.push({ date: today, weight });
    updated.sort((a, b) => a.date.localeCompare(b.date));
    setWeightLog(updated);
    const newProfile = { ...profile, weight };
    setProfile(newProfile);
    await Promise.all([
      AsyncStorage.setItem(WEIGHT_LOG_KEY, JSON.stringify(updated)),
      AsyncStorage.setItem("@gymapp_profile", JSON.stringify(newProfile)),
    ]);
  }, [weightLog, profile]);

  const logMeasurement = useCallback(async (measurement: Omit<BodyMeasurement, "date">) => {
    const today = new Date().toISOString().slice(0, 10);
    const updated = bodyMeasurements.filter((e) => e.date !== today);
    updated.push({ date: today, ...measurement });
    updated.sort((a, b) => a.date.localeCompare(b.date));
    setBodyMeasurements(updated);
    await AsyncStorage.setItem(MEASUREMENTS_KEY, JSON.stringify(updated));
  }, [bodyMeasurements]);

  return (
    <AppContext.Provider value={{ profile, updateProfile, completeOnboarding, isLoading, weightLog, logWeight, bodyMeasurements, logMeasurement }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
