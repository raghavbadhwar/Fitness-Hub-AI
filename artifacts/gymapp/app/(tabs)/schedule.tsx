import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
import { useSchedule, GymClass } from "@/contexts/ScheduleContext";

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 80;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ScheduleScreen() {
  const { user } = useUser();
  const { profile } = useApp();
  const { classes, enrollInClass, unenrollFromClass, isEnrolled, getClassesForDate } = useSchedule();
  const router = useRouter();
  const colors = useColors();

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split("T")[0]);

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + i);
    return d;
  });

  const selectedClasses = getClassesForDate(selectedDate);

  const handleEnroll = async (cls: GymClass) => {
    if (isEnrolled(cls.id)) {
      Alert.alert("Unenroll", `Leave ${cls.name}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Unenroll", style: "destructive", onPress: () => unenrollFromClass(cls.id, user?.id || "me") },
      ]);
    } else {
      if (cls.enrolledCount >= cls.maxParticipants) {
        Alert.alert("Class Full", "This class is fully booked.");
        return;
      }
      await enrollInClass(cls.id, user?.id || "me");
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>Schedule</Text>
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
            return (
              <View key={cls.id} style={[styles.classCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.colorStrip, { backgroundColor: cls.color }]} />
                <View style={styles.classContent}>
                  <View style={styles.classHeader}>
                    <View>
                      <Text style={[styles.className, { color: colors.text }]}>{cls.name}</Text>
                      <View style={styles.classMetaRow}>
                        <Feather name="clock" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.classMeta, { color: colors.mutedForeground }]}>{cls.startTime} · {cls.duration} min</Text>
                        <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.classMeta, { color: colors.mutedForeground }]}>{cls.room}</Text>
                      </View>
                      <View style={styles.classMetaRow}>
                        <Feather name="user" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.classMeta, { color: colors.mutedForeground }]}>{cls.trainer}</Text>
                      </View>
                    </View>
                    <View style={styles.classRight}>
                      <View style={[styles.categoryBadge, { backgroundColor: cls.color + "20" }]}>
                        <Text style={[styles.categoryText, { color: cls.color }]}>{cls.category}</Text>
                      </View>
                      <Text style={[styles.spotsText, { color: full ? colors.error : colors.mutedForeground }]}>
                        {full ? "Full" : `${cls.enrolledCount}/${cls.maxParticipants}`}
                      </Text>
                    </View>
                  </View>
                  {cls.description && (
                    <Text style={[styles.classDesc, { color: colors.mutedForeground }]}>{cls.description}</Text>
                  )}
                  <View style={styles.classActions}>
                    <Pressable
                      style={[styles.enrollBtn, enrolled ? { backgroundColor: colors.surface, borderColor: colors.border } : full ? { backgroundColor: colors.muted, borderColor: colors.border } : { backgroundColor: cls.color }]}
                      onPress={() => handleEnroll(cls)}
                      disabled={full && !enrolled}
                    >
                      <Text style={[styles.enrollBtnText, { color: enrolled ? colors.text : full ? colors.mutedForeground : "#fff" }]}>
                        {enrolled ? "Unenroll" : full ? "Class Full" : "Enroll Now"}
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
          <Text style={[styles.allClassesTitle, { color: colors.text }]}>All Upcoming Classes</Text>
          {classes
            .filter((c) => c.date >= today.toISOString().split("T")[0])
            .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
            .slice(0, 10)
            .map((cls) => (
              <Pressable key={cls.id} style={[styles.miniClass, { borderLeftColor: cls.color, borderBottomColor: colors.border }]} onPress={() => setSelectedDate(cls.date)}>
                <View>
                  <Text style={[styles.miniClassName, { color: colors.text }]}>{cls.name}</Text>
                  <Text style={[styles.miniClassMeta, { color: colors.mutedForeground }]}>
                    {new Date(cls.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })} · {cls.startTime}
                  </Text>
                </View>
                {isEnrolled(cls.id) && <View style={[styles.enrolledDot, { backgroundColor: colors.success }]} />}
              </Pressable>
            ))}
        </View>
      </ScrollView>
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
  dateLabel: { fontSize: 13, paddingHorizontal: 16, paddingBottom: 8 },
  scroll: { padding: 16, gap: 12 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, textAlign: "center" },
  scheduleBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  scheduleBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  classCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden", flexDirection: "row" },
  colorStrip: { width: 4 },
  classContent: { flex: 1, padding: 14, gap: 10 },
  classHeader: { flexDirection: "row", justifyContent: "space-between" },
  className: { fontSize: 16, fontWeight: "700" },
  classMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  classMeta: { fontSize: 12 },
  classRight: { alignItems: "flex-end", gap: 6 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  categoryText: { fontSize: 11, fontWeight: "600" },
  spotsText: { fontSize: 12 },
  classDesc: { fontSize: 13, lineHeight: 18 },
  classActions: { flexDirection: "row", gap: 10 },
  enrollBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  enrollBtnText: { fontSize: 14, fontWeight: "600" },
  editBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  allClassesSection: { paddingTop: 16, borderTopWidth: 1, gap: 0 },
  allClassesTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  miniClass: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingLeft: 12, borderLeftWidth: 3, borderBottomWidth: 1, marginBottom: 0 },
  miniClassName: { fontSize: 14, fontWeight: "600" },
  miniClassMeta: { fontSize: 12, marginTop: 2 },
  enrolledDot: { width: 8, height: 8, borderRadius: 4 },
});
