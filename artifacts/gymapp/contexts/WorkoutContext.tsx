import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface ExerciseSet {
  id: string;
  weight: number;
  reps: number;
  completed: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  name: string;
  sets: ExerciseSet[];
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  name: string;
  date: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  exercises: WorkoutExercise[];
  notes?: string;
  totalVolume: number;
  caloriesBurned: number;
  completed: boolean;
  aiGenerated?: boolean;
}

export interface PersonalRecord {
  exerciseId: string;
  name: string;
  weight: number;
  reps: number;
  date: string;
}

export interface SavedWorkoutPlanExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  notes?: string;
}

export interface SavedWorkoutPlan {
  id: string;
  name: string;
  focus?: string;
  exercises: SavedWorkoutPlanExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface SaveWorkoutPlanInput {
  id?: string;
  name: string;
  focus?: string;
  exercises: SavedWorkoutPlanExercise[];
}

export interface WorkoutBehaviorProfile {
  workoutsLast7Days: number;
  workoutsLast30Days: number;
  consistencyLabel: "building" | "steady" | "locked-in";
  preferredWorkoutWindow:
    | "morning"
    | "afternoon"
    | "evening"
    | "late-night"
    | "varied";
  averageSessionMinutes: number;
  averageExercisesPerSession: number;
  averageCompletedSets: number;
  topExercises: string[];
  lastWorkoutDate?: string;
  coachingFocus: string;
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export interface SessionSummary {
  session: WorkoutSession;
  newPRs: PersonalRecord[];
}

const STORAGE_KEYS = {
  sessions: "@gymapp_sessions",
  prs: "@gymapp_prs",
  savedPlans: "@gymapp_saved_plans",
  behaviorProfile: "@gymapp_behavior_profile",
} as const;

const EMPTY_BEHAVIOR_PROFILE: WorkoutBehaviorProfile = {
  workoutsLast7Days: 0,
  workoutsLast30Days: 0,
  consistencyLabel: "building",
  preferredWorkoutWindow: "varied",
  averageSessionMinutes: 0,
  averageExercisesPerSession: 0,
  averageCompletedSets: 0,
  topExercises: [],
  coachingFocus:
    "Start with short, repeatable workouts and build a routine you can actually stick to.",
};

function bucketWorkoutWindow(timestamp?: number) {
  if (!timestamp) return "varied";
  const hour = new Date(timestamp).getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "late-night";
}

function deriveBehaviorProfile(
  sessions: WorkoutSession[],
): WorkoutBehaviorProfile {
  const completedSessions = sessions.filter((session) => session.completed);
  if (completedSessions.length === 0) {
    return EMPTY_BEHAVIOR_PROFILE;
  }

  const now = new Date();
  const last7Boundary = new Date(now);
  last7Boundary.setDate(now.getDate() - 7);
  const last30Boundary = new Date(now);
  last30Boundary.setDate(now.getDate() - 30);

  const workoutsLast7Days = completedSessions.filter(
    (session) => new Date(session.date) >= last7Boundary,
  ).length;
  const workoutsLast30Days = completedSessions.filter(
    (session) => new Date(session.date) >= last30Boundary,
  ).length;

  const consistencyLabel: WorkoutBehaviorProfile["consistencyLabel"] =
    workoutsLast7Days >= 4 || workoutsLast30Days >= 16
      ? "locked-in"
      : workoutsLast7Days >= 2 || workoutsLast30Days >= 8
        ? "steady"
        : "building";

  const workoutWindows = completedSessions.reduce<
    Record<WorkoutBehaviorProfile["preferredWorkoutWindow"], number>
  >(
    (acc, session) => {
      const bucket = bucketWorkoutWindow(
        session.startTime || session.endTime || Date.parse(session.date),
      ) as WorkoutBehaviorProfile["preferredWorkoutWindow"];
      acc[bucket] += 1;
      return acc;
    },
    {
      morning: 0,
      afternoon: 0,
      evening: 0,
      "late-night": 0,
      varied: 0,
    },
  );

  const sortedWorkoutWindows = Object.entries(workoutWindows).sort(
    (a, b) => b[1] - a[1],
  );
  const preferredWorkoutWindow =
    sortedWorkoutWindows[0]?.[1] && sortedWorkoutWindows[0][1] > 1
      ? (sortedWorkoutWindows[0][0] as WorkoutBehaviorProfile["preferredWorkoutWindow"])
      : "varied";

  const averageSessionMinutes = Math.round(
    completedSessions.reduce(
      (sum, session) => sum + (session.duration ?? 0),
      0,
    ) / completedSessions.length,
  );

  const averageExercisesPerSession = Math.round(
    completedSessions.reduce(
      (sum, session) => sum + session.exercises.length,
      0,
    ) / completedSessions.length,
  );

  const averageCompletedSets = Math.round(
    completedSessions.reduce(
      (sum, session) =>
        sum +
        session.exercises.reduce(
          (exerciseSum, exercise) =>
            exerciseSum +
            exercise.sets.filter((set) => set.completed).length,
          0,
        ),
      0,
    ) / completedSessions.length,
  );

  const exerciseCounts = completedSessions.reduce<Record<string, number>>(
    (acc, session) => {
      session.exercises.forEach((exercise) => {
        acc[exercise.name] = (acc[exercise.name] ?? 0) + 1;
      });
      return acc;
    },
    {},
  );

  const topExercises = Object.entries(exerciseCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  let coachingFocus =
    "Keep the next workout practical and build confidence through consistent finishes.";
  if (consistencyLabel === "steady") {
    coachingFocus =
      averageSessionMinutes < 40
        ? "Keep workouts efficient, slightly progress volume, and stay easy to repeat."
        : "Progress gradually, keep exercise choices familiar, and protect recovery.";
  } else if (consistencyLabel === "locked-in") {
    coachingFocus =
      "You can handle more variation now. Progress intensity, but avoid unnecessary complexity.";
  }

  const sortedByDate = [...completedSessions].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  return {
    workoutsLast7Days,
    workoutsLast30Days,
    consistencyLabel,
    preferredWorkoutWindow,
    averageSessionMinutes,
    averageExercisesPerSession,
    averageCompletedSets,
    topExercises,
    lastWorkoutDate: sortedByDate[0]?.date,
    coachingFocus,
  };
}

interface WorkoutContextType {
  sessions: WorkoutSession[];
  personalRecords: Record<string, PersonalRecord>;
  savedPlans: SavedWorkoutPlan[];
  behaviorProfile: WorkoutBehaviorProfile;
  activeSession: WorkoutSession | null;
  startSession: (name: string, exercises?: Omit<WorkoutExercise, "id">[]) => WorkoutSession;
  startPlanSession: (planId: string) => WorkoutSession | null;
  endSession: (sessionId: string, caloriesBurned?: number) => Promise<SessionSummary | null>;
  savePlan: (plan: SaveWorkoutPlanInput) => Promise<SavedWorkoutPlan>;
  deletePlan: (planId: string) => Promise<void>;
  addExerciseToSession: (sessionId: string, exercise: Omit<WorkoutExercise, "id">) => void;
  addSetToExercise: (sessionId: string, exerciseId: string, set: Omit<ExerciseSet, "id">) => void;
  updateSet: (sessionId: string, exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  getRecentSessions: (count?: number) => WorkoutSession[];
  getWeeklyVolume: () => { date: string; volume: number }[];
  get30DayVolume: () => { date: string; volume: number }[];
  isLoading: boolean;
}

const WorkoutContext = createContext<WorkoutContextType | null>(null);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [personalRecords, setPersonalRecords] = useState<Record<string, PersonalRecord>>({});
  const [savedPlans, setSavedPlans] = useState<SavedWorkoutPlan[]>([]);
  const [behaviorProfile, setBehaviorProfile] = useState<WorkoutBehaviorProfile>(
    EMPTY_BEHAVIOR_PROFILE,
  );
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [storedSessions, storedPRs, storedPlans, storedBehavior] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.sessions),
            AsyncStorage.getItem(STORAGE_KEYS.prs),
            AsyncStorage.getItem(STORAGE_KEYS.savedPlans),
            AsyncStorage.getItem(STORAGE_KEYS.behaviorProfile),
          ]);
        const parsedSessions: WorkoutSession[] = storedSessions
          ? JSON.parse(storedSessions)
          : [];
        const parsedBehavior: WorkoutBehaviorProfile | null = storedBehavior
          ? JSON.parse(storedBehavior)
          : null;

