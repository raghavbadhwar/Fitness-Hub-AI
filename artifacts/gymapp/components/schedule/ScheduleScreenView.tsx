import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ConfirmSheet } from "@/components/ConfirmSheet";
import { LinearGradient, SafeAreaView } from "@/components/native-compat";
import type { UserRole } from "@/contexts/AppContext";
import type { ClassCategory, GymClass } from "@/contexts/ScheduleContext";
import { useColors } from "@/hooks/useColors";
import { useTypography } from "@/hooks/useTypography";

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 80;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CATEGORY_EMOJI: Record<ClassCategory, string> = {
  Yoga: "🧘",
  Zumba: "💃",
  CrossFit: "⚡",
  HIIT: "🔥",
  Spinning: "🚴",
  Boxing: "🥊",
  Pilates: "🤸",
  Strength: "💪",
  Cardio: "🏃",
  Other: "🏋️",
};

type ScheduleScreenViewProps = {
  actionClassId: string | null;
  bookingMessage: string | null;
  classes: GymClass[];
  confirmSheetClass: GymClass | null;
  isEnrolled: (classId: string) => boolean;
  isLoading: boolean;
  onCancelUnenroll: () => void;
  onConfirmUnenroll: () => void;
  onPressEnrollment: (cls: GymClass) => void;
  onSelectDate: (date: string) => void;
  profileRole: UserRole;
  selectedClasses: GymClass[];
  selectedDate: string;
  today?: Date;
};

