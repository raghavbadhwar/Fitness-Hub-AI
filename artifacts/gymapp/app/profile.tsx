import { useAuth, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
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
import { SafeAreaView } from "@/components/native-compat";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { profile, updateProfile } = useApp();
  const router = useRouter();
  const colors = useColors();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: profile.name,
    weight: profile.weight.toString(),
    height: profile.height.toString(),
    targetWeight: profile.targetWeight.toString(),
  });

  const handleSave = async () => {
    await updateProfile({
      name: form.name,
      weight: parseFloat(form.weight) || profile.weight,
      height: parseFloat(form.height) || profile.height,
      targetWeight: parseFloat(form.targetWeight) || profile.targetWeight,
    });
    setEditing(false);
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => { await signOut(); router.replace("/sign-in"); } },
    ]);
  };

  const bmi = profile.weight / Math.pow(profile.height / 100, 2);
  const bmiCategory = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
  const bmiColor = bmi < 18.5 ? colors.info : bmi < 25 ? colors.success : bmi < 30 ? colors.warning : colors.error;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatarLarge, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {(profile.name || user?.firstName || "?")[0]?.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.userName, { color: colors.text }]}>{profile.name || user?.firstName || "User"}</Text>
          <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user?.primaryEmailAddress?.emailAddress}</Text>
          <View style={[styles.roleBadge, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.roleText, { color: colors.primary }]}>
              {profile.role === "owner" ? "Gym Owner" : profile.role === "trainer" ? "Trainer" : "Member"}
            </Text>
          </View>
        </View>

        <View style={[styles.bmiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text, alignSelf: "flex-start" }]}>Body Stats & BMI</Text>
          <View style={styles.bmiRow}>
            <View style={styles.bmiItem}>
              <Text style={[styles.bmiVal, { color: colors.text }]}>{profile.weight}kg</Text>
              <Text style={[styles.bmiLabel, { color: colors.mutedForeground }]}>Weight</Text>
            </View>
            <View style={styles.bmiItem}>
              <Text style={[styles.bmiVal, { color: colors.text }]}>{profile.height}cm</Text>
              <Text style={[styles.bmiLabel, { color: colors.mutedForeground }]}>Height</Text>
            </View>
            <View style={styles.bmiItem}>
              <Text style={[styles.bmiVal, { color: bmiColor }]}>{bmi.toFixed(1)}</Text>
              <Text style={[styles.bmiLabel, { color: colors.mutedForeground }]}>BMI</Text>
            </View>
          </View>
          <View style={[styles.bmiBadge, { backgroundColor: bmiColor + "20" }]}>
            <View style={[styles.bmiBadgeDot, { backgroundColor: bmiColor }]} />
            <Text style={[styles.bmiBadgeText, { color: bmiColor }]}>{bmiCategory}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Daily Targets</Text>
          </View>
          <View style={styles.targetsGrid}>
            {[
              { label: "Calories", value: profile.dailyCalorieTarget, unit: "kcal", color: colors.primary },
              { label: "Protein", value: profile.dailyProteinTarget, unit: "g", color: colors.protein },
              { label: "Carbs", value: profile.dailyCarbTarget, unit: "g", color: colors.carbs },
              { label: "Fat", value: profile.dailyFatTarget, unit: "g", color: colors.fat },
            ].map((item) => (
              <View key={item.label} style={[styles.targetItem, { borderColor: item.color + "30" }]}>
                <Text style={[styles.targetVal, { color: item.color }]}>{item.value}</Text>
                <Text style={[styles.targetUnit, { color: colors.mutedForeground }]}>{item.unit}</Text>
                <Text style={[styles.targetLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {editing ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Edit Profile</Text>
            <View style={styles.editForm}>
              {(
                [
                  { key: "name" as const, label: "Name", kbType: "default" as const },
                  { key: "weight" as const, label: "Weight (kg)", kbType: "decimal-pad" as const },
                  { key: "height" as const, label: "Height (cm)", kbType: "decimal-pad" as const },
                  { key: "targetWeight" as const, label: "Target Weight (kg)", kbType: "decimal-pad" as const },
                ] as const
              ).map(({ key, label, kbType }) => (
                <View key={key} style={styles.editField}>
                  <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={form[key]}
                    onChangeText={(v) => setForm({ ...form, [key]: v })}
                    keyboardType={kbType}
                    autoCapitalize={key === "name" ? "words" : "none"}
                  />
                </View>
              ))}
              <View style={styles.editButtons}>
                <Pressable style={[styles.editBtn, { borderColor: colors.border }]} onPress={() => setEditing(false)}>
                  <Text style={[styles.editBtnText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.editBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={handleSave}>
                  <Text style={[styles.editBtnText, { color: "#fff" }]}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <Pressable style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setEditing(true)}>
            <Feather name="edit-2" size={18} color={colors.text} />
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Edit Profile</Text>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}

        <Pressable style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push("/progress")}>
          <Feather name="trending-up" size={18} color={colors.text} />
          <Text style={[styles.actionBtnText, { color: colors.text }]}>View Progress</Text>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>

        <Pressable style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: "#EF444440" }]} onPress={handleSignOut}>
          <Feather name="log-out" size={18} color={colors.error} />
          <Text style={[styles.actionBtnText, { color: colors.error }]}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, alignItems: "center", gap: 8 },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 36, fontWeight: "700" },
  userName: { fontSize: 22, fontWeight: "700" },
  userEmail: { fontSize: 14 },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  roleText: { fontSize: 13, fontWeight: "600" },
  bmiCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  bmiRow: { flexDirection: "row", justifyContent: "space-around" },
  bmiItem: { alignItems: "center" },
  bmiVal: { fontSize: 20, fontWeight: "700" },
  bmiLabel: { fontSize: 11, marginTop: 2 },
  bmiBadge: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignSelf: "flex-start" },
  bmiBadgeDot: { width: 8, height: 8, borderRadius: 4 },
  bmiBadgeText: { fontSize: 14, fontWeight: "700" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignSelf: "stretch", marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  targetsGrid: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
  targetItem: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, alignItems: "center" },
  targetVal: { fontSize: 20, fontWeight: "700" },
  targetUnit: { fontSize: 11 },
  targetLabel: { fontSize: 11, marginTop: 2 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1 },
  actionBtnText: { flex: 1, fontSize: 15, fontWeight: "600" },
  editForm: { gap: 12, alignSelf: "stretch", marginTop: 8 },
  editField: { gap: 6 },
  editLabel: { fontSize: 12, fontWeight: "500" },
  editInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  editButtons: { flexDirection: "row", gap: 12, marginTop: 4 },
  editBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, borderWidth: 1, alignItems: "center" },
  editBtnText: { fontSize: 15, fontWeight: "600" },
});
