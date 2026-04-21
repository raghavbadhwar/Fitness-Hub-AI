import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "@/components/native-compat";
import { useColors } from "@/hooks/useColors";
import { SessionSummary, WorkoutExercise, ExerciseSet, PersonalRecord } from "@/contexts/WorkoutContext";
import { useAuth } from "@clerk/expo";
import { getApiBase } from "@/lib/api-base";

const USE_NATIVE_DRIVER = Platform.OS !== "web";

export default function WorkoutCompleteScreen() {
  const params = useLocalSearchParams<{
    summaryJson: string;
    assignedWorkoutId?: string;
  }>();
  const router = useRouter();
  const colors = useColors();
  const { getToken } = useAuth();

  let summary: SessionSummary | null = null;
  try {
    summary = params.summaryJson ? JSON.parse(params.summaryJson) : null;
  } catch {
    summary = null;
  }
  const session = summary?.session ?? null;
  const newPRs: PersonalRecord[] = summary?.newPRs ?? [];

  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const prScaleAnim = useRef(new Animated.Value(0)).current;

  const [prVisible, setPrVisible] = useState(false);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (params.assignedWorkoutId) {
      const markComplete = async () => {
        try {
          const token = await getToken();
          await fetch(`${getApiBase()}/api/workouts/assigned/${params.assignedWorkoutId}/complete`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (err) {
          console.error("Failed to mark assigned workout complete", err);
        }
      };
      markComplete();
    }

    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start(() => {
      if (newPRs.length > 0) {
        setTimeout(() => {
          setPrVisible(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Animated.spring(prScaleAnim, { toValue: 1, tension: 100, friction: 7, useNativeDriver: USE_NATIVE_DRIVER }).start();
        }, 300);
      }
    });
  }, []);

  const formatDuration = (minutes: number) => {
    if (!minutes) return "0 min";
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const completedSets = session?.exercises?.reduce(
    (total: number, ex: WorkoutExercise) => total + ex.sets.filter((s: ExerciseSet) => s.completed).length,
    0
  ) ?? 0;

  const handleShare = async () => {
    if (!session) return;
    const prText = newPRs.length > 0
      ? `\n\nNew PRs:\n${newPRs.map((pr) => `• ${pr.name}: ${pr.weight}kg × ${pr.reps}`).join("\n")}`
      : "";
    const text = `Workout complete! 💪\n\n${session.name}\nDuration: ${formatDuration(session.duration ?? 0)}\nSets: ${completedSets}\nVolume: ${session.totalVolume?.toLocaleString() ?? 0}kg${prText}\n\nLogged with GymOS`;
    try {
      await Share.share({ message: text });
    } catch {
      // Share dismissed
    }
  };

  const handleDone = () => {
    router.replace("/(tabs)/workout");
  };

  if (!session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: colors.text }]}>Summary not available</Text>
          <Pressable onPress={handleDone} style={[styles.doneBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.heroSection, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.trophy, { backgroundColor: colors.primary + "20" }]}>
            <Text style={styles.trophyEmoji}>🏆</Text>
          </View>
          <Text style={[styles.completeTitle, { color: colors.text }]}>Workout Complete!</Text>
          <Text style={[styles.sessionName, { color: colors.mutedForeground }]}>{session.name}</Text>
        </Animated.View>

        <Animated.View style={[styles.statsGrid, { opacity: opacityAnim }]}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="clock" size={22} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{formatDuration(session.duration ?? 0)}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Duration</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="check-circle" size={22} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.text }]}>{completedSets}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Sets Done</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="trending-up" size={22} color={colors.info} />
            <Text style={[styles.statValue, { color: colors.text }]}>{(session.totalVolume ?? 0).toLocaleString()}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Volume (kg)</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="zap" size={22} color={colors.warning} />
            <Text style={[styles.statValue, { color: colors.text }]}>{session.caloriesBurned ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Calories</Text>
          </View>
        </Animated.View>

        {prVisible && newPRs.length > 0 && (
          <Animated.View style={[styles.prSection, { transform: [{ scale: prScaleAnim }] }]}>
            <View style={[styles.prHeader, { backgroundColor: colors.warning + "15", borderColor: colors.warning + "40" }]}>
              <Feather name="award" size={20} color={colors.warning} />
              <Text style={[styles.prHeaderText, { color: colors.warning }]}>
                {newPRs.length === 1 ? "New Personal Record!" : `${newPRs.length} New Personal Records!`}
              </Text>
            </View>
            {newPRs.map((pr) => (
              <View key={pr.exerciseId} style={[styles.prCard, { backgroundColor: colors.card, borderColor: colors.warning + "30" }]}>
                <Text style={styles.prStar}>⭐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.prName, { color: colors.text }]}>{pr.name}</Text>
                  <Text style={[styles.prWeight, { color: colors.warning }]}>{pr.weight}kg × {pr.reps} reps</Text>
                </View>
                <Feather name="award" size={18} color={colors.warning} />
              </View>
            ))}
          </Animated.View>
        )}

        {session.exercises && session.exercises.length > 0 && (
          <Animated.View style={{ opacity: opacityAnim }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Exercises</Text>
            {session.exercises.map((ex: WorkoutExercise) => {
              const done = ex.sets.filter((s: ExerciseSet) => s.completed).length;
              return (
                <View key={ex.id} style={[styles.exerciseRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.exerciseName, { color: colors.text }]}>{ex.name}</Text>
                  <Text style={[styles.exerciseSets, { color: colors.mutedForeground }]}>{done}/{ex.sets.length} sets</Text>
                </View>
              );
            })}
          </Animated.View>
        )}

        <Animated.View style={[styles.actions, { opacity: opacityAnim }]}>
          <Pressable style={[styles.shareBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleShare}>
            <Feather name="share" size={18} color={colors.text} />
            <Text style={[styles.shareBtnText, { color: colors.text }]}>Share</Text>
          </Pressable>
          <Pressable style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={handleDone}>
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, gap: 24, paddingBottom: 48 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { fontSize: 16 },
  heroSection: { alignItems: "center", gap: 12, paddingTop: 16 },
  trophy: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  trophyEmoji: { fontSize: 52 },
  completeTitle: { fontSize: 32, fontWeight: "800", textAlign: "center" },
  sessionName: { fontSize: 16, textAlign: "center" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: { width: "47%", borderRadius: 16, padding: 16, borderWidth: 1, alignItems: "center", gap: 8 },
  statValue: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: 12, fontWeight: "500" },
  prSection: { gap: 10 },
  prHeader: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 14, borderWidth: 1 },
  prHeaderText: { fontSize: 16, fontWeight: "700" },
  prCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 14, borderWidth: 1 },
  prStar: { fontSize: 20 },
  prName: { fontSize: 15, fontWeight: "600" },
  prWeight: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  exerciseRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 10, padding: 12, borderWidth: 1, marginBottom: 8 },
  exerciseName: { fontSize: 14, fontWeight: "500" },
  exerciseSets: { fontSize: 13 },
  actions: { flexDirection: "row", gap: 12, marginTop: 8 },
  shareBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 16, borderWidth: 1 },
  shareBtnText: { fontSize: 15, fontWeight: "600" },
  doneBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 16 },
  doneBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
