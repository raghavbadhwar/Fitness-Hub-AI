import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import Svg, { Circle } from "react-native-svg";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "@/components/native-compat";
import { useColors } from "@/hooks/useColors";
import { useTypography } from "@/hooks/useTypography";
import { useWorkout, type ExerciseSet } from "@/contexts/WorkoutContext";
import { EXERCISES } from "@/constants/exercises";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { generateId } from "@/lib/id";
import { buildExerciseHistorySummary } from "@/lib/workout-history";

type Colors = ReturnType<typeof useColors>;

const DEFAULT_REST_DURATION = 90;
const RING_SIZE = 140;
const STROKE = 10;
const ACCENT_COLOR = "#FF6B00";
const USE_NATIVE_DRIVER = Platform.OS !== "web";
const SET_TYPE_OPTIONS: { value: NonNullable<ExerciseSet["type"]>; label: string }[] = [
  { value: "normal", label: "N" },
  { value: "warmup", label: "W" },
  { value: "drop", label: "D" },
  { value: "failure", label: "F" },
];

const MUSCLE_GROUP_COLORS: Record<string, string> = {
  Chest: "#EF4444",
  Back: "#3B82F6",
  Legs: "#22C55E",
  Shoulders: "#F59E0B",
  Arms: "#8B5CF6",
  Biceps: "#8B5CF6",
  Triceps: "#EC4899",
  Core: "#14B8A6",
  Cardio: "#FF6B00",
  HIIT: "#FF6B00",
  CrossFit: "#EF4444",
  Strength: "#F97316",
  Pilates: "#EC4899",
  Yoga: "#22C55E",
  Boxing: "#8B5CF6",
  Spinning: "#3B82F6",
  Zumba: "#F59E0B",
  Other: "#9096B3",
};

function getMuscleColor(muscleGroup: string): string {
  return MUSCLE_GROUP_COLORS[muscleGroup] || MUSCLE_GROUP_COLORS.Other;
}

function formatHistoryDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function PulsingDot({ color }: { color: string }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.4,
          duration: 700,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: color,
        transform: [{ scale: scaleAnim }],
      }}
    />
  );
}

function ProgressRing({
  progress,
  color,
  bgColor,
}: {
  progress: number;
  color: string;
  bgColor: string;
}) {
  const clampedProgress = Math.max(0, Math.min(progress, 1));
  const radius = (RING_SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clampedProgress);
  const center = RING_SIZE / 2;

  return (
    <Svg width={RING_SIZE} height={RING_SIZE} accessible={false}>
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={bgColor}
        strokeWidth={STROKE}
        fill="none"
      />
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
        strokeDasharray={[circumference, circumference]}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
    </Svg>
  );
}

