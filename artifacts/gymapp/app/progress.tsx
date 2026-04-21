import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState, useEffect } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "@/components/native-compat";
import Svg, {
  Rect,
  Line,
  Text as SvgText,
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { useTypography } from "@/hooks/useTypography";
import { useApp, type BodyMeasurement } from "@/contexts/AppContext";
import { useNutrition } from "@/contexts/NutritionContext";
import { useWorkout } from "@/contexts/WorkoutContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 120;

interface BarChartProps {
  data: { label: string; value: number }[];
  maxValue: number;
  color: string;
  height?: number;
  width?: number;
}

function BarChart({
  data,
  maxValue,
  color,
  height = CHART_HEIGHT,
  width = CHART_WIDTH,
}: BarChartProps) {
  const barWidth = (width - data.length * 4) / data.length;
  const maxIdx = data.reduce((best, d, i, arr) => (d.value > arr[best].value ? i : best), 0);
  return (
    <Svg width={width} height={height + 32}>
      {data.map((d, i) => {
        const barHeight = maxValue > 0 ? (d.value / maxValue) * height : 0;
        const x = i * (barWidth + 4);
        const y = height - barHeight;
        const isTallest = i === maxIdx && d.value > 0;
        return (
          <React.Fragment key={i}>
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill={d.value > 0 ? color : "#2A2D42"}
            />
            {isTallest && (
              <SvgText
                x={x + barWidth / 2}
                y={y - 4}
                fontSize={9}
                fill={color}
                textAnchor="middle"
                fontWeight="700"
              >
                {d.value.toLocaleString()}
              </SvgText>
            )}
            <SvgText
              x={x + barWidth / 2}
              y={height + 16}
              fontSize={9}
              fill="#9096B3"
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

interface LineChartProps {
  data: { label: string; value: number }[];
  color: string;
  height?: number;
  width?: number;
  showDots?: boolean;
}

function LineChart({
  data,
  color,
  height = CHART_HEIGHT,
  width = CHART_WIDTH,
  showDots = true,
}: LineChartProps) {
  if (data.length === 0) {
    return (
      <View style={{ width, height: height + 20, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#9096B3", fontSize: 12 }}>Not enough data yet</Text>
      </View>
    );
  }
  if (data.length === 1) {
    const cx = width / 2;
    const cy = height / 2;
    return (
      <Svg width={width} height={height + 20}>
        <Circle cx={cx} cy={cy} r={5} fill={color} />
        <SvgText x={cx} y={height + 14} fontSize={9} fill="#9096B3" textAnchor="middle">
          {data[0].label}
        </SvgText>
      </Svg>
    );
  }
  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const padV = 8;
  const padH = 8;
  const usableH = height - padV * 2;
  const usableW = width - padH * 2;
  const step = usableW / (data.length - 1);

  const points = data.map((d, i) => ({
    x: padH + i * step,
    y: padV + usableH - ((d.value - minVal) / range) * usableH,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const fillD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  const showEvery = Math.ceil(data.length / 7);

  return (
    <Svg width={width} height={height + 20}>
      <Defs>
        <LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.25" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={fillD} fill="url(#lineGrad)" />
      <Path d={pathD} stroke={color} strokeWidth={2} fill="none" />
      {showDots && points.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />)}
      {data.map((d, i) => {
        if (i % showEvery !== 0 && i !== data.length - 1) return null;
        return (
          <SvgText
            key={i}
            x={points[i].x}
            y={height + 14}
            fontSize={9}
            fill="#9096B3"
            textAnchor="middle"
          >
            {d.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

interface ConsistencyHeatmapProps {
  workoutDates: Set<string>;
  colors: ReturnType<typeof useColors>;
}

function ConsistencyHeatmap({ workoutDates, colors }: ConsistencyHeatmapProps) {
  const today = new Date();
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (27 - i));
    return d.toISOString().slice(0, 10);
  });

  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <View style={heatmapStyles.container}>
      {weeks.map((week, wi) => (
        <View key={wi} style={heatmapStyles.week}>
          {week.map((d) => {
            const hasWorkout = workoutDates.has(d);
            return (
              <View
                key={d}
                style={[
                  heatmapStyles.cell,
                  {
                    backgroundColor: hasWorkout ? "#22C55E" : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const heatmapStyles = StyleSheet.create({
  container: { gap: 4 },
  week: { flexDirection: "row", gap: 4 },
  cell: { width: 18, height: 18, borderRadius: 4, borderWidth: 1 },
});

function LogWeightModal({
  visible,
  onClose,
  onSave,
  currentWeight,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (w: number) => void;
  currentWeight: number;
}) {
  const colors = useColors();
  const [val, setVal] = useState(currentWeight.toString());

  useEffect(() => {
    if (visible) setVal(currentWeight.toString());
  }, [visible, currentWeight]);

  const handleSave = () => {
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) {
      Alert.alert("Invalid weight", "Please enter a valid weight.");
      return;
    }
    onSave(n);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalBox, { backgroundColor: colors.card }]} onPress={() => {}}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Log Weight</Text>
          <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
            Enter your current weight in kg
          </Text>
          <TextInput
            style={[
              styles.modalInput,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
            ]}
            value={val}
            onChangeText={setVal}
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
          />
          <View style={styles.modalBtns}>
            <Pressable style={[styles.modalBtn, { borderColor: colors.border }]} onPress={onClose}>
              <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.modalBtn,
                { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={handleSave}
            >
              <Text style={[styles.modalBtnText, { color: "#fff" }]}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function LogMeasurementsModal({
  visible,
  onClose,
  onSave,
  latest,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (m: {
    chest?: number;
    waist?: number;
    hips?: number;
    biceps?: number;
    thighs?: number;
  }) => void;
  latest: { chest?: number; waist?: number; hips?: number; biceps?: number; thighs?: number };
}) {
  const colors = useColors();
  const [form, setForm] = useState({
    chest: latest.chest?.toString() ?? "",
    waist: latest.waist?.toString() ?? "",
    hips: latest.hips?.toString() ?? "",
    biceps: latest.biceps?.toString() ?? "",
    thighs: latest.thighs?.toString() ?? "",
  });

  useEffect(() => {
    if (visible) {
      setForm({
        chest: latest.chest?.toString() ?? "",
        waist: latest.waist?.toString() ?? "",
        hips: latest.hips?.toString() ?? "",
        biceps: latest.biceps?.toString() ?? "",
        thighs: latest.thighs?.toString() ?? "",
      });
    }
  }, [visible, latest]);

  const handleSave = () => {
    const parse = (v: string): number | undefined => {
      if (!v.trim()) return undefined;
      const n = parseFloat(v);
      return isNaN(n) || n <= 0 ? undefined : n;
    };
    const result = {
      chest: parse(form.chest),
      waist: parse(form.waist),
      hips: parse(form.hips),
      biceps: parse(form.biceps),
      thighs: parse(form.thighs),
    };
    const hasAnyValue = Object.values(result).some((v) => v !== undefined);
    if (!hasAnyValue) {
      Alert.alert("No measurements", "Please enter at least one measurement value.");
      return;
    }
    onSave(result);
    onClose();
  };

  const fields = [
    { key: "chest" as const, label: "Chest (cm)" },
    { key: "waist" as const, label: "Waist (cm)" },
    { key: "hips" as const, label: "Hips (cm)" },
    { key: "biceps" as const, label: "Biceps (cm)" },
    { key: "thighs" as const, label: "Thighs (cm)" },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalBox, { backgroundColor: colors.card }]} onPress={() => {}}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Body Measurements</Text>
          <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
            All values in centimetres
          </Text>
          <View style={styles.measureGrid}>
            {fields.map(({ key, label }) => (
              <View key={key} style={styles.measureField}>
                <Text style={[styles.measureLabel, { color: colors.mutedForeground }]}>
                  {label}
                </Text>
                <TextInput
                  style={[
                    styles.measureInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={form[key]}
                  onChangeText={(v) => setForm({ ...form, [key]: v })}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            ))}
          </View>
          <View style={styles.modalBtns}>
            <Pressable style={[styles.modalBtn, { borderColor: colors.border }]} onPress={onClose}>
              <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.modalBtn,
                { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={handleSave}
            >
              <Text style={[styles.modalBtnText, { color: "#fff" }]}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ProgressScreen() {
  const { profile, weightLog, logWeight, bodyMeasurements, logMeasurement } = useApp();
  const { getWeeklyCalories, get30DayCalories } = useNutrition();
  const { sessions, getWeeklyVolume, get30DayVolume, personalRecords } = useWorkout();
  const colors = useColors();
  const typography = useTypography();

  const [showLogWeight, setShowLogWeight] = useState(false);
  const [showLogMeasure, setShowLogMeasure] = useState(false);
  const [calorieMode, setCalorieMode] = useState<"bar" | "line">("bar");
  const [volumeMode, setVolumeMode] = useState<"bar" | "line">("bar");

  const weeklyCalories = getWeeklyCalories();
  const weeklyVolume = getWeeklyVolume();

  const calorieData = weeklyCalories.map((d) => ({
    label: new Date(d.date + "T00:00:00")
      .toLocaleDateString("en", { weekday: "short" })
      .slice(0, 2),
    value: d.calories,
  }));

  const volumeData = weeklyVolume.map((d) => ({
    label: new Date(d.date + "T00:00:00")
      .toLocaleDateString("en", { weekday: "short" })
      .slice(0, 2),
    value: d.volume,
  }));

  const maxCals = Math.max(...calorieData.map((d) => d.value), profile.dailyCalorieTarget);
  const maxVol = Math.max(...volumeData.map((d) => d.value), 1000);

  const totalWorkouts = sessions.filter((s) => s.completed).length;
  const totalVolume = sessions.reduce((sum, s) => sum + s.totalVolume, 0);
  const avgCalories = weeklyCalories.reduce((sum, d, _, arr) => sum + d.calories / arr.length, 0);
  const prs = Object.values(personalRecords);

  const progressToGoal = Math.min(
    100,
    Math.abs(
      profile.weight - profile.targetWeight > 0
        ? ((profile.weight - profile.targetWeight) / profile.weight) * 100
        : 100,
    ),
  );

  const last30DaysWeight = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return weightLog
      .filter((e) => e.date >= cutoffStr)
      .map((e) => ({
        label: new Date(e.date + "T00:00:00").toLocaleDateString("en", {
          month: "short",
          day: "numeric",
        }),
        value: e.weight,
      }));
  }, [weightLog]);

  const latestMeasurement =
    bodyMeasurements.length > 0 ? bodyMeasurements[bodyMeasurements.length - 1] : null;
  const latestMeasurementObj: Partial<BodyMeasurement> = latestMeasurement ?? {};

  const measureFields = [
    { key: "chest" as const, label: "Chest" },
    { key: "waist" as const, label: "Waist" },
    { key: "hips" as const, label: "Hips" },
    { key: "biceps" as const, label: "Biceps" },
    { key: "thighs" as const, label: "Thighs" },
  ];

  const workoutDates = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return new Set(sessions.filter((s) => s.completed && s.date >= cutoffStr).map((s) => s.date));
  }, [sessions]);

  const consistencyCount = workoutDates.size;

  const statItems = [
    { label: "Total Workouts", value: totalWorkouts, color: colors.primary },
    {
      label: "Total Volume",
      value: `${Math.round(totalVolume / 1000)}k kg`,
      color: colors.success,
    },
    { label: "Personal Records", value: prs.length, color: colors.warning },
    { label: "Avg Daily Kcal", value: Math.round(avgCalories), color: colors.info },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.statsGrid}>
          {statItems.map((stat) => (
            <View
              key={stat.label}
              style={[
                styles.statCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderLeftColor: stat.color,
                  borderLeftWidth: 4,
                },
              ]}
            >
              <Text style={[styles.statVal, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, typography.sectionTitle, { color: colors.text }]}>
            Goal Progress
          </Text>
          <View style={[typography.sectionTitleUnderline, { marginBottom: 8 }]} />
          <View style={styles.goalRow}>
            <View style={styles.goalInfo}>
              <Text style={[styles.goalWeight, { color: colors.text }]}>{profile.weight}kg</Text>
              <Text style={[styles.goalLabel, { color: colors.mutedForeground }]}>Current</Text>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              <View style={[styles.goalBar, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.goalFill,
                    { width: `${progressToGoal}%`, backgroundColor: colors.primary },
                  ]}
                />
              </View>
              <Text style={[styles.goalPercent, { color: colors.mutedForeground }]}>
                {Math.round(progressToGoal)}% to goal
              </Text>
            </View>
            <View style={styles.goalInfo}>
              <Text style={[styles.goalWeight, { color: colors.primary }]}>
                {profile.targetWeight}kg
              </Text>
              <Text style={[styles.goalLabel, { color: colors.mutedForeground }]}>Target</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, typography.sectionTitle, { color: colors.text }]}>
              28-Day Consistency
            </Text>
            <View style={[styles.consistencyBadge, { backgroundColor: colors.success + "22" }]}>
              <Text style={[styles.consistencyCount, { color: colors.success }]}>
                {consistencyCount}/28
              </Text>
            </View>
          </View>
          <ConsistencyHeatmap workoutDates={workoutDates} colors={colors} />
          <View style={styles.heatmapLegend}>
            <View
              style={[
                styles.heatmapCell,
                { backgroundColor: "#1A2035", borderColor: colors.border },
              ]}
            />
            <Text style={[styles.heatmapLegendText, { color: colors.mutedForeground }]}>Rest</Text>
            <View
              style={[
                styles.heatmapCell,
                { backgroundColor: "#22C55E", borderColor: colors.border },
              ]}
            />
            <Text style={[styles.heatmapLegendText, { color: colors.mutedForeground }]}>
              Workout
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, typography.sectionTitle, { color: colors.text }]}>
              Weight Trend (30 days)
            </Text>
            <Pressable
              style={[styles.logBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowLogWeight(true)}
            >
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.logBtnText}>Log Weight</Text>
            </Pressable>
          </View>
          {last30DaysWeight.length > 0 ? (
            <LineChart data={last30DaysWeight} color={colors.primary} />
          ) : (
            <View style={styles.emptyChart}>
              <Feather name="trending-up" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Tap Log to record your first weight
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, typography.sectionTitle, { color: colors.text }]}>
              Body Measurements
            </Text>
            <Pressable
              style={[styles.logBtn, { backgroundColor: colors.success }]}
              onPress={() => setShowLogMeasure(true)}
            >
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.logBtnText}>Log Measurements</Text>
            </Pressable>
          </View>
          {latestMeasurement ? (
            <>
              <Text style={[styles.measureDate, { color: colors.mutedForeground }]}>
                Last logged:{" "}
                {new Date(latestMeasurement.date + "T00:00:00").toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
              <View style={styles.measureRow}>
                {measureFields.map(
                  ({ key, label }) =>
                    latestMeasurementObj[key] != null && (
                      <View
                        key={key}
                        style={[
                          styles.measureChip,
                          { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.measureChipVal, { color: colors.text }]}>
                          {latestMeasurementObj[key]}
                        </Text>
                        <Text style={[styles.measureChipLabel, { color: colors.mutedForeground }]}>
                          {label}
                        </Text>
                      </View>
                    ),
                )}
              </View>
            </>
          ) : (
            <View style={styles.emptyChart}>
              <Feather name="activity" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Log your body measurements to track progress
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, typography.sectionTitle, { color: colors.text }]}>
              {calorieMode === "bar" ? "Weekly Calories" : "30-Day Calories"}
            </Text>
            <Pressable
              style={[styles.toggleBtn, { borderColor: colors.border }]}
              onPress={() => setCalorieMode(calorieMode === "bar" ? "line" : "bar")}
            >
              <Feather
                name={calorieMode === "bar" ? "trending-up" : "bar-chart-2"}
                size={14}
                color={colors.mutedForeground}
              />
            </Pressable>
          </View>
          <View style={styles.targetLine}>
            <View style={[styles.targetDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.targetLineText, { color: colors.mutedForeground }]}>
              Target: {profile.dailyCalorieTarget} kcal/day
            </Text>
          </View>
          {calorieMode === "bar" ? (
            <BarChart data={calorieData} maxValue={maxCals} color={colors.primary} />
          ) : (
            <LineChart
              data={get30DayCalories().map((d) => ({
                label: new Date(d.date + "T00:00:00").toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                }),
                value: d.calories,
              }))}
              color={colors.primary}
            />
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, typography.sectionTitle, { color: colors.text }]}>
              {volumeMode === "bar" ? "Weekly Workout Volume" : "30-Day Volume"}
            </Text>
            <Pressable
              style={[styles.toggleBtn, { borderColor: colors.border }]}
              onPress={() => setVolumeMode(volumeMode === "bar" ? "line" : "bar")}
            >
              <Feather
                name={volumeMode === "bar" ? "trending-up" : "bar-chart-2"}
                size={14}
                color={colors.mutedForeground}
              />
            </Pressable>
          </View>
          {volumeMode === "bar" ? (
            <BarChart data={volumeData} maxValue={maxVol} color={colors.success} />
          ) : (
            <LineChart
              data={get30DayVolume().map((d) => ({
                label: new Date(d.date + "T00:00:00").toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                }),
                value: d.volume,
              }))}
              color={colors.success}
            />
          )}
        </View>

        {prs.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, typography.sectionTitle, { color: colors.text }]}>
              Personal Records
            </Text>
            <View style={[typography.sectionTitleUnderline, { marginBottom: 8 }]} />
            {prs.map((pr) => (
              <View
                key={pr.exerciseId}
                style={[styles.prRow, { borderBottomColor: colors.border }]}
              >
                <Feather name="award" size={16} color={colors.warning} />
                <Text style={[styles.prName, { color: colors.text }]}>{pr.name}</Text>
                <Text style={[styles.prVal, { color: colors.primary }]}>
                  {pr.weight}kg × {pr.reps}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <LogWeightModal
        visible={showLogWeight}
        onClose={() => setShowLogWeight(false)}
        onSave={logWeight}
        currentWeight={
          weightLog.length > 0 ? weightLog[weightLog.length - 1].weight : profile.weight
        }
      />
      <LogMeasurementsModal
        visible={showLogMeasure}
        onClose={() => setShowLogMeasure(false)}
        onSave={logMeasurement}
        latest={latestMeasurementObj}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 14 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47%", borderRadius: 14, padding: 14, borderWidth: 1 },
  statVal: { fontSize: 26, fontWeight: "700" },
  statLabel: { fontSize: 12, marginTop: 4 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalRow: { flexDirection: "row", alignItems: "center" },
  goalInfo: { alignItems: "center", minWidth: 60 },
  goalWeight: { fontSize: 20, fontWeight: "700" },
  goalLabel: { fontSize: 11, marginTop: 2 },
  goalBar: { height: 10, borderRadius: 5, overflow: "hidden" },
  goalFill: { height: "100%", borderRadius: 5 },
  goalPercent: { fontSize: 11, marginTop: 4, textAlign: "center" },
  consistencyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  consistencyCount: { fontSize: 12, fontWeight: "700" },
  heatmapLegend: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  heatmapCell: { width: 14, height: 14, borderRadius: 3, borderWidth: 1 },
  heatmapLegendText: { fontSize: 11, marginRight: 8 },
  targetLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  targetDot: { width: 8, height: 8, borderRadius: 4 },
  targetLineText: { fontSize: 12 },
  prRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  prName: { flex: 1, fontSize: 14 },
  prVal: { fontSize: 14, fontWeight: "600" },
  logBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  logBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  toggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyChart: { alignItems: "center", gap: 8, paddingVertical: 16 },
  emptyText: { fontSize: 13, textAlign: "center" },
  measureDate: { fontSize: 12 },
  measureRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  measureChip: {
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  measureChipVal: { fontSize: 18, fontWeight: "700" },
  measureChipLabel: { fontSize: 10, marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBox: { width: "85%", borderRadius: 20, padding: 24, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalSub: { fontSize: 13 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  modalBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  modalBtnText: { fontSize: 15, fontWeight: "600" },
  measureGrid: { gap: 8 },
  measureField: { gap: 4 },
  measureLabel: { fontSize: 12, fontWeight: "500" },
  measureInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
});
