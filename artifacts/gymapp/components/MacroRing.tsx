import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

interface MacroRingProps {
  calories: number;
  target: number;
  protein: number;
  carbs: number;
  fat: number;
  size?: number;
}

export function MacroRing({ calories, target, protein, carbs, fat, size = 160 }: MacroRingProps) {
  const colors = useColors();
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(calories / Math.max(target, 1), 1);
  const strokeDashoffset = circumference * (1 - progress);
  const cx = size / 2;
  const cy = size / 2;

  const totalMacros = protein + carbs + fat;
  const proteinAngle = totalMacros > 0 ? (protein / totalMacros) * 360 : 0;
  const carbsAngle = totalMacros > 0 ? (carbs / totalMacros) * 360 : 0;

  const remaining = Math.max(0, target - calories);
  const percentage = Math.round(progress * 100);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={colors.border}
          strokeWidth={12}
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={progress > 0.9 ? colors.error : colors.primary}
          strokeWidth={12}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.calText, { color: colors.text }]}>
          {calories.toLocaleString()}
        </Text>
        <Text style={[styles.calLabel, { color: colors.mutedForeground }]}>kcal</Text>
        <Text style={[styles.remaining, { color: calories > target ? colors.error : colors.mutedForeground }]}>
          {calories > target ? `${(calories - target).toFixed(0)} over` : `${remaining.toFixed(0)} left`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  center: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  calText: {
    fontSize: 26,
    fontWeight: "700",
  },
  calLabel: {
    fontSize: 12,
    marginTop: -2,
  },
  remaining: {
    fontSize: 11,
    marginTop: 2,
  },
});
