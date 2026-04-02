import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Rect, Line, Text as SvgText, Path } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
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

function BarChart({ data, maxValue, color, height = CHART_HEIGHT, width = CHART_WIDTH }: BarChartProps) {
  const barWidth = (width - data.length * 4) / data.length;
  return (
    <Svg width={width} height={height + 20}>
      {data.map((d, i) => {
        const barHeight = maxValue > 0 ? (d.value / maxValue) * height : 0;
        const x = i * (barWidth + 4);
        const y = height - barHeight;
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={y} width={barWidth} height={barHeight} rx={4} fill={d.value > 0 ? color : "#2A2D42"} />
            <SvgText x={x + barWidth / 2} y={height + 14} fontSize={9} fill="#9096B3" textAnchor="middle">{d.label}</SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export default function ProgressScreen() {
  const { profile } = useApp();
  const { getWeeklyCalories } = useNutrition();
  const { sessions, getWeeklyVolume, personalRecords } = useWorkout();
  const colors = useColors();

  const weeklyCalories = getWeeklyCalories();
  const weeklyVolume = getWeeklyVolume();

  const calorieData = weeklyCalories.map((d) => ({
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en", { weekday: "short" }).slice(0, 2),
    value: d.calories,
  }));

  const volumeData = weeklyVolume.map((d) => ({
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en", { weekday: "short" }).slice(0, 2),
    value: d.volume,
  }));

  const maxCals = Math.max(...calorieData.map((d) => d.value), profile.dailyCalorieTarget);
  const maxVol = Math.max(...volumeData.map((d) => d.value), 1000);

  const totalWorkouts = sessions.filter((s) => s.completed).length;
  const totalVolume = sessions.reduce((sum, s) => sum + s.totalVolume, 0);
  const avgCalories = weeklyCalories.reduce((sum, d, _, arr) => sum + d.calories / arr.length, 0);
  const prs = Object.values(personalRecords);

  const progressToGoal = Math.min(100, Math.abs((profile.weight - profile.targetWeight) > 0 ? ((profile.weight - profile.targetWeight) / profile.weight) * 100 : 100));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.statsGrid}>
          {[
            { label: "Total Workouts", value: totalWorkouts, color: colors.primary },
            { label: "Total Volume", value: `${Math.round(totalVolume / 1000)}k kg`, color: colors.success },
            { label: "Personal Records", value: prs.length, color: colors.warning },
            { label: "Avg Daily Kcal", value: Math.round(avgCalories), color: colors.info },
          ].map((stat) => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statVal, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Goal Progress</Text>
          <View style={styles.goalRow}>
            <View style={styles.goalInfo}>
              <Text style={[styles.goalWeight, { color: colors.text }]}>{profile.weight}kg</Text>
              <Text style={[styles.goalLabel, { color: colors.mutedForeground }]}>Current</Text>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              <View style={[styles.goalBar, { backgroundColor: colors.border }]}>
                <View style={[styles.goalFill, { width: `${progressToGoal}%`, backgroundColor: colors.primary }]} />
              </View>
              <Text style={[styles.goalPercent, { color: colors.mutedForeground }]}>{Math.round(progressToGoal)}% to goal</Text>
            </View>
            <View style={styles.goalInfo}>
              <Text style={[styles.goalWeight, { color: colors.primary }]}>{profile.targetWeight}kg</Text>
              <Text style={[styles.goalLabel, { color: colors.mutedForeground }]}>Target</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly Calories</Text>
          <View style={styles.targetLine}>
            <View style={[styles.targetDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.targetLineText, { color: colors.mutedForeground }]}>Target: {profile.dailyCalorieTarget} kcal/day</Text>
          </View>
          <BarChart data={calorieData} maxValue={maxCals} color={colors.primary} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly Workout Volume</Text>
          <BarChart data={volumeData} maxValue={maxVol} color={colors.success} />
        </View>

        {prs.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Personal Records</Text>
            {prs.map((pr) => (
              <View key={pr.exerciseId} style={[styles.prRow, { borderBottomColor: colors.border }]}>
                <Feather name="award" size={16} color={colors.warning} />
                <Text style={[styles.prName, { color: colors.text }]}>{pr.name}</Text>
                <Text style={[styles.prVal, { color: colors.primary }]}>{pr.weight}kg × {pr.reps}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
  goalRow: { flexDirection: "row", alignItems: "center" },
  goalInfo: { alignItems: "center", minWidth: 60 },
  goalWeight: { fontSize: 20, fontWeight: "700" },
  goalLabel: { fontSize: 11, marginTop: 2 },
  goalBar: { height: 10, borderRadius: 5, overflow: "hidden" },
  goalFill: { height: "100%", borderRadius: 5 },
  goalPercent: { fontSize: 11, marginTop: 4, textAlign: "center" },
  targetLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  targetDot: { width: 8, height: 8, borderRadius: 4 },
  targetLineText: { fontSize: 12 },
  prRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  prName: { flex: 1, fontSize: 14 },
  prVal: { fontSize: 14, fontWeight: "600" },
});
