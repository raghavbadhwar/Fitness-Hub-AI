import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth, useUser } from "@clerk/expo";
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
import { getLocalDateKey } from "@/lib/date-key";
import { refreshServerProfileAccess } from "@/lib/profile-access";

export type UserRole = "member" | "trainer" | "owner";
export type FitnessGoal = "lose_weight" | "build_muscle" | "maintain" | "improve_fitness";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type DietType = "veg" | "non_veg" | "vegan" | "eggetarian";
export type FitnessExperience = "beginner" | "intermediate" | "advanced";
export type Equipment = "commercial_gym" | "home_gym" | "outdoor" | "minimal" | "no_equipment";
export type WorkoutTime = "morning" | "afternoon" | "evening" | "flexible";
export type MealTiming = "3_meals" | "5_small_meals" | "intermittent_fasting" | "intuitive_eating";
export type Injury = "knee" | "lower_back" | "shoulder" | "wrist" | "none";
export type AccessStatus = "unknown" | "approved" | "pending_approval" | "revoked";

export interface AccessState {
  status: AccessStatus;
  email?: string | null;
  role?: UserRole | null;
  message?: string;
}

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
  fitnessExperience: FitnessExperience;
  equipment: Equipment;
  injuries: Injury[];
  workoutTime: WorkoutTime;
  mealTiming: MealTiming;
  gymName: string;
  numTrainers: string;
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
  fitnessExperience: "beginner",
  equipment: "commercial_gym",
  injuries: [],
  workoutTime: "flexible",
  mealTiming: "3_meals",
  gymName: "",
  numTrainers: "",
};

function calculateTargets(profile: Partial<UserProfile>): Partial<UserProfile> {
  const {
    weight = 70,
    height = 170,
    age = 25,
    gender = "male",
    activityLevel = "moderate",
    fitnessGoal = "maintain",
  } = profile;
  const activityMultiplier = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const bmr =
    gender === "male"
      ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
      : 447.593 + 9.247 * weight + 3.098 * height - 4.33 * age;
  let tdee = Math.round(bmr * activityMultiplier[activityLevel]);
  if (fitnessGoal === "lose_weight") tdee -= 400;
  if (fitnessGoal === "build_muscle") tdee += 300;
  return {
    dailyCalorieTarget: tdee,
    dailyProteinTarget: Math.round(weight * 2.0),
    dailyCarbTarget: Math.round((tdee * 0.4) / 4),
    dailyFatTarget: Math.round((tdee * 0.3) / 9),
  };
}

interface AppContextType {
  profile: UserProfile;
  accessState: AccessState;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  completeOnboarding: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<boolean>;
  isLoading: boolean;
  weightLog: WeightEntry[];
  logWeight: (weight: number) => Promise<void>;
  bodyMeasurements: BodyMeasurement[];
  logMeasurement: (measurement: Omit<BodyMeasurement, "date">) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const PROFILE_STORAGE_KEY = "@gymapp_profile";
const WEIGHT_LOG_KEY = "@gymapp_weight_log";
const MEASUREMENTS_KEY = "@gymapp_measurements";
const DEFAULT_ACCESS_STATE: AccessState = { status: "unknown" };

function getScopedStorageKey(baseKey: string, userId?: string | null) {
  return userId ? `${baseKey}:${userId}` : baseKey;
}

async function readScopedValue(
  scopedKey: string,
  legacyKey: string,
  options?: { allowLegacyFallback?: boolean },
) {
  const scopedValue = await AsyncStorage.getItem(scopedKey);
  if (scopedValue !== null) {
    return scopedValue;
  }

  if (scopedKey === legacyKey || !options?.allowLegacyFallback) {
    return null;
  }

  return AsyncStorage.getItem(legacyKey);
}

interface ProgressEntryPayload extends Partial<Omit<BodyMeasurement, "date">> {
  date: string;
  weight?: number;
}

function parsePositiveNumber(value: unknown): number | undefined {
  if (value === null || typeof value === "undefined" || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10) / 10 : undefined;
}

function normalizeProgressEntry(value: unknown): ProgressEntryPayload | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const date = typeof record.date === "string" && record.date.trim() ? record.date.trim() : "";
  if (!date) return null;

  const entry: ProgressEntryPayload = { date };
  const weight = parsePositiveNumber(record.weight);
  const chest = parsePositiveNumber(record.chest);
  const waist = parsePositiveNumber(record.waist);
  const hips = parsePositiveNumber(record.hips);
  const biceps = parsePositiveNumber(record.biceps);
  const thighs = parsePositiveNumber(record.thighs);

