import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import { getApiBase } from "@/lib/api-base";
import { AuthenticatedApiError, authenticatedJsonRequest } from "@/lib/authenticated-api";
import { getLocalDateKey } from "@/lib/date-key";
import { generateId } from "@/lib/id";
import { decodeVersionedWithLegacyFallback, encodeVersioned } from "@/lib/versioned-storage";
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

function normalizeWorkoutSession(value: unknown): WorkoutSession | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : "";
  const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : "";
  const date = typeof record.date === "string" && record.date.trim() ? record.date.trim() : "";
  const startTime =
    typeof record.startTime === "number" ? record.startTime : Number(record.startTime);
  if (!id || !name || !date || !Number.isFinite(startTime) || !Array.isArray(record.exercises)) {
    return null;
  }

  const exercises: WorkoutExercise[] = record.exercises
    .map((exercise): WorkoutExercise | null => {
      if (!exercise || typeof exercise !== "object") return null;
      const exerciseRecord = exercise as Record<string, unknown>;
      const exerciseName =
        typeof exerciseRecord.name === "string" ? exerciseRecord.name.trim() : "";
      if (!exerciseName || !Array.isArray(exerciseRecord.sets)) return null;
      const sets: ExerciseSet[] = exerciseRecord.sets
        .map((set) => {
          if (!set || typeof set !== "object") return null;
          const setRecord = set as Record<string, unknown>;
          const weight =
            typeof setRecord.weight === "number" ? setRecord.weight : Number(setRecord.weight);
          const reps = typeof setRecord.reps === "number" ? setRecord.reps : Number(setRecord.reps);
          return {
            id:
              typeof setRecord.id === "string" && setRecord.id.trim()
                ? setRecord.id.trim()
                : generateId(),
            weight: Number.isFinite(weight) ? Math.max(0, Math.round(weight)) : 0,
            reps: Number.isFinite(reps) ? Math.max(0, Math.round(reps)) : 0,
            completed: Boolean(setRecord.completed),
          };
        })
        .filter((set): set is ExerciseSet => Boolean(set));

      return {
        id:
          typeof exerciseRecord.id === "string" && exerciseRecord.id.trim()
            ? exerciseRecord.id.trim()
            : generateId(),
        exerciseId:
          typeof exerciseRecord.exerciseId === "string" && exerciseRecord.exerciseId.trim()
            ? exerciseRecord.exerciseId.trim()
            : exerciseName,
        name: exerciseName,
        sets,
        ...(typeof exerciseRecord.notes === "string" && exerciseRecord.notes.trim()
          ? { notes: exerciseRecord.notes.trim() }
          : {}),
      };
    })
    .filter((exercise): exercise is WorkoutExercise => Boolean(exercise));

  const endTime =
    record.endTime === null || typeof record.endTime === "undefined"
      ? NaN
      : typeof record.endTime === "number"
        ? record.endTime
        : Number(record.endTime);
  const duration =
    record.duration === null || typeof record.duration === "undefined"
      ? NaN
      : typeof record.duration === "number"
        ? record.duration
        : Number(record.duration);
  const totalVolume =
    typeof record.totalVolume === "number" ? record.totalVolume : Number(record.totalVolume);
  const caloriesBurned =
    typeof record.caloriesBurned === "number"
      ? record.caloriesBurned
      : Number(record.caloriesBurned);

  return {
    id,
    name,
    date,
    startTime,
    endTime: Number.isFinite(endTime) ? endTime : undefined,
    duration: Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : undefined,
    exercises,
    notes:
      typeof record.notes === "string" && record.notes.trim() ? record.notes.trim() : undefined,
    totalVolume: Number.isFinite(totalVolume) ? Math.max(0, Math.round(totalVolume)) : 0,
    caloriesBurned: Number.isFinite(caloriesBurned) ? Math.max(0, Math.round(caloriesBurned)) : 0,
    completed: Boolean(record.completed),
    aiGenerated: Boolean(record.aiGenerated),
  };
}

function normalizePersonalRecord(value: unknown): PersonalRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const exerciseId =
    typeof record.exerciseId === "string" && record.exerciseId.trim()
      ? record.exerciseId.trim()
      : "";
  const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : "";
  const date = typeof record.date === "string" && record.date.trim() ? record.date.trim() : "";
  const weight = typeof record.weight === "number" ? record.weight : Number(record.weight);
  const reps = typeof record.reps === "number" ? record.reps : Number(record.reps);
  if (!exerciseId || !name || !date || !Number.isFinite(weight) || !Number.isFinite(reps)) {
    return null;
  }

  return {
    exerciseId,
    name,
    date,
    weight: Math.max(0, Math.round(weight)),
    reps: Math.max(0, Math.round(reps)),
  };
}