        setSessions(parsedSessions);
        setBehaviorProfile(parsedBehavior ?? deriveBehaviorProfile(parsedSessions));
        if (!storedBehavior) {
          await AsyncStorage.setItem(
            STORAGE_KEYS.behaviorProfile,
            JSON.stringify(deriveBehaviorProfile(parsedSessions)),
          );
        }
        if (storedPlans) {
          setSavedPlans(JSON.parse(storedPlans));
        }
        if (storedPRs) {
          setPersonalRecords(JSON.parse(storedPRs));
        }
      } catch (e) {
        console.error("Failed to load workouts", e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const saveSessions = useCallback(async (newSessions: WorkoutSession[]) => {
    const nextBehaviorProfile = deriveBehaviorProfile(newSessions);
    setSessions(newSessions);
    setBehaviorProfile(nextBehaviorProfile);
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(newSessions)),
      AsyncStorage.setItem(
        STORAGE_KEYS.behaviorProfile,
        JSON.stringify(nextBehaviorProfile),
      ),
    ]);
  }, []);

  const savePlansToStorage = useCallback(async (newPlans: SavedWorkoutPlan[]) => {
    setSavedPlans(newPlans);
    await AsyncStorage.setItem(STORAGE_KEYS.savedPlans, JSON.stringify(newPlans));
  }, []);

  const startSession = useCallback(
    (name: string, exercises: Omit<WorkoutExercise, "id">[] = []): WorkoutSession => {
      const session: WorkoutSession = {
        id: generateId(),
        name,
        date: new Date().toISOString().split("T")[0],
        startTime: Date.now(),
        exercises: exercises.map((e) => ({ ...e, id: generateId() })),
        totalVolume: 0,
        caloriesBurned: 0,
        completed: false,
      };
      setActiveSession(session);
      return session;
    },
    [],
  );

  const endSession = useCallback(
    async (sessionId: string, caloriesBurned = 0): Promise<SessionSummary | null> => {
      const session = activeSession?.id === sessionId ? activeSession : sessions.find((s) => s.id === sessionId);
      if (!session) return null;

      const totalVolume = session.exercises.reduce(
        (total, ex) =>
          total + ex.sets.filter((s) => s.completed).reduce((sum, s) => sum + s.weight * s.reps, 0),
        0,
      );

      const duration = Math.round((Date.now() - session.startTime) / 60000);
      const completedSession: WorkoutSession = {
        ...session,
        endTime: Date.now(),
        duration,
        totalVolume,
        caloriesBurned: caloriesBurned || Math.round(duration * 6),
        completed: true,
      };

      const newSessions = [completedSession, ...sessions.filter((s) => s.id !== sessionId)];
      await saveSessions(newSessions);

      const newPRs = { ...personalRecords };
      const sessionNewPRs: PersonalRecord[] = [];
      for (const ex of completedSession.exercises) {
        for (const set of ex.sets) {
          if (!set.completed || set.weight === 0) continue;
          const key = ex.exerciseId;
          const current = newPRs[key];
          const oneRM = Math.round(set.weight * (1 + set.reps / 30));
          if (!current || oneRM > current.weight * (1 + current.reps / 30)) {
            const pr: PersonalRecord = { exerciseId: key, name: ex.name, weight: set.weight, reps: set.reps, date: completedSession.date };
            newPRs[key] = pr;
            if (!sessionNewPRs.find((p) => p.exerciseId === key)) {
              sessionNewPRs.push(pr);
            }
          }
        }
      }
      setPersonalRecords(newPRs);
      await AsyncStorage.setItem(STORAGE_KEYS.prs, JSON.stringify(newPRs));
      setActiveSession(null);
      return { session: completedSession, newPRs: sessionNewPRs };
    },
    [activeSession, sessions, personalRecords, saveSessions],
  );

  const savePlan = useCallback(
    async (plan: SaveWorkoutPlanInput): Promise<SavedWorkoutPlan> => {
      const trimmedName = plan.name.trim();
      const trimmedFocus = plan.focus?.trim();
      const normalizedExercises = plan.exercises
        .map((exercise) => ({
          exerciseId: exercise.exerciseId,
          name: exercise.name.trim(),
          sets: Math.max(1, exercise.sets),
          reps: Math.max(1, exercise.reps),
          notes: exercise.notes?.trim() || undefined,
        }))
        .filter((exercise) => exercise.name.length > 0);

      if (!trimmedName || normalizedExercises.length === 0) {
        throw new Error("A saved plan needs a name and at least one exercise.");
      }

      const now = new Date().toISOString();
      const existingPlan = plan.id
        ? savedPlans.find((savedPlan) => savedPlan.id === plan.id)
        : undefined;
      const nextPlan: SavedWorkoutPlan = {
        id: existingPlan?.id ?? generateId(),
        name: trimmedName,
        focus: trimmedFocus || undefined,
        exercises: normalizedExercises,
        createdAt: existingPlan?.createdAt ?? now,
        updatedAt: now,
      };

      const nextPlans = existingPlan
        ? savedPlans.map((savedPlan) =>
            savedPlan.id === existingPlan.id ? nextPlan : savedPlan,
          )
        : [nextPlan, ...savedPlans];

      await savePlansToStorage(nextPlans);
      return nextPlan;
    },
    [savedPlans, savePlansToStorage],
  );

  const deletePlan = useCallback(
    async (planId: string) => {
      await savePlansToStorage(
        savedPlans.filter((savedPlan) => savedPlan.id !== planId),
      );
    },
    [savedPlans, savePlansToStorage],
  );

  const startPlanSession = useCallback(
    (planId: string): WorkoutSession | null => {
      const plan = savedPlans.find((savedPlan) => savedPlan.id === planId);
      if (!plan) return null;

      const exercises = plan.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        notes: exercise.notes,
        sets: Array.from({ length: exercise.sets }, () => ({
          id: generateId(),
          weight: 0,
          reps: exercise.reps,
          completed: false,
        })),
      }));

      return startSession(plan.name, exercises);
    },
    [savedPlans, startSession],
  );

  const addExerciseToSession = useCallback(
    (sessionId: string, exercise: Omit<WorkoutExercise, "id">) => {
      if (!activeSession || activeSession.id !== sessionId) return;
      const updated = {
        ...activeSession,
        exercises: [...activeSession.exercises, { ...exercise, id: generateId() }],
      };
      setActiveSession(updated);
    },
    [activeSession],
  );

  const addSetToExercise = useCallback(
    (sessionId: string, exerciseId: string, set: Omit<ExerciseSet, "id">) => {
      if (!activeSession || activeSession.id !== sessionId) return;
      const newSet: ExerciseSet = { ...set, id: generateId() };
      const updated = {
        ...activeSession,
        exercises: activeSession.exercises.map((ex) =>
          ex.id === exerciseId ? { ...ex, sets: [...ex.sets, newSet] } : ex,
        ),
      };
      setActiveSession(updated);
    },
    [activeSession],
  );

  const updateSet = useCallback(
    (sessionId: string, exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => {
      if (!activeSession || activeSession.id !== sessionId) return;
      const updated = {
        ...activeSession,
        exercises: activeSession.exercises.map((ex) =>
          ex.id === exerciseId
            ? { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...updates } : s)) }
            : ex,
        ),
      };
      setActiveSession(updated);
    },
    [activeSession],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      await saveSessions(sessions.filter((s) => s.id !== sessionId));
    },
    [sessions, saveSessions],
  );

  const getRecentSessions = useCallback(
    (count = 10) => sessions.slice(0, count),
    [sessions],
  );

  const getWeeklyVolume = useCallback(() => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      const dayVolume = sessions
        .filter((s) => s.date === dateKey && s.completed)
        .reduce((sum, s) => sum + s.totalVolume, 0);
      result.push({ date: dateKey, volume: dayVolume });
    }
    return result;
  }, [sessions]);

  const get30DayVolume = useCallback(() => {
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      const dayVolume = sessions
        .filter((s) => s.date === dateKey && s.completed)
        .reduce((sum, s) => sum + s.totalVolume, 0);
      result.push({ date: dateKey, volume: dayVolume });
    }
    return result;
  }, [sessions]);

  return (
    <WorkoutContext.Provider
      value={{
        sessions,
        personalRecords,
        savedPlans,
        behaviorProfile,
        activeSession,
        startSession,
        startPlanSession,
        endSession,
        savePlan,
        deletePlan,
        addExerciseToSession,
        addSetToExercise,
        updateSet,
        deleteSession,
        getRecentSessions,
        getWeeklyVolume,
        get30DayVolume,
        isLoading,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error("useWorkout must be used within WorkoutProvider");
  return ctx;
}
