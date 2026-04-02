import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
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
import { useWorkout, WorkoutExercise, ExerciseSet } from "@/contexts/WorkoutContext";
import { EXERCISES } from "@/constants/exercises";

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export default function WorkoutSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { activeSession, endSession, addExerciseToSession, updateSet } = useWorkout();
  const router = useRouter();
  const colors = useColors();

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const session = activeSession;

  if (!session || session.id !== sessionId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: colors.text }]}>Session not found</Text>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const totalSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const completedSets = session.exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0);
  const totalVolume = session.exercises.reduce(
    (total, ex) => total + ex.sets.filter((s) => s.completed).reduce((sum, s) => sum + s.weight * s.reps, 0),
    0,
  );

  const handleFinish = () => {
    Alert.alert("Finish Workout?", `${formatTime(elapsed)} · ${completedSets}/${totalSets} sets · ${totalVolume}kg volume`, [
      { text: "Keep Going", style: "cancel" },
      {
        text: "Finish",
        onPress: async () => {
          if (timerRef.current) clearInterval(timerRef.current);
          await endSession(session.id);
          router.back();
        },
      },
    ]);
  };

  const handleAddSet = (exerciseId: string, exercise: WorkoutExercise) => {
    const lastSet = exercise.sets[exercise.sets.length - 1];
    updateSet(session.id, exerciseId, "__add__", {
      id: generateId(),
      weight: lastSet?.weight || 0,
      reps: lastSet?.reps || 10,
      completed: false,
    } as any);
  };

  const addExercise = (exerciseId: string) => {
    const ex = EXERCISES.find((e) => e.id === exerciseId);
    if (!ex) return;
    addExerciseToSession(session.id, {
      exerciseId: ex.id,
      name: ex.name,
      sets: Array.from({ length: ex.defaultSets }, (_, i) => ({
        id: generateId(),
        weight: 0,
        reps: parseInt(ex.defaultReps) || 10,
        completed: false,
      })),
    });
    setShowExercisePicker(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.sessionName, { color: colors.text }]}>{session.name}</Text>
          <Text style={[styles.timer, { color: colors.primary }]}>{formatTime(elapsed)}</Text>
        </View>
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={[styles.headerStatVal, { color: colors.text }]}>{completedSets}/{totalSets}</Text>
            <Text style={[styles.headerStatLabel, { color: colors.mutedForeground }]}>Sets</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={[styles.headerStatVal, { color: colors.text }]}>{totalVolume}</Text>
            <Text style={[styles.headerStatLabel, { color: colors.mutedForeground }]}>Vol (kg)</Text>
          </View>
        </View>
      </View>

      <View style={[styles.progress, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%`, backgroundColor: colors.primary }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {session.exercises.length === 0 ? (
          <View style={styles.emptyExercises}>
            <Feather name="plus-circle" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Tap "Add Exercise" to begin</Text>
          </View>
        ) : (
          session.exercises.map((ex) => (
            <Pressable key={ex.id} onPress={() => setExpandedExercise(expandedExercise === ex.id ? null : ex.id)}>
              <View style={[styles.exerciseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.exHeader}>
                  <Text style={[styles.exName, { color: colors.text }]}>{ex.name}</Text>
                  <View style={styles.exHeaderRight}>
                    <Text style={[styles.exSetsCount, { color: colors.mutedForeground }]}>
                      {ex.sets.filter((s) => s.completed).length}/{ex.sets.length} sets
                    </Text>
                    <Feather name={expandedExercise === ex.id ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
                  </View>
                </View>

                {(expandedExercise === ex.id || expandedExercise === null) && (
                  <View style={styles.setsContainer}>
                    <View style={styles.setHeaderRow}>
                      <Text style={[styles.setHeaderLabel, { color: colors.mutedForeground }]}>Set</Text>
                      <Text style={[styles.setHeaderLabel, { color: colors.mutedForeground }]}>Weight (kg)</Text>
                      <Text style={[styles.setHeaderLabel, { color: colors.mutedForeground }]}>Reps</Text>
                      <Text style={[styles.setHeaderLabel, { color: colors.mutedForeground }]}>Done</Text>
                    </View>
                    {ex.sets.map((set, idx) => (
                      <View key={set.id} style={[styles.setRow, set.completed && { opacity: 0.6 }]}>
                        <Text style={[styles.setNum, { color: colors.mutedForeground }]}>{idx + 1}</Text>
                        <TextInput
                          style={[styles.setInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                          value={set.weight > 0 ? set.weight.toString() : ""}
                          onChangeText={(v) => updateSet(session.id, ex.id, set.id, { weight: parseFloat(v) || 0 })}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={colors.mutedForeground}
                          editable={!set.completed}
                        />
                        <TextInput
                          style={[styles.setInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                          value={set.reps > 0 ? set.reps.toString() : ""}
                          onChangeText={(v) => updateSet(session.id, ex.id, set.id, { reps: parseInt(v) || 0 })}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={colors.mutedForeground}
                          editable={!set.completed}
                        />
                        <Pressable
                          style={[styles.doneBtn, { backgroundColor: set.completed ? colors.success : colors.border }]}
                          onPress={() => updateSet(session.id, ex.id, set.id, { completed: !set.completed })}
                        >
                          <Feather name="check" size={16} color={set.completed ? "#fff" : colors.mutedForeground} />
                        </Pressable>
                      </View>
                    ))}
                    <Pressable style={[styles.addSetBtn, { borderColor: colors.border }]} onPress={() => {
                      const lastSet = ex.sets[ex.sets.length - 1];
                      const newSet: ExerciseSet = { id: generateId(), weight: lastSet?.weight || 0, reps: lastSet?.reps || 10, completed: false };
                      addExerciseToSession(session.id, {
                        exerciseId: ex.exerciseId,
                        name: ex.name,
                        sets: [...ex.sets, newSet],
                      });
                    }}>
                      <Feather name="plus" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.addSetText, { color: colors.mutedForeground }]}>Add Set</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </Pressable>
          ))
        )}

        <View style={styles.bottomButtons}>
          <Pressable style={[styles.addExerciseBtn, { borderColor: colors.border }]} onPress={() => setShowExercisePicker(!showExercisePicker)}>
            <Feather name="plus" size={18} color={colors.text} />
            <Text style={[styles.addExerciseBtnText, { color: colors.text }]}>Add Exercise</Text>
          </Pressable>
          <Pressable style={[styles.finishBtn, { backgroundColor: colors.success }]} onPress={handleFinish}>
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.finishBtnText}>Finish</Text>
          </Pressable>
        </View>

        {showExercisePicker && (
          <View style={[styles.exercisePicker, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.exercisePickerTitle, { color: colors.text }]}>Add Exercise</Text>
            {EXERCISES.slice(0, 20).map((ex) => (
              <Pressable key={ex.id} style={[styles.exercisePickerItem, { borderBottomColor: colors.border }]} onPress={() => addExercise(ex.id)}>
                <Text style={[styles.exercisePickerName, { color: colors.text }]}>{ex.name}</Text>
                <Text style={[styles.exercisePickerMeta, { color: colors.mutedForeground }]}>{ex.muscleGroup}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  sessionName: { fontSize: 18, fontWeight: "700" },
  timer: { fontSize: 28, fontWeight: "800", fontVariant: ["tabular-nums"] },
  headerStats: { flexDirection: "row", gap: 20 },
  headerStat: { alignItems: "center" },
  headerStatVal: { fontSize: 20, fontWeight: "700" },
  headerStatLabel: { fontSize: 11 },
  progress: { height: 3 },
  progressFill: { height: 3 },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  emptyExercises: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  exerciseCard: { borderRadius: 14, padding: 14, borderWidth: 1 },
  exHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  exName: { fontSize: 16, fontWeight: "700" },
  exHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  exSetsCount: { fontSize: 13 },
  setsContainer: { gap: 8 },
  setHeaderRow: { flexDirection: "row", gap: 8, paddingHorizontal: 4 },
  setHeaderLabel: { flex: 1, fontSize: 11, textAlign: "center", fontWeight: "600" },
  setRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  setNum: { width: 24, fontSize: 14, textAlign: "center" },
  setInput: { flex: 1, borderRadius: 8, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 10, fontSize: 16, textAlign: "center" },
  doneBtn: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addSetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderStyle: "dashed", borderRadius: 8, paddingVertical: 10 },
  addSetText: { fontSize: 14 },
  bottomButtons: { flexDirection: "row", gap: 12 },
  addExerciseBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 14 },
  addExerciseBtnText: { fontSize: 15, fontWeight: "600" },
  finishBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14 },
  finishBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  exercisePicker: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 0 },
  exercisePickerTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  exercisePickerItem: { paddingVertical: 12, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between" },
  exercisePickerName: { fontSize: 15, fontWeight: "500" },
  exercisePickerMeta: { fontSize: 13 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { fontSize: 16 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