  if (typeof weight === "number") entry.weight = weight;
  if (typeof chest === "number") entry.chest = chest;
  if (typeof waist === "number") entry.waist = waist;
  if (typeof hips === "number") entry.hips = hips;
  if (typeof biceps === "number") entry.biceps = biceps;
  if (typeof thighs === "number") entry.thighs = thighs;

  return entry;
}

function mergeWeightLogs(localEntries: WeightEntry[], remoteEntries: WeightEntry[]) {
  const byDate = new Map(localEntries.map((entry) => [entry.date, entry]));
  for (const entry of remoteEntries) byDate.set(entry.date, entry);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function mergeBodyMeasurements(localEntries: BodyMeasurement[], remoteEntries: BodyMeasurement[]) {
  const byDate = new Map(localEntries.map((entry) => [entry.date, entry]));
  for (const entry of remoteEntries) byDate.set(entry.date, entry);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded: authLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [accessState, setAccessState] = useState<AccessState>(DEFAULT_ACCESS_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [weightLog, setWeightLog] = useState<WeightEntry[]>([]);
  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurement[]>([]);
  const profileRef = useRef(profile);
  const weightLogRef = useRef<WeightEntry[]>([]);
  const bodyMeasurementsRef = useRef<BodyMeasurement[]>([]);
  const lastSyncedUserIdRef = useRef<string | null>(null);

  const storageKeys = useMemo(
    () => ({
      profile: getScopedStorageKey(PROFILE_STORAGE_KEY, userId),
      weightLog: getScopedStorageKey(WEIGHT_LOG_KEY, userId),
      measurements: getScopedStorageKey(MEASUREMENTS_KEY, userId),
    }),
    [userId],
  );

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const replaceWeightLog = useCallback(
    async (nextWeightLog: WeightEntry[]) => {
      weightLogRef.current = nextWeightLog;
      setWeightLog(nextWeightLog);
      await AsyncStorage.setItem(storageKeys.weightLog, JSON.stringify(nextWeightLog));
    },
    [storageKeys.weightLog],
  );

  const replaceBodyMeasurements = useCallback(
    async (nextMeasurements: BodyMeasurement[]) => {
      bodyMeasurementsRef.current = nextMeasurements;
      setBodyMeasurements(nextMeasurements);
      await AsyncStorage.setItem(storageKeys.measurements, JSON.stringify(nextMeasurements));
    },
    [storageKeys.measurements],
  );

  const clerkFallbackName = useMemo(
    () =>
      user?.fullName?.trim() ||
      user?.firstName?.trim() ||
      user?.primaryEmailAddress?.emailAddress?.split("@")[0]?.trim() ||
      "",
    [user?.firstName, user?.fullName, user?.primaryEmailAddress?.emailAddress],
  );

  useEffect(() => {
    if (!authLoaded) {
      return;
    }

    if (!isSignedIn || !userId) {
      lastSyncedUserIdRef.current = null;
      setProfile(DEFAULT_PROFILE);
      setAccessState(DEFAULT_ACCESS_STATE);
      weightLogRef.current = [];
      bodyMeasurementsRef.current = [];
      setWeightLog([]);
      setBodyMeasurements([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const [storedProfile, storedWeightLog, storedMeasurements] = await Promise.all([
          readScopedValue(storageKeys.profile, PROFILE_STORAGE_KEY),
          readScopedValue(storageKeys.weightLog, WEIGHT_LOG_KEY),
          readScopedValue(storageKeys.measurements, MEASUREMENTS_KEY),
        ]);

        if (cancelled) {
          return;
        }

        setProfile(
          storedProfile ? { ...DEFAULT_PROFILE, ...JSON.parse(storedProfile) } : DEFAULT_PROFILE,
        );
        const parsedWeightLog = storedWeightLog ? JSON.parse(storedWeightLog) : [];
        const parsedMeasurements = storedMeasurements ? JSON.parse(storedMeasurements) : [];
        weightLogRef.current = parsedWeightLog;
        bodyMeasurementsRef.current = parsedMeasurements;
        setWeightLog(parsedWeightLog);
        setBodyMeasurements(parsedMeasurements);
      } catch (e) {
        console.error("Failed to load profile", e);
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
  }, [
    authLoaded,
    isSignedIn,
    storageKeys.measurements,
    storageKeys.profile,
    storageKeys.weightLog,
    userId,
  ]);

  const persistProfile = useCallback(
    async (nextProfile: UserProfile) => {
      profileRef.current = nextProfile;
      setProfile(nextProfile);
      await AsyncStorage.setItem(storageKeys.profile, JSON.stringify(nextProfile));
    },
    [storageKeys.profile],
  );

  const syncProgressFromServer = useCallback(async () => {
    if (!isSignedIn || !userId) {
      return;
    }

    try {
      const apiBase = getApiBase();
      if (!apiBase) return;

      const payload = await authenticatedJsonRequest<unknown[]>({
        apiBase,
        getToken,
        path: "/api/progress/entries",
      });
      const entries = payload
        .map(normalizeProgressEntry)
        .filter((entry): entry is ProgressEntryPayload => Boolean(entry));

      const remoteWeightLog: WeightEntry[] = entries
        .filter((entry) => typeof entry.weight === "number")
        .map((entry) => ({ date: entry.date, weight: entry.weight as number }));
      const remoteMeasurements: BodyMeasurement[] = entries
        .map((entry) => {
          const measurement: BodyMeasurement = {
            date: entry.date,
            ...(typeof entry.chest === "number" ? { chest: entry.chest } : {}),
            ...(typeof entry.waist === "number" ? { waist: entry.waist } : {}),
            ...(typeof entry.hips === "number" ? { hips: entry.hips } : {}),
            ...(typeof entry.biceps === "number" ? { biceps: entry.biceps } : {}),
            ...(typeof entry.thighs === "number" ? { thighs: entry.thighs } : {}),
          };
          return Object.keys(measurement).length > 1 ? measurement : null;
        })
        .filter((entry): entry is BodyMeasurement => Boolean(entry));

      const mergedWeightLog = mergeWeightLogs(weightLogRef.current, remoteWeightLog);
      const mergedMeasurements = mergeBodyMeasurements(
        bodyMeasurementsRef.current,
        remoteMeasurements,
      );

      await Promise.all([
        replaceWeightLog(mergedWeightLog),
        replaceBodyMeasurements(mergedMeasurements),
      ]);

      const latestWeight = mergedWeightLog.at(-1);
      if (latestWeight && latestWeight.weight !== profileRef.current.weight) {
        await persistProfile({ ...profileRef.current, weight: latestWeight.weight });
      }
    } catch (error) {
      console.error("Failed to sync progress entries", error);
    }
  }, [getToken, isSignedIn, persistProfile, replaceBodyMeasurements, replaceWeightLog, userId]);

  const syncProgressEntryToServer = useCallback(
    async (entry: ProgressEntryPayload) => {
      if (!isSignedIn || !userId) {
        return;
      }

      try {
        const apiBase = getApiBase();
        if (!apiBase) return;

        await authenticatedJsonRequest<unknown>({
          apiBase,
          getToken,
          path: "/api/progress/entries",
          method: "POST",
          body: entry,
        });
      } catch (error) {
        console.error("Failed to sync progress entry", error);
      }
    },
    [getToken, isSignedIn, userId],
  );

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      const newProfile = { ...profile, ...updates };
      await persistProfile(newProfile);
    },
    [persistProfile, profile],
  );

  const completeOnboarding = useCallback(
    async (data: Partial<UserProfile>) => {
      const targets = calculateTargets({ ...profile, ...data });
      const newProfile: UserProfile = {
        ...profile,
        ...data,
        ...targets,
        role: profile.role,
        onboardingComplete: true,
      };
      await persistProfile(newProfile);
    },
    [persistProfile, profile],
  );

  const refreshProfile = useCallback(async (): Promise<boolean> => {
    if (!isSignedIn || !userId) {
      return false;
    }

    try {
      const currentProfile = profileRef.current;
      const apiBase = getApiBase();
      if (!apiBase) {
        setAccessState({
          status: "unknown",
          message:
            "We could not reach Fitness Hub services. Check the app connection and try again.",
        });
        return false;
      }

      const token = await getToken();
      if (!token) {
        setAccessState({
          status: "unknown",
          message: "Your secure session expired before we could verify access. Sign in again.",
        });
        return false;
      }

      const fallbackName = currentProfile.name.trim() || clerkFallbackName || "User";

      const refreshResult = await refreshServerProfileAccess({
        apiBase,
        token,
        currentProfile,
        fallbackName,
      });
      if (refreshResult.profileUpdates) {
        const nextProfile: UserProfile = {
          ...currentProfile,
          ...refreshResult.profileUpdates,
        };

        if (nextProfile.name !== currentProfile.name || nextProfile.role !== currentProfile.role) {
          await persistProfile(nextProfile);
        }
      }
      setAccessState(refreshResult.accessState);
      return true;
    } catch (error) {
      console.error("Failed to refresh profile", error);
      setAccessState({
        status: "unknown",
        message: "We could not verify gym access. Check your connection and try again.",
      });
      return false;
    }
  }, [clerkFallbackName, getToken, isSignedIn, persistProfile, userId]);

  useEffect(() => {
    if (!authLoaded || !isSignedIn || !userId || isLoading) {
      return;
    }

    if (lastSyncedUserIdRef.current === userId) {
      return;
    }

    lastSyncedUserIdRef.current = userId;
    let cancelled = false;
    let retryId: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const sync = async () => {
      attempts += 1;
      const didRefresh = await refreshProfile();
      if (cancelled) {
        return;
      }

      if (didRefresh) {
        lastSyncedUserIdRef.current = userId;
        return;
      }

      lastSyncedUserIdRef.current = null;
      if (attempts < 5) {
        retryId = setTimeout(sync, 1200);
      }
    };

    void sync();

    return () => {
      cancelled = true;
      if (retryId) {
        clearTimeout(retryId);
      }
    };
  }, [authLoaded, isLoading, isSignedIn, refreshProfile, userId]);

  useEffect(() => {
    if (!authLoaded || !isSignedIn || !userId || isLoading) {
      return;
    }

    void syncProgressFromServer();
  }, [authLoaded, isLoading, isSignedIn, syncProgressFromServer, userId]);

  useEffect(() => {
    if (!authLoaded || !isSignedIn || !userId) {
      return;
    }

    const refreshAccess = () => {
      void refreshProfile();
    };

    const intervalId = setInterval(refreshAccess, 60_000);

    if (typeof window === "undefined") {
      return () => clearInterval(intervalId);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshAccess();
      }
    };

    window.addEventListener("focus", refreshAccess);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", refreshAccess);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authLoaded, isSignedIn, refreshProfile, userId]);

  const logWeight = useCallback(
    async (weight: number) => {
      const today = getLocalDateKey();
      const updated = weightLog.filter((e) => e.date !== today);
      updated.push({ date: today, weight });
      updated.sort((a, b) => a.date.localeCompare(b.date));
      const newProfile = { ...profile, weight };
      await Promise.all([replaceWeightLog(updated), persistProfile(newProfile)]);
      const existingMeasurement = bodyMeasurementsRef.current.find((entry) => entry.date === today);
      await syncProgressEntryToServer({
        date: today,
        weight,
        ...(existingMeasurement?.chest ? { chest: existingMeasurement.chest } : {}),
        ...(existingMeasurement?.waist ? { waist: existingMeasurement.waist } : {}),
        ...(existingMeasurement?.hips ? { hips: existingMeasurement.hips } : {}),
        ...(existingMeasurement?.biceps ? { biceps: existingMeasurement.biceps } : {}),
        ...(existingMeasurement?.thighs ? { thighs: existingMeasurement.thighs } : {}),
      });
    },
    [persistProfile, profile, replaceWeightLog, syncProgressEntryToServer, weightLog],
  );

  const logMeasurement = useCallback(
    async (measurement: Omit<BodyMeasurement, "date">) => {
      const today = getLocalDateKey();
      const updated = bodyMeasurements.filter((e) => e.date !== today);
      updated.push({ date: today, ...measurement });
      updated.sort((a, b) => a.date.localeCompare(b.date));
      await replaceBodyMeasurements(updated);
      const existingWeight = weightLogRef.current.find((entry) => entry.date === today);
      await syncProgressEntryToServer({
        date: today,
        ...(typeof existingWeight?.weight === "number" ? { weight: existingWeight.weight } : {}),
        ...measurement,
      });
    },
    [bodyMeasurements, replaceBodyMeasurements, syncProgressEntryToServer],
  );

  return (
    <AppContext.Provider
      value={{
        profile,
        accessState,
        updateProfile,
        completeOnboarding,
        refreshProfile,
        isLoading,
        weightLog,
        logWeight,
        bodyMeasurements,
        logMeasurement,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
