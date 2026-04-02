import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ClassStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type ClassCategory = "Yoga" | "Zumba" | "CrossFit" | "HIIT" | "Spinning" | "Boxing" | "Pilates" | "Strength" | "Cardio" | "Other";

export interface GymClass {
  id: string;
  name: string;
  category: ClassCategory;
  description: string;
  trainer: string;
  date: string;
  startTime: string;
  duration: number;
  maxParticipants: number;
  enrolledCount: number;
  enrolledMembers: string[];
  room: string;
  status: ClassStatus;
  color: string;
}

const CLASS_COLORS: Record<ClassCategory, string> = {
  Yoga: "#22C55E",
  Zumba: "#F59E0B",
  CrossFit: "#EF4444",
  HIIT: "#FF6B00",
  Spinning: "#3B82F6",
  Boxing: "#8B5CF6",
  Pilates: "#EC4899",
  Strength: "#F97316",
  Cardio: "#14B8A6",
  Other: "#9096B3",
};

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function getNextDateForDay(dayOfWeek: number, time: string): string {
  const today = new Date();
  const daysUntil = (dayOfWeek - today.getDay() + 7) % 7;
  const date = new Date(today);
  date.setDate(today.getDate() + daysUntil);
  return date.toISOString().split("T")[0];
}

const SAMPLE_CLASSES: GymClass[] = [
  {
    id: "cls1",
    name: "Morning Yoga Flow",
    category: "Yoga",
    description: "Start your day with a refreshing yoga session focusing on flexibility and mindfulness",
    trainer: "Priya Sharma",
    date: getNextDateForDay(1, "06:30"),
    startTime: "06:30",
    duration: 60,
    maxParticipants: 20,
    enrolledCount: 12,
    enrolledMembers: [],
    room: "Studio A",
    status: "scheduled",
    color: CLASS_COLORS.Yoga,
  },
  {
    id: "cls2",
    name: "High Intensity HIIT",
    category: "HIIT",
    description: "Burn maximum calories with this 45-min high intensity interval training session",
    trainer: "Rahul Mehta",
    date: getNextDateForDay(1, "07:30"),
    startTime: "07:30",
    duration: 45,
    maxParticipants: 15,
    enrolledCount: 10,
    enrolledMembers: [],
    room: "Main Floor",
    status: "scheduled",
    color: CLASS_COLORS.HIIT,
  },
  {
    id: "cls3",
    name: "Zumba Party",
    category: "Zumba",
    description: "Dance your way to fitness with this energetic Latin-inspired cardio class",
    trainer: "Anjali Singh",
    date: getNextDateForDay(2, "18:00"),
    startTime: "18:00",
    duration: 60,
    maxParticipants: 25,
    enrolledCount: 18,
    enrolledMembers: [],
    room: "Dance Studio",
    status: "scheduled",
    color: CLASS_COLORS.Zumba,
  },
  {
    id: "cls4",
    name: "CrossFit WOD",
    category: "CrossFit",
    description: "Today's Workout of the Day — challenging functional movements at high intensity",
    trainer: "Vikram Patel",
    date: getNextDateForDay(3, "06:00"),
    startTime: "06:00",
    duration: 60,
    maxParticipants: 12,
    enrolledCount: 8,
    enrolledMembers: [],
    room: "CrossFit Box",
    status: "scheduled",
    color: CLASS_COLORS.CrossFit,
  },
  {
    id: "cls5",
    name: "Power Spinning",
    category: "Spinning",
    description: "Indoor cycling with rhythm-based training for maximum cardiovascular endurance",
    trainer: "Kavya Nair",
    date: getNextDateForDay(4, "07:00"),
    startTime: "07:00",
    duration: 45,
    maxParticipants: 20,
    enrolledCount: 15,
    enrolledMembers: [],
    room: "Spin Studio",
    status: "scheduled",
    color: CLASS_COLORS.Spinning,
  },
  {
    id: "cls6",
    name: "Boxing Basics",
    category: "Boxing",
    description: "Learn proper boxing technique while getting an incredible full-body workout",
    trainer: "Arun Kumar",
    date: getNextDateForDay(5, "19:00"),
    startTime: "19:00",
    duration: 75,
    maxParticipants: 16,
    enrolledCount: 9,
    enrolledMembers: [],
    room: "Boxing Ring",
    status: "scheduled",
    color: CLASS_COLORS.Boxing,
  },
];

interface ScheduleContextType {
  classes: GymClass[];
  enrolledClassIds: string[];
  enrollInClass: (classId: string, userId: string) => Promise<void>;
  unenrollFromClass: (classId: string, userId: string) => Promise<void>;
  addClass: (gymClass: Omit<GymClass, "id" | "enrolledCount" | "enrolledMembers" | "color">) => Promise<void>;
  updateClass: (classId: string, updates: Partial<GymClass>) => Promise<void>;
  deleteClass: (classId: string) => Promise<void>;
  getTodayClasses: () => GymClass[];
  getClassesForDate: (date: string) => GymClass[];
  isEnrolled: (classId: string) => boolean;
  isLoading: boolean;
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);

