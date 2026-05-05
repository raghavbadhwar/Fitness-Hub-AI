import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import { getApiBase } from "@/lib/api-base";
import { getLocalDateKey } from "@/lib/date-key";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  createdAt: string;
  updatedAt: string;
  source: "member";
  exercises: SavedWorkoutPlanExercise[];
}

export interface SaveWorkoutPlanInput {
  id?: string;
  name: string;
  focus?: string;
  exercises: SavedWorkoutPlanExercise[];
}

export interface WorkoutBehaviorProfile {
  completedSessionsLast7Days: number;
  completedSessionsLast30Days: number;
  daysSinceLastWorkout: number | null;
  averageDurationMinutes: number;
  averageWeeklyVolume: number;
  favoriteExerciseNames: string[];
  preferredWorkoutNames: string[];
  preferredTrainingWindow: "morning" | "afternoon" | "evening" | "night" | "mixed";
  consistencyLabel: "starting" | "building" | "steady" | "locked_in";
  recoveryState: "fresh" | "active" | "drifting";
}

export interface SessionSummary {
  session: WorkoutSession;
  newPRs: PersonalRecord[];
}

interface WorkoutContextType {
  sessions: WorkoutSession[];
  personalRecords: Record<string, PersonalRecord>;
  savedPlans: SavedWorkoutPlan[];
  behaviorProfile: WorkoutBehaviorProfile;
  activeSession: WorkoutSession | null;
  startSession: (name: string, exercises?: Omit<WorkoutExercise, "id">[]) => WorkoutSession;
  endSession: (sessionId: string, caloriesBurned?: number) => Promise<SessionSummary | null>;
  addExerciseToSession: (sessionId: string, exercise: Omit<WorkoutExercise, "id">) => void;
  addSetToExercise: (sessionId: string, exerciseId: string, set: Omit<ExerciseSet, "id">) => void;
  updateSet: (
    sessionId: string,
    exerciseId: string,
    setId: string,
    updates: Partial<ExerciseSet>,
  ) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  savePlan: (input: SaveWorkoutPlanInput) => Promise<SavedWorkoutPlan>;
  deletePlan: (planId: string) => Promise<void>;
  startPlanSession: (planId: string) => WorkoutSession | null;
  getRecentSessions: (count?: number) => WorkoutSession[];
  getWeeklyVolume: () => { date: string; volume: number }[];
  get30DayVolume: () => { date: string; volume: number }[];
  isLoading: boolean;
}

const SESSIONS_STORAGE_KEY = "@gymapp_sessions";
const PRS_STORAGE_KEY = "@gymapp_prs";
const SAVED_PLANS_STORAGE_KEY = "@gymapp_saved_plans";

const DEFAULT_BEHAVIOR_PROFILE: WorkoutBehaviorProfile = {
  completedSessionsLast7Days: 0,
  completedSessionsLast30Days: 0,
  daysSinceLastWorkout: null,
  averageDurationMinutes: 0,
  averageWeeklyVolume: 0,
  favoriteExerciseNames: [],
  preferredWorkoutNames: [],
  preferredTrainingWindow: "mixed",
  consistencyLabel: "starting",
  recoveryState: "fresh",
};

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error("Failed to parse stored workout data", error);
    return fallback;
  }
}

function requireApiBaseOrThrow() {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new Error("API base URL is not configured for workout sync.");
  }
  return apiBase;
}

function clampPositiveInteger(value: number, minimum = 1): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.round(value)) : minimum;
}

function normalizeSavedPlan(value: unknown): SavedWorkoutPlan | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!id || !name || !Array.isArray(record.exercises)) {
    return null;
  }

  const exercises: SavedWorkoutPlanExercise[] = [];
  for (const exercise of record.exercises) {
    if (!exercise || typeof exercise !== "object") continue;
    const exerciseRecord = exercise as Record<string, unknown>;
    const exerciseName = typeof exerciseRecord.name === "string" ? exerciseRecord.name.trim() : "";
    if (!exerciseName) continue;

    exercises.push({
      exerciseId:
        typeof exerciseRecord.exerciseId === "string"
          ? exerciseRecord.exerciseId
          : String(exerciseRecord.exerciseId ?? ""),
      name: exerciseName,
      sets: clampPositiveInteger(
        typeof exerciseRecord.sets === "number"
          ? exerciseRecord.sets
          : parseInt(String(exerciseRecord.sets ?? 1), 10) || 1,
      ),
      reps: clampPositiveInteger(
        typeof exerciseRecord.reps === "number"
          ? exerciseRecord.reps
          : parseInt(String(exerciseRecord.reps ?? 1), 10) || 1,
      ),
      ...(typeof exerciseRecord.notes === "string" && exerciseRecord.notes.trim()
        ? { notes: exerciseRecord.notes.trim() }
        : {}),
    });
  }

  if (!exercises.length) return null;

  const createdAt =
    typeof record.createdAt === "string" && record.createdAt
      ? record.createdAt
      : new Date().toISOString();
  const updatedAt =
    typeof record.updatedAt === "string" && record.updatedAt ? record.updatedAt : createdAt;

  return {
    id,
    name,
    focus:
      typeof record.focus === "string" && record.focus.trim() ? record.focus.trim() : undefined,
    createdAt,
    updatedAt,
    source: "member",
    exercises,
  };
}

