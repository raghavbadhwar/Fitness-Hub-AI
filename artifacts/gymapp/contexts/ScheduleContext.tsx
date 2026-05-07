import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getApiBase } from "@/lib/api-base";
import {
  decodeVersioned,
  decodeVersionedWithLegacyFallback,
  encodeVersioned,
} from "@/lib/versioned-storage";

export type ClassStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type ClassCategory =
  | "Yoga"
  | "Zumba"
  | "CrossFit"
  | "HIIT"
  | "Spinning"
  | "Boxing"
  | "Pilates"
  | "Strength"
  | "Cardio"
  | "Other";

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

function getNextDateForDay(dayOfWeek: number): string {
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
    description:
      "Start your day with a refreshing yoga session focusing on flexibility and mindfulness",
    trainer: "Priya Sharma",
    date: getNextDateForDay(1),
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
    date: getNextDateForDay(1),
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
    date: getNextDateForDay(2),
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
    date: getNextDateForDay(3),
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
    date: getNextDateForDay(4),
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
    date: getNextDateForDay(5),
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
  waitlistedClassIds: string[];
  enrollInClass: (classId: string, userId: string) => Promise<void>;
  unenrollFromClass: (classId: string, userId: string) => Promise<void>;
  joinWaitlist: (classId: string) => Promise<void>;
  leaveWaitlist: (classId: string) => Promise<void>;
  addClass: (
    gymClass: Omit<GymClass, "id" | "enrolledCount" | "enrolledMembers" | "color">,
  ) => Promise<void>;
  updateClass: (classId: string, updates: Partial<GymClass>) => Promise<void>;
  deleteClass: (classId: string) => Promise<void>;
  getTodayClasses: () => GymClass[];
  getClassesForDate: (date: string) => GymClass[];
  isEnrolled: (classId: string) => boolean;
  isWaitlisted: (classId: string) => boolean;
  refreshSchedule: () => Promise<void>;
  isLoading: boolean;
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);
const CLASSES_STORAGE_KEY = "@gymapp_classes";
const LEGACY_ENROLLED_STORAGE_KEY = "@gymapp_enrolled";
const LEGACY_WAITLIST_STORAGE_KEY = "@gymapp_waitlisted";

function normalizeGymClass(c: Record<string, unknown>): GymClass {
  return {
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
    enrolledMembers: Array.isArray(c.enrolledMemberIds)
      ? c.enrolledMemberIds.map((memberId) => String(memberId))
      : [],
    room: String(c.room ?? ""),
    status: (c.status as ClassStatus) ?? "scheduled",
    color: String(c.color ?? CLASS_COLORS.Other),
  };
}

