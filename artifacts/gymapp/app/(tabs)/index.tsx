// HOME SCREEN REPLACED
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
import { useNutrition } from "@/contexts/NutritionContext";
import { useWorkout } from "@/contexts/WorkoutContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { MacroRing } from "@/components/MacroRing";
import { MacroBar } from "@/components/MacroBar";
import { StatCard } from "@/components/StatCard";

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 80;

export default function HomeScreen() {
  const { user } = useUser();
  const { profile } = useApp();
  const { todayLog } = useNutrition();
  const { sessions, getRecentSessions } = useWorkout();
  const { getTodayClasses, isEnrolled } = useSchedule();
  const router = useRouter();
  const colors = useColors();

  const todayNutrition = useMemo(() => {
    return todayLog.entries.reduce(
      (acc, e) => ({ calories: acc.calories + e.calories, protein: acc.protein + e.protein, carbs: acc.carbs + e.carbs, fat: acc.fat + e.fat, fiber: acc.fiber + e.fiber }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    );
  }, [todayLog.entries]);

  const todayClasses = getTodayClasses();
  const recentSessions = getRecentSessions(3);

  const streak = useMemo(() => {
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      if (sessions.some((s) => s.date === dateKey && s.completed)) { count++; } else if (i > 0) break;
    }
    return count;
  }, [sessions]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning"; if (h < 17) return "Good afternoon"; return "Good evening";
  };

  const firstName = profile.name?.split(" ")[0] || user?.firstName || "there";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + 16 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting()}</Text>
            <Text style={[styles.name, { color: colors.text }]}>{firstName} 💪</Text>
          </View>
          <Pressable onPress={() => router.push("/profile")} style={[styles.avatar, { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{firstName[0]?.toUpperCase()}</Text>
          </Pressable>
        </View>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Calories</Text>
          <View style={styles.calorieSection}>
            <MacroRing calories={todayNutrition.calories} target={profile.dailyCalorieTarget} protein={todayNutrition.protein} carbs={todayNutrition.carbs} fat={todayNutrition.fat} size={160} />
            <View style={styles.calorieMeta}>
              <View style={styles.calorieStat}><Text style={[styles.calorieStatVal, { color: colors.primary }]}>{profile.dailyCalorieTarget}</Text><Text style={[styles.calorieStatLabel, { color: colors.mutedForeground }]}>Goal</Text></View>
              <View style={styles.calorieStat}><Text style={[styles.calorieStatVal, { color: colors.text }]}>{todayNutrition.calories}</Text><Text style={[styles.calorieStatLabel, { color: colors.mutedForeground }]}>Eaten</Text></View>
              <View style={styles.calorieStat}><Text style={[styles.calorieStatVal, { color: colors.success }]}>{Math.max(0, profile.dailyCalorieTarget - todayNutrition.calories)}</Text><Text style={[styles.calorieStatLabel, { color: colors.mutedForeground }]}>Left</Text></View>
            </View>
          </View>
          <MacroBar protein={todayNutrition.protein} carbs={todayNutrition.carbs} fat={todayNutrition.fat} proteinTarget={profile.dailyProteinTarget} carbTarget={profile.dailyCarbTarget} fatTarget={profile.dailyFatTarget} />
        </View>
        <View style={styles.statsGrid}>
          <View style={{ flex: 1 }}>
            <StatCard title="Streak" value={streak} unit="days" subtitle={streak > 0 ? "Keep it up!" : "Start today!"} icon={<Feather name="zap" size={16} color={colors.warning} />} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <StatCard title="Water" value={todayLog.waterIntake} unit="/ 8 glasses" subtitle="Stay hydrated" icon={<Feather name="droplet" size={16} color={colors.info} />} color={colors.info} progress={todayLog.waterIntake / 8} />
          </View>
        </View>
        {todayClasses.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Classes</Text>
              <Pressable onPress={() => router.push("/(tabs)/schedule")}><Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text></Pressable>
            </View>
            {todayClasses.slice(0, 2).map((cls) => (
              <View key={cls.id} style={[styles.classCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: cls.color, borderLeftWidth: 3 }]}>
                <View><Text style={[styles.className, { color: colors.text }]}>{cls.name}</Text><Text style={[styles.classInfo, { color: colors.mutedForeground }]}>{cls.startTime} · {cls.duration}min · {cls.trainer}</Text></View>
                <View style={[styles.classBadge, { backgroundColor: isEnrolled(cls.id) ? colors.success + "20" : colors.card }]}><Text style={[styles.classBadgeText, { color: isEnrolled(cls.id) ? colors.success : colors.mutedForeground }]}>{isEnrolled(cls.id) ? "Enrolled" : `${cls.enrolledCount}/${cls.maxParticipants}`}</Text></View>
              </View>
            ))}
          </View>
        )}
        {recentSessions.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Workouts</Text>
              <Pressable onPress={() => router.push("/(tabs)/workout")}><Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text></Pressable>
            </View>
            {recentSessions.map((s) => (
              <View key={s.id} style={[styles.workoutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.workoutIcon, { backgroundColor: colors.primary + "20" }]}><Feather name="activity" size={20} color={colors.primary} /></View>
                <View style={{ flex: 1 }}><Text style={[styles.workoutName, { color: colors.text }]}>{s.name}</Text><Text style={[styles.workoutMeta, { color: colors.mutedForeground }]}>{s.duration}min · {s.exercises.length} exercises · {s.totalVolume.toLocaleString()}kg vol</Text></View>
                <Text style={[styles.workoutDate, { color: colors.mutedForeground }]}>{s.date.slice(5)}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={[styles.aiTipCard, { backgroundColor: colors.primaryMuted, borderColor: colors.primary + "40" }]}>
          <View style={styles.aiTipHeader}><Feather name="cpu" size={16} color={colors.primary} /><Text style={[styles.aiTipTitle, { color: colors.primary }]}>AI Coach Tip</Text></View>
          <Text style={[styles.aiTipText, { color: colors.text }]}>{getTipForGoal(profile.fitnessGoal)}</Text>
          <Pressable onPress={() => router.push("/(tabs)/assistant")}><Text style={[styles.aiTipBtnText, { color: colors.primary }]}>Ask your AI Coach →</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getTipForGoal(goal: string): string {
  const tips: Record<string, string> = {
    lose_weight: "Try having a bowl of dal with roti instead of rice today — you'll save ~120 calories while keeping protein high. Consistency beats intensity!",
    build_muscle: "Post-workout, have paneer or eggs within 30 mins. Your muscles are primed for protein synthesis right now. Dal chawal is also a great combo!",
    maintain: "Focus on eating mostly whole foods today — dals, sabzis, and roti. Avoid processed snacks and stay hydrated.",
    improve_fitness: "Mix cardio and strength today. Try a 20-min run followed by compound lifts. Your body adapts to variety!",
  };
  return tips[goal] || tips.maintain;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  greeting: { fontSize: 14 },
  name: { fontSize: 24, fontWeight: "700" },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  avatarText: { fontSize: 18, fontWeight: "700" },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 16 },
  calorieSection: { flexDirection: "row", alignItems: "center", gap: 24 },
  calorieMeta: { flex: 1, gap: 16 },
  calorieStat: { alignItems: "center" },
  calorieStatVal: { fontSize: 22, fontWeight: "700" },
  calorieStatLabel: { fontSize: 11, marginTop: 2 },
  statsGrid: { flexDirection: "row", gap: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  seeAll: { fontSize: 14, fontWeight: "600" },
  classCard: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  className: { fontSize: 15, fontWeight: "600" },
  classInfo: { fontSize: 12, marginTop: 2 },
  classBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  classBadgeText: { fontSize: 12, fontWeight: "600" },
  workoutCard: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  workoutIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  workoutName: { fontSize: 15, fontWeight: "600" },
  workoutMeta: { fontSize: 12, marginTop: 2 },
  workoutDate: { fontSize: 12 },
  aiTipCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  aiTipHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  aiTipTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  aiTipText: { fontSize: 14, lineHeight: 20 },
  aiTipBtnText: { fontSize: 14, fontWeight: "600" },
});
