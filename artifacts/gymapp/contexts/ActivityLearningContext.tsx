import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import React, { useEffect, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { useNutrition } from "@/contexts/NutritionContext";
import { useWorkout } from "@/contexts/WorkoutContext";
import { getApiBase } from "@/lib/api-base";
import { authenticatedJsonRequest } from "@/lib/authenticated-api";
import { getLocalDateKey } from "@/lib/date-key";

const ACTIVITY_LEARNING_STORAGE_KEY = "@gymapp_activity_learning_sync";
const SYNC_DEBOUNCE_MS = 1500;

interface LastSyncState {
  date: string;
  signature: string;
}

function safeParseLastSync(value: string | null): LastSyncState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<LastSyncState>;
    return typeof parsed.date === "string" && typeof parsed.signature === "string"
      ? { date: parsed.date, signature: parsed.signature }
      : null;
  } catch {
    return null;
  }
}

export function ActivityLearningProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded: authLoaded, isSignedIn, userId } = useAuth();
  const { profile, accessState, isLoading: profileLoading } = useApp();
  const { todayLog, isLoading: nutritionLoading } = useNutrition();
  const { sessions, behaviorProfile, savedPlans, isLoading: workoutLoading } = useWorkout();

  const snapshot = useMemo(() => {
    const date = todayLog.date || getLocalDateKey();
    const nutritionTotals = todayLog.entries.reduce(
      (acc, entry) => ({
        calories: acc.calories + entry.calories,
        protein: acc.protein + entry.protein,
        carbs: acc.carbs + entry.carbs,
        fat: acc.fat + entry.fat,
        fiber: acc.fiber + entry.fiber,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    );

    const completedSessions = sessions
      .filter((session) => session.completed)
      .slice()
      .sort((a, b) => (b.endTime ?? b.startTime) - (a.endTime ?? a.startTime));
    const todayCompletedSessions = completedSessions.filter((session) => session.date === date);

    const timezone =
      typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "local";

    return {
      date,
      timezone,
      profile: {
        goal: profile.fitnessGoal,
        dietType: profile.dietType,
        activityLevel: profile.activityLevel,
        fitnessExperience: profile.fitnessExperience,
        equipment: profile.equipment,
        injuries: profile.injuries,
        workoutTime: profile.workoutTime,
        mealTiming: profile.mealTiming,
        dailyCalorieTarget: profile.dailyCalorieTarget,
        dailyProteinTarget: profile.dailyProteinTarget,
        dailyCarbTarget: profile.dailyCarbTarget,
        dailyFatTarget: profile.dailyFatTarget,
      },
      nutrition: {
        ...nutritionTotals,
        waterIntake: todayLog.waterIntake,
        entriesCount: todayLog.entries.length,
        mealTypesLogged: Array.from(new Set(todayLog.entries.map((entry) => entry.mealType))),
      },
      workout: {
        completedToday: todayCompletedSessions.length,
        totalVolumeToday: todayCompletedSessions.reduce(
          (sum, session) => sum + session.totalVolume,
          0,
        ),
        caloriesBurnedToday: todayCompletedSessions.reduce(
          (sum, session) => sum + session.caloriesBurned,
          0,
        ),
        recentSessions: completedSessions.slice(0, 5).map((session) => ({
          name: session.name,
          date: session.date,
          duration: session.duration ?? 0,
          totalVolume: session.totalVolume,
          caloriesBurned: session.caloriesBurned,
          exerciseNames: session.exercises.map((exercise) => exercise.name).slice(0, 8),
        })),
      },
      behaviorProfile,
      savedPlans: savedPlans.slice(0, 5).map((plan) => ({
        name: plan.name,
        focus: plan.focus,
        exerciseCount: plan.exercises.length,
        exercises: plan.exercises.slice(0, 8).map((exercise) => exercise.name),
      })),
    };
  }, [behaviorProfile, profile, savedPlans, sessions, todayLog]);

  const signature = useMemo(() => JSON.stringify(snapshot), [snapshot]);
  const hasMeaningfulActivity =
    snapshot.nutrition.entriesCount > 0 ||
    snapshot.nutrition.waterIntake > 0 ||
    snapshot.workout.completedToday > 0 ||
    snapshot.workout.recentSessions.length > 0 ||
    snapshot.savedPlans.length > 0;

  useEffect(() => {
    if (
      !authLoaded ||
      !isSignedIn ||
      !userId ||
      profileLoading ||
      nutritionLoading ||
      workoutLoading ||
      !profile.onboardingComplete ||
      accessState.status !== "approved" ||
      !hasMeaningfulActivity
    ) {
      return;
    }

    let cancelled = false;
    const storageKey = `${ACTIVITY_LEARNING_STORAGE_KEY}:${userId}`;
    const timeoutId = setTimeout(async () => {
      try {
        const apiBase = getApiBase();
        if (!apiBase) {
          return;
        }

        const lastSync = safeParseLastSync(await AsyncStorage.getItem(storageKey));
        if (lastSync?.date === snapshot.date && lastSync.signature === signature) {
          return;
        }

        if (cancelled) {
          return;
        }

        await authenticatedJsonRequest<unknown>({
          apiBase,
          getToken,
          path: "/api/ai/activity-snapshot",
          method: "POST",
          body: snapshot,
        });

        if (!cancelled) {
          await AsyncStorage.setItem(
            storageKey,
            JSON.stringify({ date: snapshot.date, signature }),
          );
        }
      } catch (error) {
        console.error("Failed to sync activity learning snapshot", error);
      }
    }, SYNC_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    accessState.status,
    authLoaded,
    getToken,
    hasMeaningfulActivity,
    isSignedIn,
    nutritionLoading,
    profile.onboardingComplete,
    profileLoading,
    signature,
    snapshot,
    userId,
    workoutLoading,
  ]);

  return <>{children}</>;
}
