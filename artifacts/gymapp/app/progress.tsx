import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import React, { useCallback, useMemo, useState, useEffect } from "react";
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
import { getApiBase } from "@/lib/api-base";
import { getLocalDateKey } from "@/lib/date-key";
import {
  buildMonthlyReviewSnapshot,
  formatMonthLabel,
  getCurrentMonthKey,
  getMonthWindow,
  shiftMonthKey,
  type MonthlyReviewBadge,
  type MonthlyReviewResponse,
  type MonthlyReviewSnapshot,
  type MonthlyReviewSuggestedAdjustment,
  type SavedMonthlyReview,
} from "@/lib/monthly-review";

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
    return getLocalDateKey(d);
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

function getBadgeColor(tone: MonthlyReviewBadge["tone"], colors: ReturnType<typeof useColors>) {
  if (tone === "success") return colors.success;
  if (tone === "warning") return colors.warning;
  if (tone === "info") return colors.info;
  return colors.mutedForeground;
}

function getSuggestionIcon(
  category: MonthlyReviewSuggestedAdjustment["category"],
): React.ComponentProps<typeof Feather>["name"] {
  if (category === "nutrition") return "coffee";
  if (category === "recovery") return "refresh-cw";
  if (category === "trainer") return "user-check";
  if (category === "workout") return "activity";
  return "check-circle";
}

