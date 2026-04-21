import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";

import { ScheduleScreenView } from "@/components/schedule/ScheduleScreenView";
import type { GymClass } from "@/contexts/ScheduleContext";

const PREVIEW_TODAY = new Date("2026-04-21T09:00:00.000Z");
const PREVIEW_DATE = "2026-04-21";

function getScenarioValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function createPreviewClasses(): GymClass[] {
  return [
    {
      id: "preview-open",
      name: "Power Yoga Flow",
      category: "Yoga",
      description: "A steady mobility and breathwork block for the browser preview route.",
      trainer: "Coach Mira",
      date: PREVIEW_DATE,
      startTime: "07:00",
      duration: 50,
      maxParticipants: 18,
      enrolledCount: 9,
      enrolledMembers: [],
      room: "Studio Flow",
      status: "scheduled",
      color: "#16A34A",
    },
    {
      id: "preview-full",
      name: "HIIT Burn",
      category: "HIIT",
      description: "A packed class state used to verify error messaging and disabled actions.",
      trainer: "Coach Dev",
      date: PREVIEW_DATE,
      startTime: "18:30",
      duration: 45,
      maxParticipants: 12,
      enrolledCount: 12,
      enrolledMembers: [],
      room: "Main Floor",
      status: "scheduled",
      color: "#EA580C",
    },
    {
      id: "preview-enrolled",
      name: "Recovery Pilates",
      category: "Pilates",
      description: "An enrolled state preview for the confirm sheet and badge styling.",
      trainer: "Coach Riya",
      date: "2026-04-22",
      startTime: "08:15",
      duration: 40,
      maxParticipants: 14,
      enrolledCount: 6,
      enrolledMembers: ["preview-user"],
      room: "Studio Balance",
      status: "scheduled",
      color: "#DB2777",
    },
  ];
}

export default function SchedulePreviewRoute() {
  const { state } = useLocalSearchParams<{ state?: string | string[] }>();
  const scenario = getScenarioValue(state);
  const [selectedDate, setSelectedDate] = useState(PREVIEW_DATE);
  const [classes, setClasses] = useState<GymClass[]>(() => createPreviewClasses());
  const [enrolledClassIds, setEnrolledClassIds] = useState<string[]>(["preview-enrolled"]);
  const [actionClassId, setActionClassId] = useState<string | null>(null);
  const [confirmSheetClass, setConfirmSheetClass] = useState<GymClass | null>(null);

  const bookingMessage =
    scenario === "error" ? "This class is already full. Please pick another slot." : null;
  const isLoading = scenario === "loading";

  const isEnrolled = useCallback(
    (classId: string) => enrolledClassIds.includes(classId),
    [enrolledClassIds],
  );

  const handlePressEnrollment = useCallback(
    async (gymClass: GymClass) => {
      setActionClassId(gymClass.id);

      try {
        if (isEnrolled(gymClass.id)) {
          setConfirmSheetClass(gymClass);
          return;
        }

        if (scenario === "error" || gymClass.enrolledCount >= gymClass.maxParticipants) {
          return;
        }

        setEnrolledClassIds((current) =>
          current.includes(gymClass.id) ? current : [...current, gymClass.id],
        );
        setClasses((current) =>
          current.map((existingClass) =>
            existingClass.id === gymClass.id
              ? {
                  ...existingClass,
                  enrolledCount: existingClass.enrolledCount + 1,
                  enrolledMembers: [...existingClass.enrolledMembers, "preview-user"],
                }
              : existingClass,
          ),
        );
      } finally {
        setActionClassId(null);
      }
    },
    [isEnrolled, scenario],
  );

  const handleConfirmUnenroll = useCallback(() => {
    if (!confirmSheetClass) {
      return;
    }

    setEnrolledClassIds((current) => current.filter((classId) => classId !== confirmSheetClass.id));
    setClasses((current) =>
      current.map((existingClass) =>
        existingClass.id === confirmSheetClass.id
          ? {
              ...existingClass,
              enrolledCount: Math.max(0, existingClass.enrolledCount - 1),
              enrolledMembers: existingClass.enrolledMembers.filter(
                (memberId) => memberId !== "preview-user",
              ),
            }
          : existingClass,
      ),
    );
    setConfirmSheetClass(null);
  }, [confirmSheetClass]);

  const selectedClasses = useMemo(
    () =>
      classes
        .filter((gymClass) => gymClass.date === selectedDate)
        .sort((left, right) => left.startTime.localeCompare(right.startTime)),
    [classes, selectedDate],
  );

  return (
    <ScheduleScreenView
      actionClassId={actionClassId}
      bookingMessage={bookingMessage}
      classes={classes}
      confirmSheetClass={confirmSheetClass}
      isEnrolled={isEnrolled}
      isLoading={isLoading}
      onCancelUnenroll={() => setConfirmSheetClass(null)}
      onConfirmUnenroll={handleConfirmUnenroll}
      onPressEnrollment={handlePressEnrollment}
      onSelectDate={setSelectedDate}
      profileRole="member"
      selectedClasses={selectedClasses}
      selectedDate={selectedDate}
      today={PREVIEW_TODAY}
    />
  );
}
