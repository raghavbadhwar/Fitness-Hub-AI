import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "@/components/native-compat";
import { useColors } from "@/hooks/useColors";

export default function ManageClassScreen() {
  const router = useRouter();
  const colors = useColors();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
          <Feather name="monitor" size={28} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Class Management Moved</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Classes, edits, and enrollment oversight are now controlled from the admin dashboard so
          the mobile app always reflects the server-backed class schedule.
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Use the admin app to create or update sessions. Members can still browse the schedule and
          enroll here in the Expo app.
        </Text>

        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Back to Schedule</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