async function fetchClassesFromAPI(): Promise<GymClass[] | null> {
  try {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) return null;
    const url = `https://${domain}/api/classes`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data)) return null;
    return data.map((c: Record<string, unknown>) => ({
      id: String(c.id),
      name: String(c.name ?? ""),
      category: (c.category as ClassCategory) ?? "Other",
      description: String(c.description ?? ""),
      trainer: String(c.trainer ?? ""),
      date: String(c.date ?? ""),
      startTime: String(c.startTime ?? ""),
      duration: Number(c.duration ?? 60),
      maxParticipants: Number(c.maxParticipants ?? 20),
      enrolledCount: Number(c.enrolledCount ?? 0),
      enrolledMembers: [],
      room: String(c.room ?? ""),
      status: (c.status as ClassStatus) ?? "scheduled",
      color: String(c.color ?? CLASS_COLORS.Other),
    }));
  } catch {
    return null;
  }
}

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const [classes, setClasses] = useState<GymClass[]>(SAMPLE_CLASSES);
  const [enrolledClassIds, setEnrolledClassIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [storedEnrolled, storedClasses, apiClasses] = await Promise.all([
          AsyncStorage.getItem("@gymapp_enrolled"),
          AsyncStorage.getItem("@gymapp_classes"),
          fetchClassesFromAPI(),
        ]);

        const localClasses: GymClass[] = storedClasses ? JSON.parse(storedClasses) : [];

        if (apiClasses !== null) {
          const apiIds = new Set(apiClasses.map((c) => c.id));
          const localOnly = localClasses.filter((c) => !apiIds.has(c.id));
          setClasses([...apiClasses, ...localOnly]);
        } else if (localClasses.length > 0) {
          setClasses(localClasses);
        }

        if (storedEnrolled) setEnrolledClassIds(JSON.parse(storedEnrolled));
      } catch (e) {
        console.error("Failed to load schedule", e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const saveClasses = useCallback(async (newClasses: GymClass[]) => {
    setClasses(newClasses);
    await AsyncStorage.setItem("@gymapp_classes", JSON.stringify(newClasses));
  }, []);

  const enrollInClass = useCallback(
    async (classId: string, userId: string) => {
      const cls = classes.find((c) => c.id === classId);
      if (!cls || cls.enrolledCount >= cls.maxParticipants) return;
      const newClasses = classes.map((c) =>
        c.id === classId
          ? { ...c, enrolledCount: c.enrolledCount + 1, enrolledMembers: [...c.enrolledMembers, userId] }
          : c,
      );
      await saveClasses(newClasses);
      const newEnrolled = [...enrolledClassIds, classId];
      setEnrolledClassIds(newEnrolled);
      await AsyncStorage.setItem("@gymapp_enrolled", JSON.stringify(newEnrolled));
    },
    [classes, enrolledClassIds, saveClasses],
  );

  const unenrollFromClass = useCallback(
    async (classId: string, userId: string) => {
      const newClasses = classes.map((c) =>
        c.id === classId
          ? { ...c, enrolledCount: Math.max(0, c.enrolledCount - 1), enrolledMembers: c.enrolledMembers.filter((id) => id !== userId) }
          : c,
      );
      await saveClasses(newClasses);
      const newEnrolled = enrolledClassIds.filter((id) => id !== classId);
      setEnrolledClassIds(newEnrolled);
      await AsyncStorage.setItem("@gymapp_enrolled", JSON.stringify(newEnrolled));
    },
    [classes, enrolledClassIds, saveClasses],
  );

  const addClass = useCallback(
    async (gymClass: Omit<GymClass, "id" | "enrolledCount" | "enrolledMembers" | "color">) => {
      const newClass: GymClass = {
        ...gymClass,
        id: generateId(),
        enrolledCount: 0,
        enrolledMembers: [],
        color: CLASS_COLORS[gymClass.category] || CLASS_COLORS.Other,
      };
      await saveClasses([...classes, newClass]);
    },
    [classes, saveClasses],
  );

  const updateClass = useCallback(
    async (classId: string, updates: Partial<GymClass>) => {
      await saveClasses(classes.map((c) => (c.id === classId ? { ...c, ...updates } : c)));
    },
    [classes, saveClasses],
  );

  const deleteClass = useCallback(
    async (classId: string) => {
      await saveClasses(classes.filter((c) => c.id !== classId));
    },
    [classes, saveClasses],
  );

  const getTodayClasses = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    return classes.filter((c) => c.date === today).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [classes]);

  const getClassesForDate = useCallback(
    (date: string) => classes.filter((c) => c.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [classes],
  );

  const isEnrolled = useCallback((classId: string) => enrolledClassIds.includes(classId), [enrolledClassIds]);

  return (
    <ScheduleContext.Provider
      value={{
        classes,
        enrolledClassIds,
        enrollInClass,
        unenrollFromClass,
        addClass,
        updateClass,
        deleteClass,
        getTodayClasses,
        getClassesForDate,
        isEnrolled,
        isLoading,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
}