const WorkoutContext = createContext<WorkoutContextType | null>(null);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const { getToken, userId, isLoaded } = useAuth();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [personalRecords, setPersonalRecords] = useState<Record<string, PersonalRecord>>({});
  const [savedPlans, setSavedPlans] = useState<SavedWorkoutPlan[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const savedPlansRef = useRef<SavedWorkoutPlan[]>([]);
  const getTokenRef = useRef(getToken);
  const storageKeys = useMemo(
    () => ({
      sessions: `${SESSIONS_STORAGE_KEY}:${userId ?? "guest"}`,
      personalRecords: `${PRS_STORAGE_KEY}:${userId ?? "guest"}`,
      savedPlans: `${SAVED_PLANS_STORAGE_KEY}:${userId ?? "guest"}`,
    }),
    [userId],
  );

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const replaceSavedPlans = useCallback(
    async (nextPlans: SavedWorkoutPlan[]) => {
      savedPlansRef.current = nextPlans;
      setSavedPlans(nextPlans);
      await AsyncStorage.setItem(storageKeys.savedPlans, JSON.stringify(nextPlans));
    },
    [storageKeys.savedPlans],
  );

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [storedSessions, storedPRs, storedPlans] = await Promise.all([
          AsyncStorage.getItem(storageKeys.sessions),
          AsyncStorage.getItem(storageKeys.personalRecords),
          AsyncStorage.getItem(storageKeys.savedPlans),
        ]);
        setSessions(safeParse(storedSessions, []));
        setPersonalRecords(safeParse(storedPRs, {}));
        const parsedPlans = safeParse<unknown[]>(storedPlans, [])
          .map(normalizeSavedPlan)
          .filter((plan): plan is SavedWorkoutPlan => Boolean(plan));
        setSavedPlans(parsedPlans);
        savedPlansRef.current = parsedPlans;
        setActiveSession(null);
      } catch (e) {
        console.error("Failed to load workouts", e);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [storageKeys.personalRecords, storageKeys.savedPlans, storageKeys.sessions]);

  const fetchSavedPlans = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      const token = await getTokenRef.current();
      if (!token) {
        throw new Error("Missing auth token");
      }
      const apiBase = requireApiBaseOrThrow();

      const response = await fetch(`${apiBase}/api/workouts/member-plans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch saved workout plans (${response.status})`);
      }

      const payload = safeParse<unknown[]>(await response.text(), []);
      const remotePlans = payload
        .map(normalizeSavedPlan)
        .filter((plan): plan is SavedWorkoutPlan => Boolean(plan));
      await replaceSavedPlans(remotePlans);
    } catch (error) {
      console.error("Failed to sync saved workout plans", error);
    }
  }, [replaceSavedPlans, userId]);

  useEffect(() => {
    if (!isLoaded) return;
    void fetchSavedPlans();
  }, [fetchSavedPlans, isLoaded]);

  const saveSessions = useCallback(
    async (newSessions: WorkoutSession[]) => {
      setSessions(newSessions);
      await AsyncStorage.setItem(storageKeys.sessions, JSON.stringify(newSessions));
    },
    [storageKeys.sessions],
  );

  const startSession = useCallback(
    (name: string, exercises: Omit<WorkoutExercise, "id">[] = []): WorkoutSession => {
      const session: WorkoutSession = {
        id: generateId(),
        name,
        date: getLocalDateKey(),
        startTime: Date.now(),
        exercises: exercises.map((exercise) => ({ ...exercise, id: generateId() })),
        totalVolume: 0,
        caloriesBurned: 0,
        completed: false,
      };
      setActiveSession(session);
      return session;
    },
    [],
  );

  const behaviorProfile = useMemo<WorkoutBehaviorProfile>(() => {
    const completedSessions = sessions
      .filter((session) => session.completed)
      .slice()
      .sort((a, b) => {
        const aTime = a.endTime ?? a.startTime;
        const bTime = b.endTime ?? b.startTime;
        return bTime - aTime;
      });

    if (completedSessions.length === 0) {
      return DEFAULT_BEHAVIOR_PROFILE;
    }

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const recent7 = completedSessions.filter((session) => {
      const completedAt = session.endTime ?? session.startTime;
      return completedAt >= sevenDaysAgo;
    });
    const recent30 = completedSessions.filter((session) => {
      const completedAt = session.endTime ?? session.startTime;
      return completedAt >= thirtyDaysAgo;
    });

    const latestSession = completedSessions[0];
    const latestCompletedAt = latestSession?.endTime ?? latestSession?.startTime ?? null;
    const daysSinceLastWorkout =
      latestCompletedAt === null
        ? null
        : Math.max(0, Math.floor((now - latestCompletedAt) / 86400000));

    const averageDurationMinutes = Math.round(
      completedSessions.reduce((sum, session) => sum + (session.duration ?? 0), 0) /
        completedSessions.length,
    );

    const averageWeeklyVolume = Math.round(
      recent30.reduce((sum, session) => sum + session.totalVolume, 0) / (30 / 7),
    );

    const exerciseCounts = new Map<string, number>();
    const workoutCounts = new Map<string, number>();
    const windowCounts = new Map<WorkoutBehaviorProfile["preferredTrainingWindow"], number>([
      ["morning", 0],
      ["afternoon", 0],
      ["evening", 0],
      ["night", 0],
      ["mixed", 0],
    ]);

    for (const session of completedSessions) {
      workoutCounts.set(session.name, (workoutCounts.get(session.name) ?? 0) + 1);
      const hour = new Date(session.startTime).getHours();
      const window =
        hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
      windowCounts.set(window, (windowCounts.get(window) ?? 0) + 1);

      for (const exercise of session.exercises) {
        exerciseCounts.set(exercise.name, (exerciseCounts.get(exercise.name) ?? 0) + 1);
      }
    }

    const favoriteExerciseNames = [...exerciseCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name);

    const preferredWorkoutNames = [...workoutCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    const preferredTrainingWindow =
      [...windowCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "mixed";

    const consistencyLabel =
      recent7.length >= 4
        ? "locked_in"
        : recent7.length >= 3
          ? "steady"
          : recent7.length >= 1
            ? "building"
            : "starting";

    const recoveryState =
      daysSinceLastWorkout === null || daysSinceLastWorkout <= 1
        ? "active"
        : daysSinceLastWorkout <= 4
          ? "fresh"
          : "drifting";

    return {
      completedSessionsLast7Days: recent7.length,
      completedSessionsLast30Days: recent30.length,
      daysSinceLastWorkout,
      averageDurationMinutes,
      averageWeeklyVolume,
      favoriteExerciseNames,
      preferredWorkoutNames,
      preferredTrainingWindow,
      consistencyLabel,
      recoveryState,
    };
  }, [sessions]);

  const endSession = useCallback(
    async (sessionId: string, caloriesBurned = 0): Promise<SessionSummary | null> => {
      const session =
        activeSession?.id === sessionId
          ? activeSession
          : sessions.find((entry) => entry.id === sessionId);
      if (!session) return null;

      const totalVolume = session.exercises.reduce(
        (total, exercise) =>
          total +
          exercise.sets
            .filter((set) => set.completed)
            .reduce((sum, set) => sum + set.weight * set.reps, 0),
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

      const newSessions = [completedSession, ...sessions.filter((entry) => entry.id !== sessionId)];
      await saveSessions(newSessions);

      const newPRs = { ...personalRecords };
      const sessionNewPRs: PersonalRecord[] = [];
      for (const exercise of completedSession.exercises) {
        for (const set of exercise.sets) {
          if (!set.completed || set.weight === 0) continue;
          const key = exercise.exerciseId;
          const current = newPRs[key];
          const oneRM = Math.round(set.weight * (1 + set.reps / 30));
          if (!current || oneRM > current.weight * (1 + current.reps / 30)) {
            const pr: PersonalRecord = {
              exerciseId: key,
              name: exercise.name,
              weight: set.weight,
              reps: set.reps,
              date: completedSession.date,
            };
            newPRs[key] = pr;
            if (!sessionNewPRs.find((entry) => entry.exerciseId === key)) {
              sessionNewPRs.push(pr);
            }
          }
        }
      }

      setPersonalRecords(newPRs);
      await AsyncStorage.setItem(storageKeys.personalRecords, JSON.stringify(newPRs));
      setActiveSession(null);
      return { session: completedSession, newPRs: sessionNewPRs };
    },
    [activeSession, personalRecords, saveSessions, sessions, storageKeys.personalRecords],
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
        exercises: activeSession.exercises.map((exercise) =>
          exercise.id === exerciseId ? { ...exercise, sets: [...exercise.sets, newSet] } : exercise,
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
        exercises: activeSession.exercises.map((exercise) =>
          exercise.id === exerciseId
            ? {
                ...exercise,
                sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...updates } : set)),
              }
            : exercise,
        ),
      };
      setActiveSession(updated);
    },
    [activeSession],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      await saveSessions(sessions.filter((session) => session.id !== sessionId));
    },
    [saveSessions, sessions],
  );

  const savePlan = useCallback(
    async (input: SaveWorkoutPlanInput): Promise<SavedWorkoutPlan> => {
      const name = input.name.trim();
      const focus = input.focus?.trim() || undefined;
      const exercises = input.exercises
        .map((exercise) => ({
          exerciseId: exercise.exerciseId,
          name: exercise.name.trim(),
          sets: clampPositiveInteger(exercise.sets),
          reps: clampPositiveInteger(exercise.reps),
          notes: exercise.notes?.trim() || undefined,
        }))
        .filter((exercise) => exercise.name.length > 0);

      if (!name) {
        throw new Error("Plan name is required");
      }
      if (!exercises.length) {
        throw new Error("At least one exercise is required");
      }

      if (userId) {
        const token = await getToken();
        if (!token) {
          throw new Error("Missing auth token");
        }
        const apiBase = requireApiBaseOrThrow();

        const endpoint = input.id
          ? `${apiBase}/api/workouts/member-plans/${encodeURIComponent(input.id)}`
          : `${apiBase}/api/workouts/member-plans`;
        const response = await fetch(endpoint, {
          method: input.id ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name, focus, exercises }),
        });

        if (!response.ok) {
          const payload = safeParse<Record<string, string> | null>(await response.text(), null);
          throw new Error(payload?.error || "Failed to save workout plan");
        }

        const normalizedPlan = normalizeSavedPlan(safeParse<unknown>(await response.text(), null));
        if (!normalizedPlan) {
          throw new Error("Saved workout plan response was invalid");
        }

        const currentPlans = savedPlansRef.current;
        const nextPlans = currentPlans.some((plan) => plan.id === normalizedPlan.id)
          ? currentPlans.map((plan) => (plan.id === normalizedPlan.id ? normalizedPlan : plan))
          : [normalizedPlan, ...currentPlans];
        await replaceSavedPlans(nextPlans);
        return normalizedPlan;
      }

      const timestamp = new Date().toISOString();
      const currentPlans = savedPlansRef.current;
      const existingPlan = input.id ? currentPlans.find((plan) => plan.id === input.id) : undefined;
      const nextPlan: SavedWorkoutPlan = {
        id: input.id ?? generateId(),
        name,
        focus,
        createdAt: existingPlan?.createdAt ?? timestamp,
        updatedAt: timestamp,
        source: "member",
        exercises,
      };

      const nextPlans = existingPlan
        ? currentPlans.map((plan) => (plan.id === existingPlan.id ? nextPlan : plan))
        : [nextPlan, ...currentPlans];

      await replaceSavedPlans(nextPlans);
      return nextPlan;
    },
    [getToken, replaceSavedPlans, userId],
  );

  const deletePlan = useCallback(
    async (planId: string) => {
      if (userId) {
        const token = await getToken();
        if (!token) {
          throw new Error("Missing auth token");
        }
        const apiBase = requireApiBaseOrThrow();

        const response = await fetch(
          `${apiBase}/api/workouts/member-plans/${encodeURIComponent(planId)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!response.ok) {
          const payload = safeParse<Record<string, string> | null>(await response.text(), null);
          throw new Error(payload?.error || "Failed to delete workout plan");
        }
      }

      const nextPlans = savedPlansRef.current.filter((plan) => plan.id !== planId);
      await replaceSavedPlans(nextPlans);
    },
    [getToken, replaceSavedPlans, userId],
  );

  const startPlanSession = useCallback(
    (planId: string): WorkoutSession | null => {
      const plan = savedPlansRef.current.find((entry) => entry.id === planId);
      if (!plan) return null;

      const exercises = plan.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        notes: exercise.notes,
        sets: Array.from({ length: clampPositiveInteger(exercise.sets) }, () => ({
          id: generateId(),
          weight: 0,
          reps: clampPositiveInteger(exercise.reps),
          completed: false,
        })),
      }));

      return startSession(plan.name, exercises);
    },
    [startSession],
  );

  const getRecentSessions = useCallback((count = 10) => sessions.slice(0, count), [sessions]);

  const getWeeklyVolume = useCallback(() => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = getLocalDateKey(date);
      const dayVolume = sessions
        .filter((session) => session.date === dateKey && session.completed)
        .reduce((sum, session) => sum + session.totalVolume, 0);
      result.push({ date: dateKey, volume: dayVolume });
    }
    return result;
  }, [sessions]);

  const get30DayVolume = useCallback(() => {
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = getLocalDateKey(date);
      const dayVolume = sessions
        .filter((session) => session.date === dateKey && session.completed)
        .reduce((sum, session) => sum + session.totalVolume, 0);
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
        endSession,
        addExerciseToSession,
        addSetToExercise,
        updateSet,
        deleteSession,
        savePlan,
        deletePlan,
        startPlanSession,
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
