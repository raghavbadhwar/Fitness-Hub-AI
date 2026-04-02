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

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

interface WorkoutContextType {
  sessions: WorkoutSession[];
  personalRecords: Record<string, PersonalRecord>;
  activeSession: WorkoutSession | null;
  startSession: (name: string, exercises?: Omit<WorkoutExercise, "id">[]) => WorkoutSession;
  endSession: (sessionId: string, caloriesBurned?: number) => Promise<void>;
  addExerciseToSession: (sessionId: string, exercise: Omit<WorkoutExercise, "id">) => void;
  addSetToExercise: (sessionId: string, exerciseId: string, set: Omit<ExerciseSet, "id">) => void;
  updateSet: (sessionId: string, exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  getRecentSessions: (count?: number) => WorkoutSession[];
  getWeeklyVolume: () => { date: string; volume: number }[];
  isLoading: boolean;
}

const WorkoutContext = createContext<WorkoutContextType | null>(null);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [personalRecords, setPersonalRecords] = useState<Record<string, PersonalRecord>>({});
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [storedSessions, storedPRs] = await Promise.all([
          AsyncStorage.getItem("@gymapp_sessions"),
          AsyncStorage.getItem("@gymapp_prs"),
        ]);
        if (storedSessions) setSessions(JSON.parse(storedSessions));
        if (storedPRs) setPersonalRecords(JSON.parse(storedPRs));
      } catch (e) {
        console.error("Failed to load workouts", e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const saveSessions = useCallback(async (newSessions: WorkoutSession[]) => {
    setSessions(newSessions);
    await AsyncStorage.setItem("@gymapp_sessions", JSON.stringify(newSessions));
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
    async (sessionId: string, caloriesBurned = 0) => {
      const session = activeSession?.id === sessionId ? activeSession : sessions.find((s) => s.id === sessionId);
      if (!session) return;

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
      for (const ex of completedSession.exercises) {
        for (const set of ex.sets) {
          if (!set.completed || set.weight === 0) continue;
          const key = ex.exerciseId;
          const current = newPRs[key];
          const oneRM = Math.round(set.weight * (1 + set.reps / 30));
          if (!current || oneRM > current.weight * (1 + current.reps / 30)) {
            newPRs[key] = { exerciseId: key, name: ex.name, weight: set.weight, reps: set.reps, date: completedSession.date };
          }
        }
      }
      setPersonalRecords(newPRs);
      await AsyncStorage.setItem("@gymapp_prs", JSON.stringify(newPRs));
      setActiveSession(null);
    },
    [activeSession, sessions, personalRecords, saveSessions],
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

  return (
    <WorkoutContext.Provider
      value={{
        sessions,
        personalRecords,
        activeSession,
        startSession,
        endSession,
        addExerciseToSession,
        addSetToExercise,
        updateSet,
        deleteSession,
        getRecentSessions,
        getWeeklyVolume,
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
