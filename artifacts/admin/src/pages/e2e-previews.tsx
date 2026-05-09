import { useEffect } from "react";
import {
  getAdminGetSettingsQueryKey,
  getAdminListClassesQueryKey,
  getAdminListMembersQueryKey,
  type DashboardStats,
  type GymClass,
  type GymSettings,
  type Member,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { DashboardContent } from "./dashboard";
import Classes from "./classes";
import Members from "./members";
import Settings from "./settings";
import type { EnrolledMember } from "@/components/enrollments-sheet";

const today = "2099-05-05";
const emptyPreviewClasses: GymClass[] = [];

const previewStats: DashboardStats = {
  totalClassesThisWeek: 18,
  totalEnrollments: 142,
  totalEnrollmentsThisWeek: 64,
  averageClassOccupancy: 74,
  upcomingClassesCount: 12,
  totalActiveMembers: 86,
  mostPopularCategory: "Strength",
  lowAttendanceClasses: [
    {
      id: 5,
      name: "Pilates Control",
      date: "2099-05-06",
      startTime: "10:00",
      enrolledCount: 3,
      maxParticipants: 12,
      occupancyPercent: 25,
    },
  ],
  weeklyClassCounts: [
    { day: "Mon", count: 4 },
    { day: "Tue", count: 3 },
    { day: "Wed", count: 5 },
    { day: "Thu", count: 2 },
    { day: "Fri", count: 4 },
    { day: "Sat", count: 6 },
    { day: "Sun", count: 1 },
  ],
};

const previewClasses: GymClass[] = [
  {
    id: 1,
    name: "Strength Foundations",
    category: "Strength",
    description: "Compound movement coaching",
    trainer: "Aarav Mehta",
    date: today,
    startTime: "07:30",
    duration: 45,
    maxParticipants: 16,
    enrolledCount: 12,
    waitlistedCount: 0,
    checkedInCount: 7,
    room: "Studio A",
    status: "scheduled",
    color: "#FF6B00",
    createdAt: today,
    updatedAt: today,
  },
  {
    id: 2,
    name: "HIIT Engine",
    category: "HIIT",
    description: "Conditioning class",
    trainer: "Meera Shah",
    date: today,
    startTime: "18:00",
    duration: 40,
    maxParticipants: 20,
    enrolledCount: 20,
    waitlistedCount: 4,
    checkedInCount: 16,
    room: "Floor 2",
    status: "scheduled",
    color: "#0EA5E9",
    createdAt: today,
    updatedAt: today,
  },
  {
    id: 3,
    name: "Yoga Flow",
    category: "Yoga",
    description: "Mobility and breathing",
    trainer: "Isha Nair",
    date: today,
    startTime: "19:15",
    duration: 50,
    maxParticipants: 18,
    enrolledCount: 14,
    waitlistedCount: 1,
    checkedInCount: 10,
    room: "Studio B",
    status: "scheduled",
    color: "#22C55E",
    createdAt: today,
    updatedAt: today,
  },
  {
    id: 4,
    name: "Boxing Conditioning",
    category: "Boxing",
    description: "Footwork and conditioning",
    trainer: "Kabir Sethi",
    date: "2099-05-06",
    startTime: "08:00",
    duration: 45,
    maxParticipants: 14,
    enrolledCount: 9,
    waitlistedCount: 0,
    checkedInCount: 5,
    room: "Ring",
    status: "scheduled",
    color: "#EF4444",
    createdAt: today,
    updatedAt: today,
  },
  {
    id: 5,
    name: "Pilates Control",
    category: "Pilates",
    description: "Core stability",
    trainer: "Neha Kapoor",
    date: "2099-05-06",
    startTime: "10:00",
    duration: 45,
    maxParticipants: 12,
    enrolledCount: 7,
    waitlistedCount: 0,
    checkedInCount: 2,
    room: "Studio C",
    status: "scheduled",
    color: "#A855F7",
    createdAt: today,
    updatedAt: today,
  },
];

const previewMembers: Member[] = [
  {
    id: "member-1",
    name: "Rohan Malhotra",
    email: "rohan@example.com",
    role: "member",
    accessStatus: "approved",
    accessUpdatedAt: today,
    createdAt: today,
    aiMemorySummary: "Prefers evening strength sessions and repeatable push/pull plans.",
    aiLastUpdatedAt: today,
    aiRecentMessageCount: 8,
  },
  {
    id: "member-2",
    name: "Ananya Rao",
    email: "ananya@example.com",
    role: "trainer",
    accessStatus: "pending",
    accessUpdatedAt: null,
    createdAt: today,
    aiMemorySummary: null,
    aiLastUpdatedAt: null,
    aiRecentMessageCount: 0,
  },
  {
    id: "member-3",
    name: "Kabir Singh",
    email: "kabir@example.com",
    role: "member",
    accessStatus: "revoked",
    accessUpdatedAt: today,
    createdAt: today,
    aiMemorySummary: "Needs low-impact lower-body options after knee discomfort.",
    aiLastUpdatedAt: today,
    aiRecentMessageCount: 3,
  },
];

const previewEnrollmentMembers: Record<number, EnrolledMember[]> = {
  1: [
    {
      id: "member-1",
      firstName: "Rohan",
      lastName: "Malhotra",
      email: "rohan@example.com",
      role: "member",
      attendanceStatus: "booked",
    },
    {
      id: "member-3",
      firstName: "Kabir",
      lastName: "Singh",
      email: "kabir@example.com",
      role: "member",
      attendanceStatus: "checked_in",
    },
  ],
  2: [
    {
      id: "member-2",
      firstName: "Ananya",
      lastName: "Rao",
      email: "ananya@example.com",
      role: "trainer",
      attendanceStatus: "booked",
    },
  ],
};

const previewSettings: GymSettings = {
  id: 1,
  gymName: "GymOS Performance Club",
  address: "123 Fitness Blvd, Muscle City",
  phone: "+1 (555) 123-4567",
  workingHours: "Mon-Fri: 6am-10pm, Sat-Sun: 7am-8pm",
  description: "Strength, conditioning, coaching, and recovery for members who train with intent.",
  updatedAt: today,
};

export function AdminDashboardPreview() {
  return (
    <Layout notificationData={{ classes: previewClasses, members: previewMembers }}>
      <DashboardContent
        stats={previewStats}
        upcomingClasses={previewClasses}
        members={previewMembers}
      />
    </Layout>
  );
}

export function AdminMembersPreview() {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.setQueryData(getAdminListMembersQueryKey(), previewMembers);
  }, [queryClient]);

  return (
    <Layout notificationData={{ classes: previewClasses, members: previewMembers }}>
      <Members previewMembers={previewMembers} />
    </Layout>
  );
}

export function AdminClassesPreview() {
  const queryClient = useQueryClient();
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const state = params.get("state");
  const visibleClasses = state === "empty" ? emptyPreviewClasses : previewClasses;

  useEffect(() => {
    queryClient.setQueryData(getAdminListClassesQueryKey(), visibleClasses);
  }, [queryClient, visibleClasses]);

  return (
    <Layout notificationData={{ classes: visibleClasses, members: previewMembers }}>
      <Classes
        previewClasses={visibleClasses}
        previewEnrollmentMembersByClassId={previewEnrollmentMembers}
        previewError={state === "error"}
      />
    </Layout>
  );
}

export function AdminSettingsPreview() {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.setQueryData(getAdminGetSettingsQueryKey(), previewSettings);
  }, [queryClient]);

  return (
    <Layout notificationData={{ classes: previewClasses, members: previewMembers }}>
      <Settings previewSettings={previewSettings} />
    </Layout>
  );
}
