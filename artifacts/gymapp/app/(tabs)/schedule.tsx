import { useUser } from "@clerk/expo";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert } from "react-native";

import { ScheduleScreenView } from "@/components/schedule/ScheduleScreenView";
import { useApp } from "@/contexts/AppContext";
import { type GymClass, useSchedule } from "@/contexts/ScheduleContext";
import { notifySuccess, notifyWarning } from "@/lib/haptics";

export default function ScheduleScreen() {
  const { user } = useUser();
  const { profile } = useApp();
  const {
    classes,
    enrollInClass,
    unenrollFromClass,
    joinWaitlist,
    leaveWaitlist,
    isEnrolled,
    isWaitlisted,
    getClassesForDate,
    refreshSchedule,
    isLoading,
  } = useSchedule();

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split("T")[0]);
  const [confirmSheet, setConfirmSheet] = useState<{ cls: GymClass } | null>(null);
  const [actionClassId, setActionClassId] = useState<string | null>(null);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [bookingMessageTone, setBookingMessageTone] = useState<"error" | "success" | "info">(
    "error",
  );

  useFocusEffect(
    useCallback(() => {
      void refreshSchedule();
    }, [refreshSchedule]),
  );

  const showBookingError = useCallback((message: string) => {
    setBookingMessageTone("error");
    setBookingMessage(message);
    Alert.alert("Could not update class booking", message);
  }, []);

  const showBookingNotice = useCallback((message: string, tone: "success" | "info" = "success") => {
    setBookingMessageTone(tone);
    setBookingMessage(message);
  }, []);

  const handleEnrollment = useCallback(
    async (gymClass: GymClass) => {
      setBookingMessage(null);
      setActionClassId(gymClass.id);

      try {
        if (isEnrolled(gymClass.id)) {
          setConfirmSheet({ cls: gymClass });
          return;
        }

        if (gymClass.enrolledCount >= gymClass.maxParticipants) {
          if (isWaitlisted(gymClass.id)) {
            await leaveWaitlist(gymClass.id);
            notifyWarning();
            showBookingNotice("You have left the waitlist for this class.", "info");
            return;
          }

          await joinWaitlist(gymClass.id);
          notifySuccess();
          showBookingNotice(
            "You are on the waitlist. We will keep your interest ready if a spot opens.",
          );
          return;
        }

        await enrollInClass(gymClass.id, user?.id || "me");
        notifySuccess();
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "We could not reserve your spot right now.";
        showBookingError(message);
      } finally {
        setActionClassId(null);
      }
    },
    [
      enrollInClass,
      isEnrolled,
      isWaitlisted,
      joinWaitlist,
      leaveWaitlist,
      showBookingError,
      showBookingNotice,
      user?.id,
    ],
  );

  const handleConfirmUnenroll = useCallback(async () => {
    if (!confirmSheet) {
      return;
    }

    setBookingMessage(null);
    setActionClassId(confirmSheet.cls.id);

    try {
      await unenrollFromClass(confirmSheet.cls.id, user?.id || "me");
      notifyWarning();
      setConfirmSheet(null);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "We could not release your spot right now.";
      showBookingError(message);
    } finally {
      setActionClassId(null);
    }
  }, [confirmSheet, showBookingError, unenrollFromClass, user?.id]);

  return (
    <ScheduleScreenView
      actionClassId={actionClassId}
      bookingMessage={bookingMessage}
      bookingMessageTone={bookingMessageTone}
      classes={classes}
      confirmSheetClass={confirmSheet?.cls ?? null}
      isEnrolled={isEnrolled}
      isWaitlisted={isWaitlisted}
      isLoading={isLoading}
      onCancelUnenroll={() => setConfirmSheet(null)}
      onConfirmUnenroll={handleConfirmUnenroll}
      onPressEnrollment={handleEnrollment}
      onSelectDate={setSelectedDate}
      profileRole={profile.role}
      selectedClasses={getClassesForDate(selectedDate)}
      selectedDate={selectedDate}
      today={today}
    />
  );
}
