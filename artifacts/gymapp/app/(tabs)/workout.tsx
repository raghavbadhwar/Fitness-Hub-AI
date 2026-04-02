import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
import { useWorkout } from "@/contexts/WorkoutContext";
import { EXERCISES, searchExercises } from "@/constants/exercises";

const MUSCLE_FILTER_CHIPS = [
  "All",
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
  "Cardio",
  "Yoga",
];

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 80;

const QUICK_STARTS = [
  { name: "Push Day", exercises: ["bench_press", "incline_press", "cable_crossover", "overhead_press", "lateral_raise", "tricep_pushdown"] },
  { name: "Pull Day", exercises: ["pullup", "bent_row", "lat_pulldown", "seated_row", "bicep_curl", "hammer_curl"] },
  { name: "Leg Day", exercises: ["squat", "leg_press", "lunges", "leg_curl", "calf_raise", "rdl"] },
  { name: "Full Body", exercises: ["deadlift", "bench_press", "pullup", "squat", "overhead_press", "plank"] },
  { name: "Cardio & Core", exercises: ["burpee", "mountain_climber", "plank", "crunches", "jumping_jacks", "leg_raises"] },
  { name: "Upper Body", exercises: ["bench_press", "bent_row", "overhead_press", "lat_pulldown", "bicep_curl", "dips"] },
];

