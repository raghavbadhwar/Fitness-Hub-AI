import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

interface MacroBarProps {
  protein: number;
  carbs: number;
  fat: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
}

export function MacroBar({ protein, carbs, fat, proteinTarget, carbTarget, fatTarget }: MacroBarProps) {
  const colors = useColors();

  const macros = [
    { label: "Protein", value: protein, target: proteinTarget, color: colors.protein, unit: "g" },
    { label: "Carbs", value: carbs, target: carbTarget, color: colors.carbs, unit: "g" },
    { label: "Fat", value: fat, target: fatTarget, color: colors.fat, unit: "g" },
  ];

  return (
    <View style={styles.container}>
      {macros.map((macro) => {
        const progress = Math.min(macro.value / Math.max(macro.target, 1), 1);
        return (
          <View key={macro.label} style={styles.macroItem}>
            <View style={styles.macroHeader}>
              <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>{macro.label}</Text>
              <Text style={[styles.macroValue, { color: colors.text }]}>
                {Math.round(macro.value)}
                <Text style={[styles.macroTarget, { color: colors.mutedForeground }]}>
                  /{macro.target}g
                </Text>
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress * 100}%`, backgroundColor: macro.color },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  macroItem: {},
  macroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  macroLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  macroValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  macroTarget: {
    fontWeight: "400",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
});
