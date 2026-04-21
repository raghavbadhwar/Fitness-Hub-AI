import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useColors } from "@/hooks/useColors";

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  color?: string;
  progress?: number;
}

export function StatCard({
  title,
  value,
  unit,
  subtitle,
  icon,
  onPress,
  color,
  progress,
}: StatCardProps) {
  const colors = useColors();

  const content = (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.mutedForeground }]}>{title}</Text>
        {icon && (
          <View
            style={[styles.iconContainer, { backgroundColor: (color || colors.primary) + "20" }]}
          >
            {icon}
          </View>
        )}
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
        {unit && <Text style={[styles.unit, { color: colors.mutedForeground }]}> {unit}</Text>}
      </View>
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      )}
      {progress !== undefined && (
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(progress * 100, 100)}%`,
                backgroundColor: color || colors.primary,
              },
            ]}
          />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  value: {
    fontSize: 28,
    fontWeight: "700",
  },
  unit: {
    fontSize: 14,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
});
