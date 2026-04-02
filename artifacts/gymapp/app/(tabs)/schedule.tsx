import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTypography } from "@/hooks/useTypography";
import { useApp } from "@/contexts/AppContext";
import { useSchedule, GymClass, ClassCategory } from "@/contexts/ScheduleContext";
import { ConfirmSheet } from "@/components/ConfirmSheet";

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

export default function ScheduleScreen() {
  const { user } = useUser();
  const { profile } = useApp();
  const { classes, enrollInClass, unenrollFromClass, isEnrolled, getClassesForDate } = useSchedule();
  const router = useRouter();
  const colors = useColors();
  const typography = useTypography();

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split("T")[0]);
  const [confirmSheet, setConfirmSheet] = useState<{ cls: GymClass } | null>(null);

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + i);
    return d;
  });

  const selectedClasses = getClassesForDate(selectedDate);

  const handleEnroll = async (cls: GymClass) => {
    if (isEnrolled(cls.id)) {
      setConfirmSheet({ cls });
    } else {
      if (cls.enrolledCount >= cls.maxParticipants) {
        return;
      }
      await enrollInClass(cls.id, user?.id || "me");
    }
  };

  const handleConfirmUnenroll = async () => {
    if (!confirmSheet) return;
    await unenrollFromClass(confirmSheet.cls.id, user?.id || "me");
    setConfirmSheet(null);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Text style={[styles.screenTitle, typography.screenTitle, { color: colors.text }]}>Schedule</Text>
        {(profile.role === "owner" || profile.role === "trainer") && (
          <Pressable style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/manage-class")}>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add Class</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.calendarRow}
        style={styles.calendarScroll}
      >
        {week.map((d) => {
          const dateKey = d.toISOString().split("T")[0];
          const isSelected = selectedDate === dateKey;
          const isToday = dateKey === today.toISOString().split("T")[0];
          const hasClasses = getClassesForDate(dateKey).length > 0;
          return (
            <Pressable
              key={dateKey}
              onPress={() => setSelectedDate(dateKey)}
              style={[styles.dayBtn, { backgroundColor: isSelected ? colors.primary : colors.card, borderColor: isToday ? colors.primary : colors.border }]}
            >
              <Text style={[styles.dayName, { color: isSelected ? "#fff" : colors.mutedForeground }]}>{WEEKDAYS[d.getDay()]}</Text>
              <Text style={[styles.dayNum, { color: isSelected ? "#fff" : colors.text }]}>{d.getDate()}</Text>
              {hasClasses && <View style={[styles.dot, { backgroundColor: isSelected ? "#ffffff80" : colors.primary }]} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
        {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
      </Text>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + 16 }]} showsVerticalScrollIndicator={false}>
        {selectedClasses.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="calendar" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No classes on this day</Text>
            {(profile.role === "owner" || profile.role === "trainer") && (
              <Pressable style={[styles.scheduleBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/manage-class")}>
                <Text style={styles.scheduleBtnText}>Schedule a Class</Text>
              </Pressable>
            )}
          </View>
        ) : (
          selectedClasses.map((cls) => {
            const enrolled = isEnrolled(cls.id);
            const full = cls.enrolledCount >= cls.maxParticipants && !enrolled;
            const capacityPct = Math.min((cls.enrolledCount / cls.maxParticipants) * 100, 100);
            const emoji = CATEGORY_EMOJI[cls.category] || "🏋️";
            return (
              <View key={cls.id} style={[styles.classCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <LinearGradient
                  colors={[cls.color, cls.color + "BB"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardHeader}
                >
                  <View style={styles.cardHeaderContent}>
                    <Text style={styles.cardHeaderEmoji}>{emoji}</Text>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardHeaderName}>{cls.name}</Text>
                      <Text style={styles.cardHeaderTime}>{cls.startTime} · {cls.duration} min</Text>
                    </View>
                  </View>
                  {enrolled && (
                    <View style={styles.enrolledBadge}>
                      <Feather name="check" size={12} color="#fff" />
                    </View>
                  )}
                </LinearGradient>

                <View style={styles.classContent}>
                  <View style={styles.classMetaRow}>
                    <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.classMeta, { color: colors.mutedForeground }]}>{cls.room}</Text>
                    <View style={styles.dot2} />
                    <Feather name="user" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.classMeta, { color: colors.mutedForeground }]}>{cls.trainer}</Text>
                  </View>

                  {cls.description ? (
                    <Text style={[styles.classDesc, { color: colors.mutedForeground }]}>{cls.description}</Text>
                  ) : null}

                  <View style={styles.capacityRow}>
                    <Text style={[styles.capacityText, { color: full ? colors.error : colors.mutedForeground }]}>
                      {cls.enrolledCount}/{cls.maxParticipants} enrolled
                      {full ? " · Full" : ""}
                    </Text>
                  </View>
                  <View style={[styles.capacityBar, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.capacityFill,
                        {
                          width: `${capacityPct}%`,
                          backgroundColor: capacityPct >= 90 ? colors.error : capacityPct >= 70 ? colors.warning : cls.color,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.classActions}>
                    <Pressable
                      style={[
                        styles.enrollBtn,
                        enrolled
                          ? { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }
                          : full
                          ? { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 }
                          : { backgroundColor: cls.color },
                      ]}
                      onPress={() => handleEnroll(cls)}
                      disabled={full && !enrolled}
                    >
                      {enrolled && <Feather name="check" size={14} color={colors.text} style={{ marginRight: 4 }} />}
                      <Text style={[styles.enrollBtnText, { color: enrolled ? colors.text : full ? colors.mutedForeground : "#fff" }]}>
                        {enrolled ? "Enrolled" : full ? "Class Full" : "Enroll Now"}
                      </Text>
                    </Pressable>
                    {(profile.role === "owner" || profile.role === "trainer") && (
                      <Pressable style={[styles.editBtn, { borderColor: colors.border }]} onPress={() => router.push({ pathname: "/manage-class", params: { classId: cls.id } })}>
                        <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}

        <View style={[styles.allClassesSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.allClassesTitle, typography.sectionTitle, { color: colors.text }]}>All Upcoming Classes</Text>
          <View style={typography.sectionTitleUnderline} />
          {classes
            .filter((c) => c.date >= today.toISOString().split("T")[0])
            .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
            .slice(0, 10)
            .map((cls) => (
              <Pressable key={cls.id} style={[styles.miniClass, { borderLeftColor: cls.color, borderBottomColor: colors.border }]} onPress={() => setSelectedDate(cls.date)}>
                <View style={styles.miniClassLeft}>
                  <Text style={styles.miniEmoji}>{CATEGORY_EMOJI[cls.category] || "🏋️"}</Text>
                  <View>
                    <Text style={[styles.miniClassName, { color: colors.text }]}>{cls.name}</Text>
                    <Text style={[styles.miniClassMeta, { color: colors.mutedForeground }]}>
                      {new Date(cls.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })} · {cls.startTime}
                    </Text>
                  </View>
                </View>
                {isEnrolled(cls.id) && (
                  <View style={[styles.miniEnrolledBadge, { backgroundColor: colors.success + "22" }]}>
                    <Feather name="check" size={11} color={colors.success} />
                  </View>
                )}
              </Pressable>
            ))}
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={!!confirmSheet}
        title={`Leave ${confirmSheet?.cls.name}?`}
        message="You will be removed from this class."
        confirmText="Unenroll"
        cancelText="Keep Spot"
        destructive
        onConfirm={handleConfirmUnenroll}
        onCancel={() => setConfirmSheet(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingBottom: 8 },
  screenTitle: { fontSize: 28, fontWeight: "800" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  calendarScroll: { maxHeight: 90 },
  calendarRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  dayBtn: { width: 56, height: 70, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, gap: 2 },
  dayName: { fontSize: 11, fontWeight: "600" },
  dayNum: { fontSize: 20, fontWeight: "700" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dot2: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#666" },
  dateLabel: { fontSize: 13, paddingHorizontal: 16, paddingBottom: 8 },
  scroll: { padding: 16, gap: 14 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, textAlign: "center" },
  scheduleBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  scheduleBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  classCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  cardHeader: { padding: 16, position: "relative" },
  cardHeaderContent: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardHeaderEmoji: { fontSize: 28 },
  cardHeaderText: { flex: 1 },
  cardHeaderName: { fontSize: 18, fontWeight: "800", color: "#fff" },
  cardHeaderTime: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 2, fontWeight: "600" },
  enrolledBadge: { position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" },
  classContent: { padding: 14, gap: 10 },
  classMetaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  classMeta: { fontSize: 12 },
  classDesc: { fontSize: 13, lineHeight: 18 },
  capacityRow: { flexDirection: "row", alignItems: "center" },
  capacityText: { fontSize: 12, fontWeight: "500" },
  capacityBar: { height: 5, borderRadius: 3, overflow: "hidden" },
  capacityFill: { height: "100%", borderRadius: 3 },
  classActions: { flexDirection: "row", gap: 10 },
  enrollBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center" },
  enrollBtnText: { fontSize: 14, fontWeight: "600" },
  editBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  allClassesSection: { paddingTop: 16, borderTopWidth: 1, gap: 0 },
  allClassesTitle: { marginBottom: 4 },
  miniClass: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingLeft: 12, borderLeftWidth: 3, borderBottomWidth: 1 },
  miniClassLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  miniEmoji: { fontSize: 18 },
  miniClassName: { fontSize: 14, fontWeight: "600" },
  miniClassMeta: { fontSize: 12, marginTop: 2 },
  miniEnrolledBadge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