export default function WorkoutScreen() {
  const { profile } = useApp();
  const { sessions, personalRecords, startSession, getWeeklyVolume } = useWorkout();
  const router = useRouter();
  const colors = useColors();
  const [loadingAI, setLoadingAI] = useState(false);
  const [activeTab, setActiveTab] = useState<"workouts" | "exercises" | "records">("workouts");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState("All");

  const weeklyVolume = getWeeklyVolume();
  const thisWeekVolume = weeklyVolume.reduce((sum, d) => sum + d.volume, 0);
  const recentSessions = sessions.slice(0, 10);

  const filteredExercises = useMemo(() => {
    return searchExercises(exerciseSearch, selectedMuscle === "All" ? undefined : selectedMuscle);
  }, [exerciseSearch, selectedMuscle]);

  const handleQuickStart = (template: typeof QUICK_STARTS[0]) => {
    const exercises = template.exercises.map((id) => {
      const ex = EXERCISES.find((e) => e.id === id)!;
      return {
        exerciseId: ex.id,
        name: ex.name,
        sets: Array.from({ length: ex.defaultSets }, (_, i) => ({
          id: Date.now().toString() + i,
          weight: 0,
          reps: parseInt(ex.defaultReps) || 10,
          completed: false,
        })),
      };
    });
    const session = startSession(template.name, exercises);
    router.push({ pathname: "/workout-session", params: { sessionId: session.id } });
  };

  const handleAIWorkout = async () => {
    setLoadingAI(true);
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const apiBase = domain ? `https://${domain}` : "";
      const recentData = recentSessions.slice(0, 3).map((s) => ({ name: s.name, exercises: s.exercises.map((e) => e.name) }));
      const response = await fetch(`${apiBase}/api/ai/workout-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recentWorkouts: recentData,
          goals: profile.fitnessGoal,
          fitnessLevel: "intermediate",
          availableTime: 45,
        }),
      });
      if (!response.ok) throw new Error("Failed to get workout");
      const suggestion = await response.json();

      const exercises = (suggestion.exercises || []).map((ex: any) => {
        const found = EXERCISES.find((e) => e.name.toLowerCase().includes(ex.name.toLowerCase().split(" ")[0]));
        return {
          exerciseId: found?.id || "custom",
          name: ex.name,
          sets: Array.from({ length: ex.sets || 3 }, (_, i) => ({
            id: Date.now().toString() + i,
            weight: 0,
            reps: parseInt(ex.reps) || 10,
            completed: false,
          })),
          notes: ex.notes,
        };
      });

      const session = startSession(suggestion.workoutName || "AI Workout", exercises);
      router.push({ pathname: "/workout-session", params: { sessionId: session.id } });
    } catch (err) {
      Alert.alert("Error", "Failed to generate AI workout. Please try again.");
    } finally {
      setLoadingAI(false);
    }
  };

  const prs = Object.values(personalRecords);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>Workout</Text>
        <Pressable
          style={[styles.startBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            const session = startSession("Custom Workout");
            router.push({ pathname: "/workout-session", params: { sessionId: session.id } });
          }}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.startBtnText}>Start</Text>
        </Pressable>
      </View>

      <View style={styles.weekStats}>
        <View style={[styles.weekStatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.weekStatVal, { color: colors.primary }]}>{sessions.filter((s) => {
            const today = new Date();
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            return new Date(s.date) >= weekAgo && s.completed;
          }).length}</Text>
          <Text style={[styles.weekStatLabel, { color: colors.mutedForeground }]}>This Week</Text>
        </View>
        <View style={[styles.weekStatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.weekStatVal, { color: colors.text }]}>{Math.round(thisWeekVolume / 1000)}k</Text>
          <Text style={[styles.weekStatLabel, { color: colors.mutedForeground }]}>Volume (kg)</Text>
        </View>
        <View style={[styles.weekStatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.weekStatVal, { color: colors.success }]}>{prs.length}</Text>
          <Text style={[styles.weekStatLabel, { color: colors.mutedForeground }]}>Total PRs</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(["workouts", "exercises", "records"] as const).map((tab) => (
          <Pressable key={tab} style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
              {tab === "workouts" ? "Workouts" : tab === "exercises" ? "Exercises" : "Records"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + 16 }]} showsVerticalScrollIndicator={false}>
        {activeTab === "workouts" && (
          <>
            <Pressable style={[styles.aiWorkoutCard, { backgroundColor: colors.primaryMuted, borderColor: colors.primary + "50" }]} onPress={handleAIWorkout} disabled={loadingAI}>
              <View style={styles.aiWorkoutInner}>
                <View style={[styles.aiWorkoutIcon, { backgroundColor: colors.primary }]}>
                  {loadingAI ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="cpu" size={20} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.aiWorkoutTitle, { color: colors.text }]}>AI Workout Generator</Text>
                  <Text style={[styles.aiWorkoutSubtitle, { color: colors.mutedForeground }]}>Personalized plan based on your history & goals</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.primary} />
              </View>
            </Pressable>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Start Templates</Text>
            <View style={styles.templateGrid}>
              {QUICK_STARTS.map((t) => (
                <Pressable key={t.name} style={[styles.templateCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => handleQuickStart(t)}>
                  <Text style={[styles.templateName, { color: colors.text }]}>{t.name}</Text>
                  <Text style={[styles.templateCount, { color: colors.mutedForeground }]}>{t.exercises.length} exercises</Text>
                </Pressable>
              ))}
            </View>

            {recentSessions.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>History</Text>
                {recentSessions.map((s) => (
                  <View key={s.id} style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.sessionHeader}>
                      <Text style={[styles.sessionName, { color: colors.text }]}>{s.name}</Text>
                      <Text style={[styles.sessionDate, { color: colors.mutedForeground }]}>{s.date}</Text>
                    </View>
                    <View style={styles.sessionStats}>
                      <Text style={[styles.sessionStat, { color: colors.mutedForeground }]}><Text style={{ color: colors.text, fontWeight: "600" }}>{s.duration}</Text> min</Text>
                      <Text style={[styles.sessionStat, { color: colors.mutedForeground }]}><Text style={{ color: colors.text, fontWeight: "600" }}>{s.exercises.length}</Text> exercises</Text>
                      <Text style={[styles.sessionStat, { color: colors.mutedForeground }]}><Text style={{ color: colors.text, fontWeight: "600" }}>{s.totalVolume.toLocaleString()}</Text> kg vol</Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {recentSessions.length === 0 && (
              <View style={styles.empty}>
                <Feather name="activity" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No workouts yet. Start your first session!</Text>
              </View>
            )}
          </>
        )}

        {activeTab === "exercises" && (
          <View>
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search exercises..."
                placeholderTextColor={colors.mutedForeground}
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
              {exerciseSearch.length > 0 && (
                <Pressable onPress={() => setExerciseSearch("")}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipContainer}
            >
              {MUSCLE_FILTER_CHIPS.map((chip) => (
                <Pressable
                  key={chip}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedMuscle === chip ? colors.primary : colors.card,
                      borderColor: selectedMuscle === chip ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedMuscle(chip)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: selectedMuscle === chip ? "#fff" : colors.mutedForeground },
                    ]}
                  >
                    {chip}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {filteredExercises.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="search" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No exercises found. Try a different search or filter.
                </Text>
              </View>
            ) : (
              <View style={styles.exerciseList}>
                {filteredExercises.map((ex) => (
                  <View key={ex.id} style={[styles.exerciseItem, { borderBottomColor: colors.border }]}>
                    <View style={[styles.exCategory, { backgroundColor: colors.primary + "20" }]}>
                      <Text style={[styles.exCategoryText, { color: colors.primary }]}>{ex.muscleGroup[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.exName, { color: colors.text }]}>{ex.name}</Text>
                      <Text style={[styles.exMeta, { color: colors.mutedForeground }]}>
                        {ex.muscleGroup} · {ex.equipment} · {ex.defaultSets}×{ex.defaultReps}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === "records" && (
          <View>
            {prs.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="award" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No personal records yet. Complete workouts to set PRs!</Text>
              </View>
            ) : (
              prs.map((pr) => (
                <View key={pr.exerciseId} style={[styles.prCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="award" size={20} color={colors.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.prName, { color: colors.text }]}>{pr.name}</Text>
                    <Text style={[styles.prDate, { color: colors.mutedForeground }]}>{pr.date}</Text>
                  </View>
                  <Text style={[styles.prValue, { color: colors.primary }]}>{pr.weight}kg × {pr.reps}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingBottom: 8 },
  screenTitle: { fontSize: 28, fontWeight: "800" },
  startBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  startBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  weekStats: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 4 },
  weekStatCard: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, alignItems: "center" },
  weekStatVal: { fontSize: 24, fontWeight: "700" },
  weekStatLabel: { fontSize: 11, marginTop: 2 },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "transparent", marginHorizontal: 16, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center" },
  tabText: { fontSize: 14, fontWeight: "600" },
  scroll: { paddingHorizontal: 16, gap: 12 },
  aiWorkoutCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  aiWorkoutInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  aiWorkoutIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  aiWorkoutTitle: { fontSize: 16, fontWeight: "700" },
  aiWorkoutSubtitle: { fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 4 },
  templateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  templateCard: { width: "47%", borderRadius: 12, padding: 14, borderWidth: 1 },
  templateName: { fontSize: 14, fontWeight: "600" },
  templateCount: { fontSize: 12, marginTop: 4 },
  sessionCard: { borderRadius: 12, padding: 14, borderWidth: 1 },
  sessionHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  sessionName: { fontSize: 15, fontWeight: "600" },
  sessionDate: { fontSize: 12 },
  sessionStats: { flexDirection: "row", gap: 16 },
  sessionStat: { fontSize: 13 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  chipScroll: { marginBottom: 10 },
  chipContainer: { flexDirection: "row", gap: 8, paddingRight: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600" },
  exerciseList: {},
  exerciseItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  exCategory: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  exCategoryText: { fontSize: 14, fontWeight: "700" },
  exName: { fontSize: 15, fontWeight: "500" },
  exMeta: { fontSize: 12, marginTop: 2 },
  prCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 8 },
  prName: { fontSize: 15, fontWeight: "600" },
  prDate: { fontSize: 12 },
  prValue: { fontSize: 16, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, textAlign: "center", paddingHorizontal: 30, lineHeight: 22 },
});
