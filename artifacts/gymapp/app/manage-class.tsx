import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
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
import { useSchedule, GymClass, ClassCategory } from "@/contexts/ScheduleContext";

const CATEGORIES: ClassCategory[] = ["Yoga", "Zumba", "CrossFit", "HIIT", "Spinning", "Boxing", "Pilates", "Strength", "Cardio", "Other"];

export default function ManageClassScreen() {
  const { classId } = useLocalSearchParams<{ classId?: string }>();
  const { classes, addClass, updateClass, deleteClass } = useSchedule();
  const router = useRouter();
  const colors = useColors();

  const existingClass = classId ? classes.find((c) => c.id === classId) : null;

  const [form, setForm] = useState({
    name: existingClass?.name || "",
    category: existingClass?.category || ("HIIT" as ClassCategory),
    description: existingClass?.description || "",
    trainer: existingClass?.trainer || "",
    date: existingClass?.date || new Date().toISOString().split("T")[0],
    startTime: existingClass?.startTime || "07:00",
    duration: existingClass?.duration?.toString() || "60",
    maxParticipants: existingClass?.maxParticipants?.toString() || "20",
    room: existingClass?.room || "",
  });

  const handleSave = async () => {
    if (!form.name || !form.trainer || !form.date || !form.startTime) {
      Alert.alert("Missing Fields", "Please fill in all required fields.");
      return;
    }

    const classData = {
      name: form.name,
      category: form.category,
      description: form.description,
      trainer: form.trainer,
      date: form.date,
      startTime: form.startTime,
      duration: parseInt(form.duration) || 60,
      maxParticipants: parseInt(form.maxParticipants) || 20,
      room: form.room,
      status: "scheduled" as const,
    };

    if (existingClass) {
      await updateClass(existingClass.id, classData);
    } else {
      await addClass(classData);
    }
    router.back();
  };

  const handleDelete = () => {
    if (!existingClass) return;
    Alert.alert("Delete Class", `Delete "${existingClass.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteClass(existingClass.id); router.back(); } },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Class Name *</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="e.g. Morning HIIT" placeholderTextColor={colors.mutedForeground} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {CATEGORIES.map((cat) => (
                  <Pressable key={cat} style={[styles.categoryChip, { backgroundColor: form.category === cat ? colors.primary : colors.surface, borderColor: form.category === cat ? colors.primary : colors.border }]} onPress={() => setForm({ ...form, category: cat })}>
                    <Text style={[styles.categoryChipText, { color: form.category === cat ? "#fff" : colors.text }]}>{cat}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Trainer Name *</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Trainer name" placeholderTextColor={colors.mutedForeground} value={form.trainer} onChangeText={(v) => setForm({ ...form, trainer: v })} />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Description</Text>
              <TextInput style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Class description..." placeholderTextColor={colors.mutedForeground} value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline numberOfLines={3} />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Date *</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} value={form.date} onChangeText={(v) => setForm({ ...form, date: v })} />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Time *</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="HH:MM" placeholderTextColor={colors.mutedForeground} value={form.startTime} onChangeText={(v) => setForm({ ...form, startTime: v })} />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Duration (min)</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="60" placeholderTextColor={colors.mutedForeground} value={form.duration} onChangeText={(v) => setForm({ ...form, duration: v })} keyboardType="number-pad" />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Max Spots</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="20" placeholderTextColor={colors.mutedForeground} value={form.maxParticipants} onChangeText={(v) => setForm({ ...form, maxParticipants: v })} keyboardType="number-pad" />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Room / Location</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="e.g. Studio A" placeholderTextColor={colors.mutedForeground} value={form.room} onChangeText={(v) => setForm({ ...form, room: v })} />
            </View>
          </View>

          <View style={styles.actions}>
            {existingClass && (
              <Pressable style={[styles.deleteBtn, { borderColor: colors.error + "50" }]} onPress={handleDelete}>
                <Feather name="trash-2" size={18} color={colors.error} />
                <Text style={[styles.deleteBtnText, { color: colors.error }]}>Delete Class</Text>
              </Pressable>
            )}
            <Pressable style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
              <Text style={styles.saveBtnText}>{existingClass ? "Update Class" : "Create Class"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 16 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textArea: { height: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 12 },
  categoryRow: { gap: 8 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  categoryChipText: { fontSize: 13, fontWeight: "500" },
  actions: { gap: 10 },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14, borderWidth: 1 },
  deleteBtnText: { fontSize: 15, fontWeight: "600" },
  saveBtn: { borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