async function fetchClassesFromAPI(token: string | null): Promise<GymClass[] | null> {
  try {
    const apiBase = getApiBase();
    if (!apiBase || !token) return null;
    const url = `${apiBase}/api/classes`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data)) return null;
    return data.map((c: Record<string, unknown>) => normalizeGymClass(c));
  } catch {
    return null;
  }
}

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded: authLoaded, isSignedIn, userId } = useAuth();
  const [classes, setClasses] = useState<GymClass[]>(SAMPLE_CLASSES);
  const [enrolledClassIds, setEnrolledClassIds] = useState<string[]>([]);
  const [waitlistedClassIds, setWaitlistedClassIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const getTokenRef = useRef(getToken);
  const enrolledStorageKey = userId
    ? `${LEGACY_ENROLLED_STORAGE_KEY}:${userId}`
    : `${LEGACY_ENROLLED_STORAGE_KEY}:guest`;
  const waitlistStorageKey = userId
    ? `${LEGACY_WAITLIST_STORAGE_KEY}:${userId}`
    : `${LEGACY_WAITLIST_STORAGE_KEY}:guest`;

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const saveLocalEnrolledIds = useCallback(
    async (nextEnrolledClassIds: string[]) => {
      setEnrolledClassIds(nextEnrolledClassIds);
      await AsyncStorage.setItem(enrolledStorageKey, encodeVersioned(nextEnrolledClassIds));
    },
    [enrolledStorageKey],
  );

  const saveLocalWaitlistedIds = useCallback(
    async (nextWaitlistedClassIds: string[]) => {
      setWaitlistedClassIds(nextWaitlistedClassIds);
      await AsyncStorage.setItem(waitlistStorageKey, encodeVersioned(nextWaitlistedClassIds));
    },
    [waitlistStorageKey],
  );

  const saveClasses = useCallback(async (newClasses: GymClass[]) => {
    setClasses(newClasses);
    await AsyncStorage.setItem(CLASSES_STORAGE_KEY, encodeVersioned(newClasses));
  }, []);

  const replaceClass = useCallback(
    async (updatedClass: GymClass) => {
      const nextClasses = classes.map((existingClass) =>
        existingClass.id === updatedClass.id ? updatedClass : existingClass,
      );
      await saveClasses(nextClasses);
    },
    [classes, saveClasses],
  );

  const fetchEnrolledClassIds = useCallback(async () => {
    if (!isSignedIn) {
      return;
    }

    const token = await getTokenRef.current();
    const apiBase = getApiBase();
    if (!token || !apiBase) {
      return;
    }

    const response = await fetch(`${apiBase}/api/classes/enrolled`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch enrolled classes (${response.status})`);
    }

    const payload = (await response.json()) as { classIds?: unknown };
    const nextEnrolledClassIds = Array.isArray(payload.classIds)
      ? payload.classIds.map((classId) => String(classId))
      : [];
    await saveLocalEnrolledIds(nextEnrolledClassIds);
  }, [isSignedIn, saveLocalEnrolledIds]);

  const fetchWaitlistedClassIds = useCallback(async () => {
    if (!isSignedIn) {
      return;
    }

    const token = await getTokenRef.current();
    const apiBase = getApiBase();
    if (!token || !apiBase) {
      return;
    }

    const response = await fetch(`${apiBase}/api/classes/waitlisted`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch waitlisted classes (${response.status})`);
    }

    const payload = (await response.json()) as { classIds?: unknown };
    const nextWaitlistedClassIds = Array.isArray(payload.classIds)
      ? payload.classIds.map((classId) => String(classId))
      : [];
    await saveLocalWaitlistedIds(nextWaitlistedClassIds);
  }, [isSignedIn, saveLocalWaitlistedIds]);

  const refreshSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      const apiClassesPromise = (async () => {
        if (!isSignedIn) return null;
        return fetchClassesFromAPI(await getTokenRef.current());
      })();
      const [storedEnrolled, storedWaitlist, storedClasses, apiClasses] = await Promise.all([
        AsyncStorage.getItem(enrolledStorageKey),
        AsyncStorage.getItem(waitlistStorageKey),
        AsyncStorage.getItem(CLASSES_STORAGE_KEY),
        apiClassesPromise,
      ]);

      const fallbackEnrolled =
        enrolledStorageKey !== LEGACY_ENROLLED_STORAGE_KEY
          ? await AsyncStorage.getItem(LEGACY_ENROLLED_STORAGE_KEY)
          : null;
      const fallbackWaitlist =
        waitlistStorageKey !== LEGACY_WAITLIST_STORAGE_KEY
          ? await AsyncStorage.getItem(LEGACY_WAITLIST_STORAGE_KEY)
          : null;

      const decodedClasses = decodeVersioned<GymClass[]>(storedClasses, []);
      const decodedEnrolled = decodeVersionedWithLegacyFallback<string[]>(
        storedEnrolled,
        fallbackEnrolled,
        [],
      );
      const decodedWaitlisted = decodeVersionedWithLegacyFallback<string[]>(
        storedWaitlist,
        fallbackWaitlist,
        [],
      );
      const localClasses = decodedClasses.value;

      const migrations: Array<Promise<void>> = [];
      if (decodedClasses.shouldMigrate) {
        migrations.push(AsyncStorage.setItem(CLASSES_STORAGE_KEY, encodeVersioned(localClasses)));
      }
      if (decodedEnrolled.shouldMigrate) {
        migrations.push(
          AsyncStorage.setItem(enrolledStorageKey, encodeVersioned(decodedEnrolled.value)),
        );
      }
      if (decodedWaitlisted.shouldMigrate) {
        migrations.push(
          AsyncStorage.setItem(waitlistStorageKey, encodeVersioned(decodedWaitlisted.value)),
        );
      }

      if (migrations.length > 0) {
        await Promise.all(migrations);
      }

      if (apiClasses !== null) {
        await saveClasses(apiClasses);
      } else if (localClasses.length > 0) {
        setClasses(localClasses);
      }

      if (authLoaded && isSignedIn) {
        const [enrolledResult, waitlistedResult] = await Promise.allSettled([
          fetchEnrolledClassIds(),
          fetchWaitlistedClassIds(),
        ]);

        if (enrolledResult.status === "rejected") {
          console.error("Failed to sync enrolled classes", enrolledResult.reason);
          if (decodedEnrolled.value.length > 0) {
            setEnrolledClassIds(decodedEnrolled.value);
          }
        }

        if (waitlistedResult.status === "rejected") {
          console.error("Failed to sync waitlisted classes", waitlistedResult.reason);
          if (decodedWaitlisted.value.length > 0) {
            setWaitlistedClassIds(decodedWaitlisted.value);
          }
        }
      } else {
        if (decodedEnrolled.value.length > 0) {
          setEnrolledClassIds(decodedEnrolled.value);
        }
        if (decodedWaitlisted.value.length > 0) {
          setWaitlistedClassIds(decodedWaitlisted.value);
        }
      }
    } catch (e) {
      console.error("Failed to load schedule", e);
    } finally {
      setIsLoading(false);
    }
  }, [
    authLoaded,
    enrolledStorageKey,
    fetchEnrolledClassIds,
    fetchWaitlistedClassIds,
    isSignedIn,
    saveClasses,
    userId,
    waitlistStorageKey,
  ]);

  useEffect(() => {
    void refreshSchedule();
  }, [refreshSchedule]);

  const enrollInClass = useCallback(
    async (classId: string, userId: string) => {
      const cls = classes.find((c) => c.id === classId);
      if (!cls || cls.enrolledCount >= cls.maxParticipants) return;

      const token = await getTokenRef.current();
      const apiBase = getApiBase();
      if (token && apiBase) {
        const response = await fetch(
          `${apiBase}/api/classes/${encodeURIComponent(classId)}/enroll`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Failed to enroll in class");
        }

        const updatedClass = normalizeGymClass(await response.json());
        await replaceClass(updatedClass);
        if (!enrolledClassIds.includes(classId)) {
          await saveLocalEnrolledIds([...enrolledClassIds, classId]);
        }
        if (waitlistedClassIds.includes(classId)) {
          await saveLocalWaitlistedIds(waitlistedClassIds.filter((id) => id !== classId));
        }
        return;
      }

      const newClasses = classes.map((gymClass) =>
        gymClass.id === classId
          ? {
              ...gymClass,
              enrolledCount: gymClass.enrolledCount + 1,
              enrolledMembers: [...gymClass.enrolledMembers, userId],
            }
          : gymClass,
      );
      await saveClasses(newClasses);
      if (!enrolledClassIds.includes(classId)) {
        await saveLocalEnrolledIds([...enrolledClassIds, classId]);
      }
      if (waitlistedClassIds.includes(classId)) {
        await saveLocalWaitlistedIds(waitlistedClassIds.filter((id) => id !== classId));
      }
    },
    [
      classes,
      enrolledClassIds,
      replaceClass,
      saveClasses,
      saveLocalEnrolledIds,
      saveLocalWaitlistedIds,
      waitlistedClassIds,
    ],
  );

  const unenrollFromClass = useCallback(
    async (classId: string, userId: string) => {
      const newEnrolled = enrolledClassIds.filter((id) => id !== classId);

      const token = await getTokenRef.current();
      const apiBase = getApiBase();
      if (token && apiBase) {
        const response = await fetch(
          `${apiBase}/api/classes/${encodeURIComponent(classId)}/enroll`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Failed to leave class");
        }

        const updatedClass = normalizeGymClass(await response.json());
        await replaceClass(updatedClass);
        await saveLocalEnrolledIds(newEnrolled);
        return;
      }

      const newClasses = classes.map((gymClass) =>
        gymClass.id === classId
          ? {
              ...gymClass,
              enrolledCount: Math.max(0, gymClass.enrolledCount - 1),
              enrolledMembers: gymClass.enrolledMembers.filter((id) => id !== userId),
            }
          : gymClass,
      );
      await saveClasses(newClasses);
      await saveLocalEnrolledIds(newEnrolled);
    },
    [classes, enrolledClassIds, replaceClass, saveClasses, saveLocalEnrolledIds],
  );

  const managementMovedToAdmin = useCallback(async () => {
    throw new Error("Class management is only available in the admin dashboard.");
  }, []);

  const joinWaitlist = useCallback(
    async (classId: string) => {
      const token = await getTokenRef.current();
      const apiBase = getApiBase();
      if (token && apiBase) {
        const response = await fetch(
          `${apiBase}/api/classes/${encodeURIComponent(classId)}/waitlist`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Failed to join waitlist");
        }

        const updatedClass = normalizeGymClass(await response.json());
        await replaceClass(updatedClass);
      }

      if (!waitlistedClassIds.includes(classId)) {
        await saveLocalWaitlistedIds([...waitlistedClassIds, classId]);
      }
    },
    [replaceClass, saveLocalWaitlistedIds, waitlistedClassIds],
  );

  const leaveWaitlist = useCallback(
    async (classId: string) => {
      const token = await getTokenRef.current();
      const apiBase = getApiBase();
      if (token && apiBase) {
        const response = await fetch(
          `${apiBase}/api/classes/${encodeURIComponent(classId)}/waitlist`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Failed to leave waitlist");
        }

        const updatedClass = normalizeGymClass(await response.json());
        await replaceClass(updatedClass);
      }

      await saveLocalWaitlistedIds(waitlistedClassIds.filter((id) => id !== classId));
    },
    [replaceClass, saveLocalWaitlistedIds, waitlistedClassIds],
  );

  const getTodayClasses = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    return classes
      .filter((c) => c.date === today)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [classes]);

  const getClassesForDate = useCallback(
    (date: string) =>
      classes.filter((c) => c.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [classes],
  );

  const isEnrolled = useCallback(
    (classId: string) => enrolledClassIds.includes(classId),
    [enrolledClassIds],
  );

  const isWaitlisted = useCallback(
    (classId: string) => waitlistedClassIds.includes(classId),
    [waitlistedClassIds],
  );

  return (
    <ScheduleContext.Provider
      value={{
        classes,
        enrolledClassIds,
        waitlistedClassIds,
        enrollInClass,
        unenrollFromClass,
        joinWaitlist,
        leaveWaitlist,
        addClass: managementMovedToAdmin,
        updateClass: managementMovedToAdmin,
        deleteClass: managementMovedToAdmin,
        getTodayClasses,
        getClassesForDate,
        isEnrolled,
        isWaitlisted,
        refreshSchedule,
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