function MonthConsistencyMap({
  snapshot,
  colors,
}: {
  snapshot: MonthlyReviewSnapshot;
  colors: ReturnType<typeof useColors>;
}) {
  const workoutDates = new Set(snapshot.workoutDateKeys);

  return (
    <View style={styles.monthMap}>
      {snapshot.dateKeys.map((dateKey) => {
        const hasWorkout = workoutDates.has(dateKey);
        return (
          <View
            key={dateKey}
            style={[
              styles.monthMapCell,
              {
                backgroundColor: hasWorkout ? colors.success : colors.surface,
                borderColor: colors.border,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function formatCompactVolume(value: number): string {
  if (value <= 0) return "0kg";
  if (value >= 1000) return `${Math.round(value / 1000)}k kg`;
  return `${value}kg`;
}

function ReviewMetricTile({
  icon,
  label,
  value,
  detail,
  color,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  detail: string;
  color: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.reviewMetricTile, { backgroundColor: colors.surface }]}>
      <View style={[styles.reviewMetricIcon, { backgroundColor: color + "22" }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <Text style={[styles.reviewMetricValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.reviewMetricLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text
        style={[styles.reviewMetricDetail, { color: colors.mutedForeground }]}
        numberOfLines={1}
      >
        {detail}
      </Text>
    </View>
  );
}

function ReviewProgressRow({
  label,
  value,
  caption,
  color,
  colors,
}: {
  label: string;
  value: number;
  caption: string;
  color: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.reviewProgressRow}>
      <View style={styles.reviewProgressHeader}>
        <Text style={[styles.reviewProgressLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.reviewProgressCaption, { color: colors.mutedForeground }]}>
          {caption}
        </Text>
      </View>
      <View style={[styles.reviewProgressTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.reviewProgressFill,
            { width: `${Math.round(value * 100)}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

function MonthlyReviewCard({
  snapshot,
  review,
  isLoading,
  isSaving,
  error,
  onGenerate,
  onMarkReviewed,
  onPreviousMonth,
  onNextMonth,
  canGoNext,
  colors,
  typography,
}: {
  snapshot: MonthlyReviewSnapshot;
  review: SavedMonthlyReview | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onGenerate: () => void;
  onMarkReviewed: () => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  canGoNext: boolean;
  colors: ReturnType<typeof useColors>;
  typography: ReturnType<typeof useTypography>;
}) {
  const metrics = review?.metrics ?? snapshot.metrics;
  const badges = review?.badges?.length ? review.badges : snapshot.badges;
  const suggestions = review?.suggestedAdjustments?.length
    ? review.suggestedAdjustments
    : snapshot.suggestedAdjustments;
  const risks = Array.isArray(metrics.risks) ? metrics.risks : [];
  const headline =
    review?.aiSummary ||
    (metrics.completedWorkouts > 0
      ? `${metrics.monthLabel} captured ${metrics.completedWorkouts} completed workout${metrics.completedWorkouts === 1 ? "" : "s"} and ${metrics.workoutDays} active day${metrics.workoutDays === 1 ? "" : "s"}.`
      : `${metrics.monthLabel} is ready to become your baseline month.`);
  const coachNote =
    review?.coachNote ||
    (metrics.completedWorkouts > 0
      ? "Generate this review to save a stable coach note and advisory next-month focus."
      : "Starting point review: log one workout and one nutrition day to make next month's coaching sharper.");
  const statusColor =
    review?.status === "reviewed"
      ? colors.success
      : review
        ? colors.primary
        : colors.mutedForeground;
  const statusLabel =
    review?.status === "reviewed"
      ? "Reviewed"
      : review
        ? snapshot.isCompleteMonth
          ? "Saved"
          : "Month so far"
        : snapshot.isCompleteMonth
          ? "Not saved"
          : "Preview";

  return (
    <View
      style={[
        styles.card,
        styles.monthlyReviewCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.monthlyTopBar}>
        <View style={styles.monthlyEyebrowRow}>
          <Feather name="calendar" size={14} color={colors.primary} />
          <Text style={[styles.monthlyEyebrow, { color: colors.primary }]}>
            {snapshot.isCurrentMonth
              ? `${formatMonthLabel(snapshot.month)} so far`
              : formatMonthLabel(snapshot.month)}
          </Text>
        </View>
        <View style={styles.monthPicker}>
          <Pressable
            style={[styles.monthNavBtn, { borderColor: colors.border }]}
            onPress={onPreviousMonth}
          >
            <Feather name="chevron-left" size={16} color={colors.text} />
          </Pressable>
          <Pressable
            style={[
              styles.monthNavBtn,
              { borderColor: colors.border, opacity: canGoNext ? 1 : 0.35 },
            ]}
            onPress={onNextMonth}
            disabled={!canGoNext}
          >
            <Feather name="chevron-right" size={16} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.monthlyReviewHeader}>
        <View style={[styles.monthlyScoreBadge, { borderColor: statusColor }]}>
          <Feather name={review ? "file-text" : "edit-3"} size={18} color={statusColor} />
          <Text style={[styles.monthlyScoreLabel, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <View style={styles.monthlyHeaderCopy}>
          <View style={styles.monthlyTitleRow}>
            <Text style={[styles.cardTitle, typography.sectionTitle, { color: colors.text }]}>
              Month in Review
            </Text>
            <View style={[styles.monthlyStatusPill, { backgroundColor: statusColor + "20" }]}>
              <Text style={[styles.monthlyStatusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
          <Text style={[styles.monthlyHeadline, { color: colors.text }]}>{headline}</Text>
        </View>
      </View>

      <Text style={[styles.monthlyCoachNote, { color: colors.mutedForeground }]}>{coachNote}</Text>

      <View style={styles.reviewMetricGrid}>
        <ReviewMetricTile
          icon="activity"
          label="Workouts"
          value={`${metrics.completedWorkouts}`}
          detail={`${metrics.workoutDays}/${metrics.elapsedDays} active days`}
          color={colors.primary}
          colors={colors}
        />
        <ReviewMetricTile
          icon="bar-chart-2"
          label="Volume"
          value={formatCompactVolume(metrics.totalVolume)}
          detail={`${metrics.totalDurationMinutes} min logged`}
          color={colors.success}
          colors={colors}
        />
        <ReviewMetricTile
          icon="book-open"
          label="Nutrition"
          value={`${metrics.nutritionLoggedDays}`}
          detail={`${metrics.nutritionAdherenceRate}% calorie adherence`}
          color={colors.info}
          colors={colors}
        />
        <ReviewMetricTile
          icon="award"
          label="PRs"
          value={`${metrics.prCount}`}
          detail={
            metrics.bestLiftName
              ? `${metrics.bestLiftName} ${metrics.bestLiftWeight}kg`
              : "No PR yet"
          }
          color={colors.warning}
          colors={colors}
        />
      </View>

      <MonthConsistencyMap snapshot={snapshot} colors={colors} />

      <View style={styles.reviewProgressStack}>
        <ReviewProgressRow
          label="Training pace"
          value={Math.min(1, metrics.consistencyRate / 100)}
          caption={`${metrics.consistencyRate}% calendar consistency`}
          color={colors.primary}
          colors={colors}
        />
        <ReviewProgressRow
          label="Nutrition logging"
          value={Math.min(1, metrics.nutritionLoggedDays / Math.max(metrics.elapsedDays, 1))}
          caption={`${metrics.nutritionLoggedDays} logged day${metrics.nutritionLoggedDays === 1 ? "" : "s"}`}
          color={colors.info}
          colors={colors}
        />
        <ReviewProgressRow
          label="Protein quality"
          value={Math.min(1, metrics.proteinAdherenceRate / 100)}
          caption={`${metrics.proteinAdherenceRate}% protein adherence`}
          color={colors.success}
          colors={colors}
        />
      </View>

      <View style={styles.badgeRail}>
        {badges.map((badge) => {
          const badgeColor = getBadgeColor(badge.tone, colors);
          return (
            <View
              key={badge.id}
              style={[
                styles.reviewBadge,
                { backgroundColor: badgeColor + "18", borderColor: badgeColor + "55" },
              ]}
            >
              <Text style={[styles.reviewBadgeLabel, { color: badgeColor }]}>{badge.label}</Text>
              <Text style={[styles.reviewBadgeDetail, { color: colors.mutedForeground }]}>
                {badge.detail}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.nextActionBox, { backgroundColor: colors.surface }]}>
        <View style={[styles.nextActionIcon, { backgroundColor: colors.primary + "22" }]}>
          <Feather name="target" size={16} color={colors.primary} />
        </View>
        <View style={styles.nextActionTextBlock}>
          <Text style={[styles.nextActionLabel, { color: colors.text }]}>Next-month focus</Text>
          {suggestions.slice(0, 3).map((suggestion) => (
            <View key={suggestion.id} style={styles.reviewSuggestionRow}>
              <Feather
                name={getSuggestionIcon(suggestion.category)}
                size={14}
                color={colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.reviewSuggestionTitle, { color: colors.text }]}>
                  {suggestion.title}
                </Text>
                <Text style={[styles.reviewSuggestionDetail, { color: colors.mutedForeground }]}>
                  {suggestion.detail}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {risks.length > 0 && (
        <View style={[styles.riskBox, { backgroundColor: colors.warning + "14" }]}>
          <Feather name="alert-triangle" size={15} color={colors.warning} />
          <Text style={[styles.riskText, { color: colors.warning }]}>
            Coaching risk: {risks.join(", ")}
          </Text>
        </View>
      )}

      {error && (
        <Text style={[styles.reviewErrorText, { color: colors.destructive }]}>{error}</Text>
      )}

      <View style={styles.monthlyActions}>
        <Pressable
          style={[
            styles.monthlyPrimaryBtn,
            { backgroundColor: colors.primary, opacity: isSaving || isLoading ? 0.7 : 1 },
          ]}
          onPress={onGenerate}
          disabled={isSaving || isLoading}
        >
          <Feather name={review ? "refresh-cw" : "save"} size={15} color="#fff" />
          <Text style={styles.monthlyPrimaryBtnText}>
            {isSaving ? "Saving..." : review ? "Refresh review" : "Generate review"}
          </Text>
        </Pressable>
        {review && review.status !== "reviewed" && (
          <Pressable
            style={[styles.monthlySecondaryBtn, { borderColor: colors.border }]}
            onPress={onMarkReviewed}
            disabled={isSaving}
          >
            <Feather name="check" size={15} color={colors.text} />
            <Text style={[styles.monthlySecondaryBtnText, { color: colors.text }]}>
              Mark reviewed
            </Text>
          </Pressable>
        )}
      </View>

      {isLoading && (
        <Text style={[styles.reviewLoadingText, { color: colors.mutedForeground }]}>
          Loading saved review...
        </Text>
      )}
    </View>
  );
}

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
  const { getWeeklyCalories, get30DayCalories, getLogsForRange } = useNutrition();
  const { sessions, getWeeklyVolume, get30DayVolume, personalRecords, savedPlans } = useWorkout();
  const { getToken } = useAuth();
  const colors = useColors();
  const typography = useTypography();

  const [showLogWeight, setShowLogWeight] = useState(false);
  const [showLogMeasure, setShowLogMeasure] = useState(false);
  const [calorieMode, setCalorieMode] = useState<"bar" | "line">("bar");
  const [volumeMode, setVolumeMode] = useState<"bar" | "line">("bar");
  const [reviewMonth, setReviewMonth] = useState(() => getCurrentMonthKey());
  const [savedMonthlyReview, setSavedMonthlyReview] = useState<SavedMonthlyReview | null>(null);
  const [loadingMonthlyReview, setLoadingMonthlyReview] = useState(false);
  const [savingMonthlyReview, setSavingMonthlyReview] = useState(false);
  const [monthlyReviewError, setMonthlyReviewError] = useState<string | null>(null);

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
  const prs = useMemo(() => Object.values(personalRecords), [personalRecords]);
  const reviewWindow = useMemo(() => getMonthWindow(reviewMonth), [reviewMonth]);
  const monthlyNutritionLogs = useMemo(
    () => getLogsForRange(reviewWindow.startDate, reviewWindow.endDate),
    [getLogsForRange, reviewWindow.endDate, reviewWindow.startDate],
  );
  const monthlyReviewSnapshot = useMemo(
    () =>
      buildMonthlyReviewSnapshot({
        month: reviewMonth,
        profile,
        nutritionLogs: monthlyNutritionLogs,
        sessions,
        personalRecords: prs,
        savedPlans,
        weightLog,
        bodyMeasurements,
      }),
    [
      bodyMeasurements,
      monthlyNutritionLogs,
      personalRecords,
      profile,
      prs,
      reviewMonth,
      savedPlans,
      sessions,
      weightLog,
    ],
  );

  const canGoNextReviewMonth = reviewMonth < getCurrentMonthKey();

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
    const cutoffStr = getLocalDateKey(cutoff);
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
    const cutoffStr = getLocalDateKey(cutoff);
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

  useEffect(() => {
    let cancelled = false;

    const fetchSavedReview = async () => {
      const apiBase = getApiBase();
      if (!apiBase) {
        setSavedMonthlyReview(null);
        return;
      }

      setLoadingMonthlyReview(true);
      setMonthlyReviewError(null);
      try {
        const token = await getToken();
        if (!token) {
          setSavedMonthlyReview(null);
          return;
        }

        const response = await fetch(
          `${apiBase}/api/monthly-reviews?month=${encodeURIComponent(reviewMonth)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!response.ok) {
          throw new Error("Failed to load monthly review");
        }

        const payload = (await response.json()) as MonthlyReviewResponse;
        if (!cancelled) {
          setSavedMonthlyReview(payload.review);
        }
      } catch (error) {
        console.error("Failed to fetch monthly review", error);
        if (!cancelled) {
          setSavedMonthlyReview(null);
          setMonthlyReviewError("Saved review is unavailable right now.");
        }
      } finally {
        if (!cancelled) {
          setLoadingMonthlyReview(false);
        }
      }
    };

    void fetchSavedReview();

    return () => {
      cancelled = true;
    };
  }, [getToken, reviewMonth]);

  const handleGenerateMonthlyReview = useCallback(async () => {
    const apiBase = getApiBase();
    if (!apiBase) {
      setMonthlyReviewError("API base URL is not configured.");
      return;
    }

    setSavingMonthlyReview(true);
    setMonthlyReviewError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      const response = await fetch(`${apiBase}/api/monthly-reviews/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          month: reviewMonth,
          metrics: monthlyReviewSnapshot.metrics,
          badges: monthlyReviewSnapshot.badges,
          suggestedAdjustments: monthlyReviewSnapshot.suggestedAdjustments,
        }),
      });

      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<MonthlyReviewResponse> & {
        error?: string;
      };
      if (!response.ok || !payload.review) {
        throw new Error(payload.error || "Failed to generate monthly review");
      }

      setSavedMonthlyReview(payload.review);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate monthly review";
      setMonthlyReviewError(message);
    } finally {
      setSavingMonthlyReview(false);
    }
  }, [
    getToken,
    monthlyReviewSnapshot.badges,
    monthlyReviewSnapshot.metrics,
    monthlyReviewSnapshot.suggestedAdjustments,
    reviewMonth,
  ]);

  const handleMarkMonthlyReviewReviewed = useCallback(async () => {
    if (!savedMonthlyReview) return;

    const apiBase = getApiBase();
    if (!apiBase) {
      setMonthlyReviewError("API base URL is not configured.");
      return;
    }

    setSavingMonthlyReview(true);
    setMonthlyReviewError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      const response = await fetch(
        `${apiBase}/api/monthly-reviews/${encodeURIComponent(savedMonthlyReview.id)}/review`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reviewed: true }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<MonthlyReviewResponse> & {
        error?: string;
      };
      if (!response.ok || !payload.review) {
        throw new Error(payload.error || "Failed to mark monthly review reviewed");
      }

      setSavedMonthlyReview(payload.review);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to mark monthly review reviewed";
      setMonthlyReviewError(message);
    } finally {
      setSavingMonthlyReview(false);
    }
  }, [getToken, savedMonthlyReview]);

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

        <MonthlyReviewCard
          snapshot={monthlyReviewSnapshot}
          review={savedMonthlyReview}
          isLoading={loadingMonthlyReview}
          isSaving={savingMonthlyReview}
          error={monthlyReviewError}
          onGenerate={handleGenerateMonthlyReview}
          onMarkReviewed={handleMarkMonthlyReviewReviewed}
          onPreviousMonth={() => setReviewMonth((month) => shiftMonthKey(month, -1))}
          onNextMonth={() => setReviewMonth((month) => shiftMonthKey(month, 1))}
          canGoNext={canGoNextReviewMonth}
          colors={colors}
          typography={typography}
        />

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
  monthlyReviewCard: { gap: 14 },
  monthlyTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  monthPicker: { flexDirection: "row", gap: 6 },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthlyReviewHeader: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  monthlyScoreBadge: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  monthlyScoreValue: { fontSize: 24, fontWeight: "800", lineHeight: 28 },
  monthlyScoreLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  monthlyHeaderCopy: { flex: 1, gap: 6, minWidth: 0 },
  monthlyEyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  monthlyEyebrow: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  monthlyTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  monthlyStatusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  monthlyStatusText: { fontSize: 11, fontWeight: "800" },
  monthlyHeadline: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  monthlyCoachNote: { fontSize: 13, lineHeight: 19 },
  reviewMetricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reviewMetricTile: {
    width: "48%",
    flexGrow: 1,
    minWidth: 132,
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },
  reviewMetricIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewMetricValue: { fontSize: 20, lineHeight: 24, fontWeight: "800" },
  reviewMetricLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  reviewMetricDetail: { fontSize: 11 },
  reviewProgressStack: { gap: 10 },
  reviewProgressRow: { gap: 6 },
  reviewProgressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  reviewProgressLabel: { fontSize: 13, fontWeight: "700" },
  reviewProgressCaption: { flexShrink: 1, fontSize: 11, textAlign: "right" },
  reviewProgressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  reviewProgressFill: { height: "100%", borderRadius: 4 },
  monthMap: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  monthMapCell: { width: 13, height: 13, borderRadius: 4, borderWidth: 1 },
  badgeRail: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reviewBadge: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  reviewBadgeLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  reviewBadgeDetail: { maxWidth: 220, fontSize: 11, lineHeight: 16, marginTop: 2 },
  nextActionBox: { flexDirection: "row", gap: 10, borderRadius: 12, padding: 12 },
  nextActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  nextActionTextBlock: { flex: 1, gap: 2 },
  nextActionLabel: { fontSize: 13, fontWeight: "800" },
  nextActionText: { fontSize: 13, lineHeight: 18 },
  reviewSuggestionRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingTop: 8 },
  reviewSuggestionTitle: { fontSize: 13, fontWeight: "800" },
  reviewSuggestionDetail: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  riskBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    padding: 10,
  },
  riskText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  reviewErrorText: { fontSize: 12, lineHeight: 17, fontWeight: "700" },
  reviewLoadingText: { fontSize: 12, lineHeight: 17 },
  monthlyActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthlyPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  monthlyPrimaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  monthlySecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  monthlySecondaryBtnText: { fontSize: 13, fontWeight: "800" },
  reviewHighlights: { gap: 0 },
  reviewHighlightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    paddingVertical: 10,
  },
  reviewHighlightLabel: { flex: 1, fontSize: 12, fontWeight: "700" },
  reviewHighlightValueBlock: { flex: 1.4, alignItems: "flex-end", gap: 2 },
  reviewHighlightValue: { fontSize: 13, fontWeight: "800", textAlign: "right" },
  reviewHighlightDetail: { fontSize: 11, textAlign: "right" },
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