function RestTimerOverlay({
  visible,
  duration,
  onDismiss,
  onComplete,
  colors,
}: {
  visible: boolean;
  duration: number;
  onDismiss: () => void;
  onComplete: () => void;
  colors: Colors;
}) {
  const [remaining, setRemaining] = useState(duration);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible) {
      setRemaining(duration);
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  const progress = remaining / duration;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <View style={[styles.restOverlay, { backgroundColor: colors.background + "F0" }]}>
      <View style={[styles.restCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.restTitle, { color: colors.text }]}>Rest Time</Text>

        <View style={styles.ringWrapper}>
          <ProgressRing progress={progress} color={colors.primary} bgColor={colors.border} />
          <View style={styles.ringCenter}>
            <Text style={[styles.restTime, { color: colors.primary }]}>{timeStr}</Text>
            <Text style={[styles.restLabel, { color: colors.mutedForeground }]}>remaining</Text>
          </View>
        </View>

        <Pressable
          style={[
            styles.skipRestBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onDismiss();
          }}
          accessibilityRole="button"
          accessibilityLabel="Skip rest timer"
          accessibilityHint={`${timeStr} remaining`}
        >
          <Feather name="skip-forward" size={16} color={colors.mutedForeground} />
          <Text style={[styles.skipRestText, { color: colors.mutedForeground }]}>Skip Rest</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StepperInput({
  value,
  onChange,
  step,
  decimals,
  editable,
  colors,
  accessibilityLabel,
}: {
  value: number;
  onChange: (val: number) => void;
  step: number;
  decimals: number;
  editable: boolean;
  colors: Colors;
  accessibilityLabel: string;
}) {
  const handleDecrement = () => {
    const next = Math.max(0, parseFloat((value - step).toFixed(decimals)));
    onChange(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const handleIncrement = () => {
    const next = parseFloat((value + step).toFixed(decimals));
    onChange(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={styles.stepper}>
      <Pressable
        style={[
          styles.stepperBtn,
          { backgroundColor: colors.surface, borderColor: colors.border },
          !editable && styles.stepperDisabled,
        ]}
        onPress={editable ? handleDecrement : undefined}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${accessibilityLabel}`}
        accessibilityState={{ disabled: !editable }}
      >
        <Feather name="minus" size={14} color={editable ? colors.text : colors.mutedForeground} />
      </Pressable>
      <TextInput
        style={[
          styles.stepperInput,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
        ]}
        value={value > 0 ? value.toString() : ""}
        onChangeText={(v) => {
          const parsed = decimals > 0 ? parseFloat(v) : parseInt(v);
          onChange(isNaN(parsed) ? 0 : parsed);
        }}
        keyboardType={decimals > 0 ? "decimal-pad" : "number-pad"}
        placeholder="0"
        placeholderTextColor={colors.mutedForeground}
        editable={editable}
        accessibilityLabel={accessibilityLabel}
      />
      <Pressable
        style={[
          styles.stepperBtn,
          { backgroundColor: colors.surface, borderColor: colors.border },
          !editable && styles.stepperDisabled,
        ]}
        onPress={editable ? handleIncrement : undefined}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${accessibilityLabel}`}
        accessibilityState={{ disabled: !editable }}
      >
        <Feather name="plus" size={14} color={editable ? colors.text : colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

export default function WorkoutSessionScreen() {
  const { sessionId, assignedWorkoutId } = useLocalSearchParams<{
    sessionId: string;
    assignedWorkoutId?: string;
  }>();
  const { sessions, activeSession, endSession, addExerciseToSession, addSetToExercise, updateSet } =
    useWorkout();
  const router = useRouter();
  const colors = useColors();
  const typography = useTypography();

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restDuration, setRestDuration] = useState(DEFAULT_REST_DURATION);
  const [showFinishSheet, setShowFinishSheet] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const checkAnimations = useRef<Record<string, Animated.Value>>({});

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
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
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const totalSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const completedSets = session.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
    0,
  );
  const totalVolume = session.exercises.reduce(
    (total, ex) =>
      total + ex.sets.filter((s) => s.completed).reduce((sum, s) => sum + s.weight * s.reps, 0),
    0,
  );

  const getCheckAnim = (setId: string) => {
    if (!checkAnimations.current[setId]) {
      checkAnimations.current[setId] = new Animated.Value(1);
    }
    return checkAnimations.current[setId];
  };

  const animateCheck = (setId: string) => {
    const anim = getCheckAnim(setId);
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      tension: 200,
      friction: 6,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const handleToggleSet = (exerciseId: string, setId: string, currentCompleted: boolean) => {
    const newCompleted = !currentCompleted;
    updateSet(session.id, exerciseId, setId, { completed: newCompleted });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (newCompleted) {
      animateCheck(setId);
      const ex = session.exercises.find((e) => e.id === exerciseId);
      const exerciseData = ex ? EXERCISES.find((e) => e.id === ex.exerciseId) : null;
      const duration = exerciseData?.defaultRestSeconds ?? DEFAULT_REST_DURATION;
      setRestDuration(duration);
      setShowRestTimer(true);
    }
  };

  const handleFinishConfirm = async () => {
    if (finishing) return;
    setFinishing(true);
    setShowFinishSheet(false);
    if (timerRef.current) clearInterval(timerRef.current);
    const summary = await endSession(session.id);
    if (summary) {
      router.replace({
        pathname: "/workout-complete",
        params: {
          summaryJson: JSON.stringify(summary),
          ...(assignedWorkoutId ? { assignedWorkoutId } : {}),
        },
      });
    } else {
      router.back();
    }
  };

  const addExercise = (exerciseId: string) => {
    const ex = EXERCISES.find((e) => e.id === exerciseId);
    if (!ex) return;
    addExerciseToSession(session.id, {
      exerciseId: ex.id,
      name: ex.name,
      sets: Array.from({ length: ex.defaultSets }, () => ({
        id: generateId(),
        weight: 0,
        reps: parseInt(ex.defaultReps) || 10,
        completed: false,
        type: "normal",
      })),
    });
    setShowExercisePicker(false);
  };

  return (
    <View style={[styles.outerContainer, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <Text
              style={[styles.sessionName, typography.cardTitle, { color: colors.mutedForeground }]}
            >
              {session.name}
            </Text>
            <View style={styles.timerRow}>
              <Text style={[styles.timer, { color: ACCENT_COLOR }]}>{formatTime(elapsed)}</Text>
              <View style={styles.activeBadge}>
                <PulsingDot color={ACCENT_COLOR} />
                <Text style={[styles.activeBadgeText, { color: ACCENT_COLOR }]}>ACTIVE</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerStats}>
            <View style={styles.headerStat}>
              <Text style={[styles.headerStatVal, { color: colors.text }]}>
                {completedSets}/{totalSets}
              </Text>
              <Text style={[styles.headerStatLabel, { color: colors.mutedForeground }]}>Sets</Text>
            </View>
            <View
              style={[
                styles.volumeStat,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.volumeVal, { color: ACCENT_COLOR }]}>
                {Math.round(totalVolume)}
              </Text>
              <Text style={[styles.volumeLabel, { color: colors.mutedForeground }]}>Vol kg</Text>
            </View>
          </View>
        </View>

        <View style={[styles.progress, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%`,
                backgroundColor: ACCENT_COLOR,
              },
            ]}
          />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {session.exercises.length === 0 ? (
            <View style={styles.emptyExercises}>
              <Feather name="plus-circle" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Tap "Add Exercise" to begin
              </Text>
            </View>
          ) : (
            session.exercises.map((ex) => {
              const exerciseData = EXERCISES.find((e) => e.id === ex.exerciseId);
              const muscleColor = getMuscleColor(exerciseData?.muscleGroup || "Other");
              const historySummary = buildExerciseHistorySummary(sessions, ex.exerciseId);
              const lastSet = historySummary?.lastSets[0];
              return (
                <Pressable
                  key={ex.id}
                  onPress={() => setExpandedExercise(expandedExercise === ex.id ? null : ex.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${expandedExercise === ex.id ? "Collapse" : "Expand"} ${ex.name}`}
                  accessibilityHint={`${ex.sets.filter((s) => s.completed).length} of ${ex.sets.length} sets completed`}
                >
                  <View
                    style={[
                      styles.exerciseCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <View style={[styles.exerciseAccentBar, { backgroundColor: muscleColor }]} />
                    <View style={styles.exerciseCardInner}>
                      <View style={styles.exHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.exName, { color: colors.text }]}>{ex.name}</Text>
                          {exerciseData?.muscleGroup ? (
                            <Text style={[styles.exMuscle, { color: muscleColor }]}>
                              {exerciseData.muscleGroup}
                            </Text>
                          ) : null}
                          {historySummary && lastSet ? (
                            <View
                              style={[
                                styles.historyStrip,
                                { backgroundColor: colors.surface, borderColor: colors.border },
                              ]}
                            >
                              <Feather name="clock" size={12} color={colors.mutedForeground} />
                              <Text style={[styles.historyText, { color: colors.mutedForeground }]}>
                                {formatHistoryDate(historySummary.lastPerformedAt)} · Last{" "}
                                {lastSet.weight}kg x {lastSet.reps} · Best e1RM{" "}
                                {historySummary.bestEstimatedOneRepMax}kg
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.exHeaderRight}>
                          <Text style={[styles.exSetsCount, { color: colors.mutedForeground }]}>
                            {ex.sets.filter((s) => s.completed).length}/{ex.sets.length} sets
                          </Text>
                          <Feather
                            name={expandedExercise === ex.id ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={colors.mutedForeground}
                          />
                        </View>
                      </View>

                      {(expandedExercise === ex.id || expandedExercise === null) && (
                        <View style={styles.setsContainer}>
                          <View style={styles.setHeaderRow}>
                            <Text
                              style={[
                                styles.setHeaderLabel,
                                styles.setNumHeader,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              #
                            </Text>
                            <Text
                              style={[
                                styles.setHeaderLabel,
                                styles.setStepperHeader,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              Weight (kg)
                            </Text>
                            <Text
                              style={[
                                styles.setHeaderLabel,
                                styles.setStepperHeader,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              Reps
                            </Text>
                            <Text
                              style={[
                                styles.setHeaderLabel,
                                styles.setDoneHeader,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              Done
                            </Text>
                          </View>
                          {ex.sets.map((set, idx) => {
                            const checkAnim = getCheckAnim(set.id);
                            return (
                              <View
                                key={set.id}
                                style={[styles.setBlock, set.completed && { opacity: 0.72 }]}
                              >
                                <View style={styles.setRow}>
                                  <Text style={[styles.setNum, { color: colors.mutedForeground }]}>
                                    {idx + 1}
                                  </Text>
                                  <View style={styles.setStepperCell}>
                                    <StepperInput
                                      value={set.weight}
                                      onChange={(val) =>
                                        updateSet(session.id, ex.id, set.id, { weight: val })
                                      }
                                      step={2.5}
                                      decimals={1}
                                      editable={!set.completed}
                                      colors={colors}
                                      accessibilityLabel={`${ex.name} set ${idx + 1} weight in kilograms`}
                                    />
                                  </View>
                                  <View style={styles.setStepperCell}>
                                    <StepperInput
                                      value={set.reps}
                                      onChange={(val) =>
                                        updateSet(session.id, ex.id, set.id, { reps: val })
                                      }
                                      step={1}
                                      decimals={0}
                                      editable={!set.completed}
                                      colors={colors}
                                      accessibilityLabel={`${ex.name} set ${idx + 1} reps`}
                                    />
                                  </View>
                                  <Animated.View style={{ transform: [{ scale: checkAnim }] }}>
                                    <Pressable
                                      style={[
                                        styles.doneBtn,
                                        set.completed
                                          ? { backgroundColor: "#22C55E", borderWidth: 0 }
                                          : { backgroundColor: colors.border, borderWidth: 0 },
                                      ]}
                                      onPress={() => handleToggleSet(ex.id, set.id, set.completed)}
                                      accessibilityRole="button"
                                      accessibilityLabel={`${set.completed ? "Mark incomplete" : "Mark complete"} ${ex.name} set ${idx + 1}`}
                                      accessibilityState={{ checked: set.completed }}
                                    >
                                      <Feather
                                        name="check"
                                        size={18}
                                        color={set.completed ? "#fff" : colors.mutedForeground}
                                      />
                                    </Pressable>
                                  </Animated.View>
                                </View>
                                {set.progressionHint || set.previousWeight || set.previousReps ? (
                                  <Text
                                    style={[
                                      styles.previousSetHint,
                                      { color: colors.mutedForeground },
                                    ]}
                                  >
                                    {set.progressionHint ??
                                      `Previous: ${set.previousWeight ?? 0}kg x ${set.previousReps ?? 0}`}
                                  </Text>
                                ) : null}
                                <View style={styles.setMetaRow}>
                                  <View style={styles.setTypeGroup}>
                                    {SET_TYPE_OPTIONS.map((option) => {
                                      const selected = (set.type ?? "normal") === option.value;
                                      return (
                                        <Pressable
                                          key={option.value}
                                          style={[
                                            styles.setTypeChip,
                                            {
                                              borderColor: selected ? ACCENT_COLOR : colors.border,
                                              backgroundColor: selected
                                                ? ACCENT_COLOR + "18"
                                                : colors.surface,
                                            },
                                          ]}
                                          disabled={set.completed}
                                          onPress={() =>
                                            updateSet(session.id, ex.id, set.id, {
                                              type: option.value,
                                            })
                                          }
                                          accessibilityRole="button"
                                          accessibilityLabel={`${option.value} set type`}
                                          accessibilityState={{ selected, disabled: set.completed }}
                                        >
                                          <Text
                                            style={[
                                              styles.setTypeText,
                                              {
                                                color: selected
                                                  ? ACCENT_COLOR
                                                  : colors.mutedForeground,
                                              },
                                            ]}
                                          >
                                            {option.label}
                                          </Text>
                                        </Pressable>
                                      );
                                    })}
                                  </View>
                                  <Pressable
                                    style={[
                                      styles.effortChip,
                                      {
                                        borderColor: colors.border,
                                        backgroundColor: colors.surface,
                                      },
                                    ]}
                                    disabled={set.completed}
                                    onPress={() =>
                                      updateSet(session.id, ex.id, set.id, {
                                        rpe:
                                          typeof set.rpe === "number"
                                            ? set.rpe >= 10
                                              ? undefined
                                              : set.rpe + 0.5
                                            : 7,
                                      })
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel={`${ex.name} set ${idx + 1} RPE`}
                                  >
                                    <Text style={[styles.effortText, { color: colors.text }]}>
                                      RPE {set.rpe ?? "-"}
                                    </Text>
                                  </Pressable>
                                  <Pressable
                                    style={[
                                      styles.effortChip,
                                      {
                                        borderColor: colors.border,
                                        backgroundColor: colors.surface,
                                      },
                                    ]}
                                    disabled={set.completed}
                                    onPress={() =>
                                      updateSet(session.id, ex.id, set.id, {
                                        rir:
                                          typeof set.rir === "number"
                                            ? set.rir >= 5
                                              ? undefined
                                              : set.rir + 1
                                            : 2,
                                      })
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel={`${ex.name} set ${idx + 1} reps in reserve`}
                                  >
                                    <Text style={[styles.effortText, { color: colors.text }]}>
                                      RIR {set.rir ?? "-"}
                                    </Text>
                                  </Pressable>
                                </View>
                                <TextInput
                                  style={[
                                    styles.setNoteInput,
                                    {
                                      color: colors.text,
                                      backgroundColor: colors.surface,
                                      borderColor: colors.border,
                                    },
                                  ]}
                                  value={set.notes ?? ""}
                                  onChangeText={(notes) =>
                                    updateSet(session.id, ex.id, set.id, {
                                      notes: notes.trim() ? notes : undefined,
                                    })
                                  }
                                  editable={!set.completed}
                                  placeholder="Set note"
                                  placeholderTextColor={colors.mutedForeground}
                                  accessibilityLabel={`${ex.name} set ${idx + 1} note`}
                                />
                              </View>
                            );
                          })}
                          <Pressable
                            style={[styles.addSetBtn, { borderColor: colors.border }]}
                            onPress={() => {
                              const lastSet = ex.sets[ex.sets.length - 1];
                              addSetToExercise(session.id, ex.id, {
                                weight: lastSet?.weight || 0,
                                reps: lastSet?.reps || 10,
                                completed: false,
                                type: lastSet?.type ?? "normal",
                                previousWeight: lastSet?.weight,
                                previousReps: lastSet?.reps,
                              });
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Add set to ${ex.name}`}
                          >
                            <Feather name="plus" size={14} color={colors.mutedForeground} />
                            <Text style={[styles.addSetText, { color: colors.mutedForeground }]}>
                              Add Set
                            </Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}

          <View style={styles.bottomButtons}>
            <Pressable
              style={[styles.addExerciseBtn, { borderColor: colors.border }]}
              onPress={() => setShowExercisePicker(!showExercisePicker)}
              accessibilityRole="button"
              accessibilityLabel={showExercisePicker ? "Hide exercise picker" : "Add exercise"}
            >
              <Feather name="plus" size={18} color={colors.text} />
              <Text style={[styles.addExerciseBtnText, { color: colors.text }]}>Add Exercise</Text>
            </Pressable>
            <Pressable
              style={[styles.finishBtn, { backgroundColor: colors.success }]}
              onPress={() => setShowFinishSheet(true)}
              accessibilityRole="button"
              accessibilityLabel="Finish workout session"
              accessibilityHint={`${completedSets} of ${totalSets} sets completed`}
            >
              <Feather name="check-circle" size={18} color="#fff" />
              <Text style={styles.finishBtnText}>Finish</Text>
            </Pressable>
          </View>

          {showExercisePicker && (
            <View
              style={[
                styles.exercisePicker,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.exercisePickerTitle, { color: colors.text }]}>Add Exercise</Text>
              {EXERCISES.slice(0, 20).map((ex) => {
                const muscleColor = getMuscleColor(ex.muscleGroup);
                return (
                  <Pressable
                    key={ex.id}
                    style={[styles.exercisePickerItem, { borderBottomColor: colors.border }]}
                    onPress={() => addExercise(ex.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${ex.name}`}
                    accessibilityHint={`${ex.muscleGroup}, default ${ex.defaultSets} sets`}
                  >
                    <View style={[styles.exercisePickerAccent, { backgroundColor: muscleColor }]} />
                    <Text style={[styles.exercisePickerName, { color: colors.text }]}>
                      {ex.name}
                    </Text>
                    <Text style={[styles.exercisePickerMeta, { color: muscleColor }]}>
                      {ex.muscleGroup}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <RestTimerOverlay
        visible={showRestTimer}
        duration={restDuration}
        onDismiss={() => setShowRestTimer(false)}
        onComplete={() => setShowRestTimer(false)}
        colors={colors}
      />

      <ConfirmSheet
        visible={showFinishSheet}
        title="Finish Workout?"
        message={`${formatTime(elapsed)} elapsed · ${completedSets}/${totalSets} sets · ${Math.round(totalVolume)}kg volume`}
        confirmText="Finish"
        cancelText="Keep Going"
        onConfirm={handleFinishConfirm}
        onCancel={() => setShowFinishSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  headerLeft: { flex: 1 },
  sessionName: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  timer: { fontSize: 38, fontWeight: "800", fontVariant: ["tabular-nums"] },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "#FF6B0018",
  },
  activeBadgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  headerStats: { flexDirection: "row", gap: 12, alignItems: "center" },
  headerStat: { alignItems: "center" },
  headerStatVal: { fontSize: 20, fontWeight: "700" },
  headerStatLabel: { fontSize: 11 },
  volumeStat: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  volumeVal: { fontSize: 20, fontWeight: "800" },
  volumeLabel: { fontSize: 10, fontWeight: "600" },
  progress: { height: 3 },
  progressFill: { height: 3 },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  emptyExercises: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  exerciseCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", flexDirection: "row" },
  exerciseAccentBar: { width: 5 },
  exerciseCardInner: { flex: 1, padding: 14 },
  exHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  exName: { fontSize: 16, fontWeight: "700" },
  exMuscle: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  exHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  exSetsCount: { fontSize: 13 },
  historyStrip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 8,
    maxWidth: "100%",
  },
  historyText: { fontSize: 11, fontWeight: "600", flexShrink: 1 },
  setsContainer: { gap: 8 },
  setHeaderRow: { flexDirection: "row", gap: 6, paddingHorizontal: 2, alignItems: "center" },
  setHeaderLabel: { fontSize: 10, textAlign: "center", fontWeight: "600" },
  setNumHeader: { width: 20 },
  setStepperHeader: { flex: 1 },
  setDoneHeader: { width: 40 },
  setBlock: { gap: 6 },
  setRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  setNum: { width: 20, fontSize: 13, textAlign: "center" },
  setStepperCell: { flex: 1 },
  previousSetHint: { fontSize: 11, paddingLeft: 26 },
  setMetaRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
    paddingLeft: 26,
  },
  setTypeGroup: { flexDirection: "row", gap: 4 },
  setTypeChip: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  setTypeText: { fontSize: 11, fontWeight: "800" },
  effortChip: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6 },
  effortText: { fontSize: 11, fontWeight: "700" },
  setNoteInput: {
    marginLeft: 26,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: 2 },
  stepperBtn: {
    width: 28,
    height: 34,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  stepperDisabled: { opacity: 0.4 },
  stepperInput: {
    flex: 1,
    borderRadius: 7,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 14,
    textAlign: "center",
    minWidth: 0,
  },
  doneBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  addSetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 10,
  },
  addSetText: { fontSize: 14 },
  bottomButtons: { flexDirection: "row", gap: 12 },
  addExerciseBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
  },
  addExerciseBtnText: { fontSize: 15, fontWeight: "600" },
  finishBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
  },
  finishBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  exercisePicker: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 0 },
  exercisePickerTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  exercisePickerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  exercisePickerAccent: { width: 4, height: 32, borderRadius: 2 },
  exercisePickerName: { flex: 1, fontSize: 15, fontWeight: "500" },
  exercisePickerMeta: { fontSize: 13, fontWeight: "600" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { fontSize: 16 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  restOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  restCard: {
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    alignItems: "center",
    gap: 24,
    width: 300,
  },
  restTitle: { fontSize: 22, fontWeight: "800" },
  ringWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: {
    position: "absolute",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  restTime: { fontSize: 36, fontWeight: "800", fontVariant: ["tabular-nums"] },
  restLabel: { fontSize: 13, marginTop: 2 },
  skipRestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  skipRestText: { fontSize: 14, fontWeight: "600" },
});