export function ScheduleScreenView({
  actionClassId,
  bookingMessage,
  classes,
  confirmSheetClass,
  isEnrolled,
  isLoading,
  onCancelUnenroll,
  onConfirmUnenroll,
  onPressEnrollment,
  onSelectDate,
  profileRole,
  selectedClasses,
  selectedDate,
  today: todayOverride,
}: ScheduleScreenViewProps) {
  const colors = useColors();
  const typography = useTypography();
  const today = todayOverride ?? new Date();
  const todayKey = today.toISOString().split("T")[0];

  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - today.getDay() + index);
    return date;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Text style={[styles.screenTitle, typography.screenTitle, { color: colors.text }]}>Schedule</Text>
        {(profileRole === "owner" || profileRole === "trainer") && (
          <View
            style={[
              styles.adminPill,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            testID="schedule-managed-in-admin-pill"
          >
            <Feather name="shield" size={14} color={colors.primary} />
            <Text style={[styles.adminPillText, { color: colors.mutedForeground }]}>
              Managed in Admin
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.calendarRow}
        style={styles.calendarScroll}
      >
        {week.map((date) => {
          const dateKey = date.toISOString().split("T")[0];
          const isSelected = selectedDate === dateKey;
          const isToday = dateKey === todayKey;
          const hasClasses = classes.some((gymClass) => gymClass.date === dateKey);

          return (
            <Pressable
              key={dateKey}
              onPress={() => onSelectDate(dateKey)}
              style={[
                styles.dayBtn,
                {
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isToday ? colors.primary : colors.border,
                },
              ]}
              testID={`schedule-day-${dateKey}`}
            >
              <Text style={[styles.dayName, { color: isSelected ? "#fff" : colors.mutedForeground }]}>
                {WEEKDAYS[date.getDay()]}
              </Text>
              <Text style={[styles.dayNum, { color: isSelected ? "#fff" : colors.text }]}>
                {date.getDate()}
              </Text>
              {hasClasses ? (
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: isSelected ? "#ffffff80" : colors.primary },
                  ]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
        {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </Text>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {bookingMessage ? (
          <View
            style={[
              styles.feedbackBanner,
              {
                backgroundColor: `${colors.error}18`,
                borderColor: `${colors.error}44`,
              },
            ]}
            testID="schedule-booking-error"
          >
            <Feather name="alert-circle" size={14} color={colors.error} />
            <Text style={[styles.feedbackText, { color: colors.error }]}>
              {bookingMessage}
            </Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingState} testID="schedule-loading-state">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Refreshing classes...
            </Text>
          </View>
        ) : null}

        {selectedClasses.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="calendar" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No classes on this day
            </Text>
          </View>
        ) : (
          selectedClasses.map((gymClass) => {
            const enrolled = isEnrolled(gymClass.id);
            const full = gymClass.enrolledCount >= gymClass.maxParticipants && !enrolled;
            const isUpdating = actionClassId === gymClass.id;
            const capacityPercent = Math.min(
              (gymClass.enrolledCount / gymClass.maxParticipants) * 100,
              100,
            );
            const emoji = CATEGORY_EMOJI[gymClass.category] || "🏋️";

            return (
              <View
                key={gymClass.id}
                style={[
                  styles.classCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <LinearGradient
                  colors={[gymClass.color, `${gymClass.color}BB`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardHeader}
                >
                  <View style={styles.cardHeaderContent}>
                    <Text style={styles.cardHeaderEmoji}>{emoji}</Text>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardHeaderName}>{gymClass.name}</Text>
                      <Text style={styles.cardHeaderTime}>
                        {gymClass.startTime} · {gymClass.duration} min
                      </Text>
                    </View>
                  </View>
                  {enrolled ? (
                    <View style={styles.enrolledBadge}>
                      <Feather name="check" size={12} color="#fff" />
                    </View>
                  ) : null}
                </LinearGradient>

                <View style={styles.classContent}>
                  <View style={styles.classMetaRow}>
                    <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.classMeta, { color: colors.mutedForeground }]}>
                      {gymClass.room}
                    </Text>
                    <View style={styles.dot2} />
                    <Feather name="user" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.classMeta, { color: colors.mutedForeground }]}>
                      {gymClass.trainer}
                    </Text>
                  </View>

                  {gymClass.description ? (
                    <Text style={[styles.classDesc, { color: colors.mutedForeground }]}>
                      {gymClass.description}
                    </Text>
                  ) : null}

                  <View style={styles.capacityRow}>
                    <Text
                      style={[
                        styles.capacityText,
                        { color: full ? colors.error : colors.mutedForeground },
                      ]}
                    >
                      {gymClass.enrolledCount}/{gymClass.maxParticipants} enrolled
                      {full ? " · Full" : ""}
                    </Text>
                  </View>
                  <View style={[styles.capacityBar, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.capacityFill,
                        {
                          width: `${capacityPercent}%`,
                          backgroundColor:
                            capacityPercent >= 90
                              ? colors.error
                              : capacityPercent >= 70
                                ? colors.warning
                                : gymClass.color,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.classActions}>
                    <Pressable
                      style={[
                        styles.enrollBtn,
                        enrolled
                          ? {
                              backgroundColor: colors.surface,
                              borderColor: colors.border,
                              borderWidth: 1,
                            }
                          : full
                            ? {
                                backgroundColor: colors.muted,
                                borderColor: colors.border,
                                borderWidth: 1,
                              }
                            : { backgroundColor: gymClass.color },
                      ]}
                      onPress={() => onPressEnrollment(gymClass)}
                      disabled={isUpdating || (full && !enrolled)}
                      testID={`schedule-enroll-button-${gymClass.id}`}
                    >
                      {isUpdating ? (
                        <View style={{ marginRight: 6 }}>
                          <ActivityIndicator
                            size="small"
                            color={enrolled ? colors.text : "#fff"}
                          />
                        </View>
                      ) : enrolled ? (
                        <View style={{ marginRight: 4 }}>
                          <Feather name="check" size={14} color={colors.text} />
                        </View>
                      ) : null}
                      <Text
                        style={[
                          styles.enrollBtnText,
                          {
                            color: enrolled
                              ? colors.text
                              : full
                                ? colors.mutedForeground
                                : "#fff",
                          },
                        ]}
                      >
                        {isUpdating
                          ? "Updating..."
                          : enrolled
                            ? "Enrolled"
                            : full
                              ? "Class Full"
                              : "Enroll Now"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}

        <View style={[styles.allClassesSection, { borderTopColor: colors.border }]}>
          <Text
            style={[styles.allClassesTitle, typography.sectionTitle, { color: colors.text }]}
          >
            All Upcoming Classes
          </Text>
          <View style={typography.sectionTitleUnderline} />
          {classes
            .filter((gymClass) => gymClass.date >= todayKey)
            .sort(
              (left, right) =>
                left.date.localeCompare(right.date) ||
                left.startTime.localeCompare(right.startTime),
            )
            .slice(0, 10)
            .map((gymClass) => (
              <Pressable
                key={gymClass.id}
                style={[
                  styles.miniClass,
                  {
                    borderLeftColor: gymClass.color,
                    borderBottomColor: colors.border,
                  },
                ]}
                onPress={() => onSelectDate(gymClass.date)}
                testID={`schedule-mini-class-${gymClass.id}`}
              >
                <View style={styles.miniClassLeft}>
                  <Text style={styles.miniEmoji}>
                    {CATEGORY_EMOJI[gymClass.category] || "🏋️"}
                  </Text>
                  <View>
                    <Text style={[styles.miniClassName, { color: colors.text }]}>
                      {gymClass.name}
                    </Text>
                    <Text style={[styles.miniClassMeta, { color: colors.mutedForeground }]}>
                      {new Date(`${gymClass.date}T00:00:00`).toLocaleDateString("en-IN", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {gymClass.startTime}
                    </Text>
                  </View>
                </View>
                {isEnrolled(gymClass.id) ? (
                  <View
                    style={[
                      styles.miniEnrolledBadge,
                      { backgroundColor: `${colors.success}22` },
                    ]}
                  >
                    <Feather name="check" size={11} color={colors.success} />
                  </View>
                ) : null}
              </Pressable>
            ))}
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={!!confirmSheetClass}
        title={`Leave ${confirmSheetClass?.name}?`}
        message="You will be removed from this class."
        confirmText="Unenroll"
        cancelText="Keep Spot"
        destructive
        onConfirm={onConfirmUnenroll}
        onCancel={onCancelUnenroll}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingBottom: 8,
  },
  screenTitle: { fontSize: 28, fontWeight: "800" },
  adminPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  adminPillText: { fontSize: 12, fontWeight: "700" },
  calendarScroll: { maxHeight: 90 },
  calendarRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  dayBtn: {
    width: 56,
    height: 70,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    gap: 2,
  },
  dayName: { fontSize: 11, fontWeight: "600" },
  dayNum: { fontSize: 20, fontWeight: "700" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dot2: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#666" },
  dateLabel: { fontSize: 13, paddingHorizontal: 16, paddingBottom: 8 },
  scroll: { padding: 16, gap: 14 },
  feedbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feedbackText: { flex: 1, fontSize: 13, fontWeight: "600" },
  loadingState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 2,
  },
  loadingText: { fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, textAlign: "center" },
  classCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  cardHeader: { padding: 16, position: "relative" },
  cardHeaderContent: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardHeaderEmoji: { fontSize: 28 },
  cardHeaderText: { flex: 1 },
  cardHeaderName: { fontSize: 18, fontWeight: "800", color: "#fff" },
  cardHeaderTime: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
    fontWeight: "600",
  },
  enrolledBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
  },
  classContent: { padding: 14, gap: 10 },
  classMetaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  classMeta: { fontSize: 12 },
  classDesc: { fontSize: 13, lineHeight: 18 },
  capacityRow: { flexDirection: "row", alignItems: "center" },
  capacityText: { fontSize: 12, fontWeight: "500" },
  capacityBar: { height: 5, borderRadius: 3, overflow: "hidden" },
  capacityFill: { height: "100%", borderRadius: 3 },
  classActions: { flexDirection: "row", gap: 10 },
  enrollBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  enrollBtnText: { fontSize: 14, fontWeight: "600" },
  allClassesSection: { paddingTop: 16, borderTopWidth: 1, gap: 0 },
  allClassesTitle: { marginBottom: 4 },
  miniClass: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderBottomWidth: 1,
  },
  miniClassLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  miniEmoji: { fontSize: 18 },
  miniClassName: { fontSize: 14, fontWeight: "600" },
  miniClassMeta: { fontSize: 12, marginTop: 2 },
  miniEnrolledBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