function normalizePersonalRecords(value: unknown): Record<string, PersonalRecord> {
  if (!value || typeof value !== "object") return {};
  const records: Record<string, PersonalRecord> = {};
  for (const [key, candidate] of Object.entries(value as Record<string, unknown>)) {
    const record = normalizePersonalRecord(candidate);
    if (record) {
      records[record.exerciseId || key] = record;
    }
  }
  return records;
}

function mergeSessions(remoteSessions: WorkoutSession[], localSessions: WorkoutSession[]) {
  const byId = new Map<string, WorkoutSession>();
  for (const session of localSessions) byId.set(session.id, session);
  for (const session of remoteSessions) byId.set(session.id, session);
  return [...byId.values()].sort((left, right) => {
    const leftTime = left.endTime ?? left.startTime;
    const rightTime = right.endTime ?? right.startTime;
    return rightTime - leftTime;
  });
}

const WorkoutContext = createContext<WorkoutContextType | null>(null);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const { getToken, userId, isLoaded } = useAuth();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [personalRecords, setPersonalRecords] = useState<Record<string, PersonalRecord>>({});
  const [savedPlans, setSavedPlans] = useState<SavedWorkoutPlan[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionsRef = useRef<WorkoutSession[]>([]);
  const personalRecordsRef = useRef<Record<string, PersonalRecord>>({});
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

  const replaceSessions = useCallback(
    async (nextSessions: WorkoutSession[]) => {
      sessionsRef.current = nextSessions;
      setSessions(nextSessions);
      await AsyncStorage.setItem(storageKeys.sessions, encodeVersioned(nextSessions));
    },
    [storageKeys.sessions],
  );

  const replacePersonalRecords = useCallback(
    async (nextRecords: Record<string, PersonalRecord>) => {
      personalRecordsRef.current = nextRecords;
      setPersonalRecords(nextRecords);
      await AsyncStorage.setItem(storageKeys.personalRecords, encodeVersioned(nextRecords));
    },
    [storageKeys.personalRecords],
  );

  const replaceSavedPlans = useCallback(
    async (nextPlans: SavedWorkoutPlan[]) => {
      savedPlansRef.current = nextPlans;
      setSavedPlans(nextPlans);
      await AsyncStorage.setItem(storageKeys.savedPlans, encodeVersioned(nextPlans));
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
        const [legacySessions, legacyPRs, legacyPlans] = await Promise.all([
          storageKeys.sessions !== SESSIONS_STORAGE_KEY
            ? AsyncStorage.getItem(SESSIONS_STORAGE_KEY)
            : null,
          storageKeys.personalRecords !== PRS_STORAGE_KEY
            ? AsyncStorage.getItem(PRS_STORAGE_KEY)
            : null,
          storageKeys.savedPlans !== SAVED_PLANS_STORAGE_KEY
            ? AsyncStorage.getItem(SAVED_PLANS_STORAGE_KEY)
            : null,
        ]);
        const sessionsResult = decodeVersionedWithLegacyFallback<WorkoutSession[]>(
          storedSessions,
          legacySessions,
          [],
        );
        const personalRecordsResult = decodeVersionedWithLegacyFallback<
          Record<string, PersonalRecord>
        >(storedPRs, legacyPRs, {});
        const savedPlansResult = decodeVersionedWithLegacyFallback<unknown[]>(
          storedPlans,
          legacyPlans,
          [],
        );

        sessionsRef.current = sessionsResult.value;
        personalRecordsRef.current = personalRecordsResult.value;
        setSessions(sessionsResult.value);
        setPersonalRecords(personalRecordsResult.value);
        const parsedPlans = savedPlansResult.value
          .map(normalizeSavedPlan)
          .filter((plan): plan is SavedWorkoutPlan => Boolean(plan));
        setSavedPlans(parsedPlans);
        savedPlansRef.current = parsedPlans;
        setActiveSession(null);

        const migrations: Array<Promise<void>> = [];
        if (sessionsResult.shouldMigrate) {
          migrations.push(
            AsyncStorage.setItem(storageKeys.sessions, encodeVersioned(sessionsResult.value)),
          );
        }
        if (personalRecordsResult.shouldMigrate) {
          migrations.push(
            AsyncStorage.setItem(
              storageKeys.personalRecords,
              encodeVersioned(personalRecordsResult.value),
            ),
          );
        }
        if (savedPlansResult.shouldMigrate) {
          migrations.push(
            AsyncStorage.setItem(storageKeys.savedPlans, encodeVersioned(parsedPlans)),
          );
        }

        if (migrations.length > 0) {
          await Promise.all(migrations);
        }
      } catch (e) {
        console.error("Failed to load workouts", e);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [storageKeys.personalRecords, storageKeys.savedPlans, storageKeys.sessions]);

  const fetchWorkoutSync = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      const apiBase = requireApiBaseOrThrow();

      const [sessionsPayload, recordsPayload] = await Promise.all([
        authenticatedJsonRequest<unknown[]>({
          apiBase,
          getToken: getTokenRef.current,
          path: "/api/workouts/sessions",
        }),
        authenticatedJsonRequest<Record<string, unknown>>({
          apiBase,
          getToken: getTokenRef.current,
          path: "/api/workouts/personal-records",
        }),
      ]);

      const remoteSessions = sessionsPayload
        .map(normalizeWorkoutSession)
        .filter((session): session is WorkoutSession => Boolean(session));
      const remoteRecords = normalizePersonalRecords(recordsPayload);

      await Promise.all([
        replaceSessions(mergeSessions(remoteSessions, sessionsRef.current)),
        replacePersonalRecords({ ...personalRecordsRef.current, ...remoteRecords }),
      ]);
    } catch (error) {
      console.error("Failed to sync workout history", error);
    }
  }, [replacePersonalRecords, replaceSessions, userId]);

  const fetchSavedPlans = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      const apiBase = requireApiBaseOrThrow();

      const payload = await authenticatedJsonRequest<unknown[]>({
        apiBase,
        getToken: getTokenRef.current,
        path: "/api/workouts/member-plans",
      });
      const remotePlans = payload
        .map(normalizeSavedPlan)
        .filter((plan): plan is SavedWorkoutPlan => Boolean(plan));
      const localOnlyPlans = savedPlansRef.current.filter(
        (localPlan) => !remotePlans.some((remotePlan) => remotePlan.id === localPlan.id),
      );
      await replaceSavedPlans([...remotePlans, ...localOnlyPlans]);
    } catch (error) {
      console.error("Failed to sync saved workout plans", error);
    }
  }, [replaceSavedPlans, userId]);

  useEffect(() => {
    if (!isLoaded) return;
    void fetchSavedPlans();
    void fetchWorkoutSync();
  }, [fetchSavedPlans, fetchWorkoutSync, isLoaded]);

  const saveSessions = useCallback(
    async (newSessions: WorkoutSession[]) => {
      await replaceSessions(newSessions);
    },
    [replaceSessions],
  );

  const syncSessionToServer = useCallback(
    async (session: WorkoutSession) => {
      if (!userId) {
        return null;
      }

      try {
        const apiBase = requireApiBaseOrThrow();
        const payload = await authenticatedJsonRequest<{
          session?: unknown;
          personalRecords?: unknown[];
        }>({
          apiBase,
          getToken: getTokenRef.current,
          path: "/api/workouts/sessions",
          method: "POST",
          body: session,
        });
        const remoteSession = normalizeWorkoutSession(payload.session);
        const remoteRecords: Record<string, PersonalRecord> = {};
        for (const record of payload.personalRecords ?? []) {
          const normalizedRecord = normalizePersonalRecord(record);
          if (normalizedRecord) {
            remoteRecords[normalizedRecord.exerciseId] = normalizedRecord;
          }
        }

        return {
          session: remoteSession,
          personalRecords: remoteRecords,
        };
      } catch (error) {
        console.error("Failed to sync completed workout session", error);
        return null;
      }
    },
    [userId],
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

      await replacePersonalRecords(newPRs);

      const syncResult = await syncSessionToServer(completedSession);
      if (syncResult?.session) {
        await saveSessions(
          newSessions.map((entry) =>
            entry.id === syncResult.session?.id ? syncResult.session : entry,
          ),
        );
      }
      if (syncResult?.personalRecords) {
        await replacePersonalRecords({ ...newPRs, ...syncResult.personalRecords });
      }

      setActiveSession(null);
      return { session: completedSession, newPRs: sessionNewPRs };
    },
    [
      activeSession,
      personalRecords,
      replacePersonalRecords,
      saveSessions,
      sessions,
      syncSessionToServer,
    ],
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
      if (!userId) return;

      try {
        const apiBase = requireApiBaseOrThrow();
        await authenticatedJsonRequest<unknown>({
          apiBase,
          getToken,
          path: `/api/workouts/sessions/${encodeURIComponent(sessionId)}`,
          method: "DELETE",
        });
      } catch (error) {
        if (error instanceof AuthenticatedApiError && error.status === 404) {
          return;
        }
        console.error("Failed to delete synced workout session", error);
      }
    },
    [getToken, saveSessions, sessions, userId],
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
        const apiBase = requireApiBaseOrThrow();

        const normalizedPlan = normalizeSavedPlan(
          await authenticatedJsonRequest<unknown>({
            apiBase,
            getToken,
            path: input.id
              ? `/api/workouts/member-plans/${encodeURIComponent(input.id)}`
              : "/api/workouts/member-plans",
            method: input.id ? "PATCH" : "POST",
            body: { name, focus, exercises },
          }),
        );
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
        const apiBase = requireApiBaseOrThrow();

        await authenticatedJsonRequest<unknown>({
          apiBase,
          getToken,
          path: `/api/workouts/member-plans/${encodeURIComponent(planId)}`,
          method: "DELETE",
        });
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
