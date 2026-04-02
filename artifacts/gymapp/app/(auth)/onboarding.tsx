import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
import { useApp } from "@/contexts/AppContext";
import type { FitnessGoal, ActivityLevel, DietType, UserRole } from "@/contexts/AppContext";

const STEPS = ["Personal", "Goals", "Diet", "Role"];

const GENDER_OPTIONS: { label: string; value: "male" | "female" | "other" }[] = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
];

const FITNESS_GOAL_OPTIONS: { label: string; value: FitnessGoal }[] = [
  { label: "Lose Weight", value: "lose_weight" },
  { label: "Build Muscle", value: "build_muscle" },
  { label: "Maintain", value: "maintain" },
  { label: "Improve Fitness", value: "improve_fitness" },
];

const ACTIVITY_LEVEL_OPTIONS: { label: string; value: ActivityLevel }[] = [
  { label: "Sedentary", value: "sedentary" },
  { label: "Light", value: "light" },
  { label: "Moderate", value: "moderate" },
  { label: "Active", value: "active" },
  { label: "Very Active", value: "very_active" },
];

const DIET_TYPE_OPTIONS: { label: string; value: DietType }[] = [
  { label: "Non-Vegetarian", value: "non_veg" },
  { label: "Vegetarian", value: "veg" },
  { label: "Vegan", value: "vegan" },
  { label: "Eggetarian", value: "eggetarian" },
];

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: "Member", value: "member" },
  { label: "Trainer", value: "trainer" },
  { label: "Gym Owner", value: "owner" },
];

export default function Onboarding() {
  const { user } = useUser();
  const { completeOnboarding } = useApp();
  const router = useRouter();
  const colors = useColors();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [data, setData] = useState({
    name: user?.firstName || "",
    age: "25",
    gender: "male" as "male" | "female" | "other",
    height: "170",
    weight: "70",
    targetWeight: "65",
    fitnessGoal: "build_muscle" as FitnessGoal,
    activityLevel: "moderate" as ActivityLevel,
    dietType: "non_veg" as DietType,
    role: "member" as UserRole,
  });

  const update = (key: string, value: string) => setData((d) => ({ ...d, [key]: value }));

  const handleFinish = async () => {
    setLoading(true);
    try {
      await completeOnboarding({
        name: data.name || user?.firstName || "User",
        age: parseInt(data.age) || 25,
        gender: data.gender,
        height: parseFloat(data.height) || 170,
        weight: parseFloat(data.weight) || 70,
        targetWeight: parseFloat(data.targetWeight) || 65,
        fitnessGoal: data.fitnessGoal,
        activityLevel: data.activityLevel,
        dietType: data.dietType,
        role: data.role,
      });
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const options = <T extends string>(choices: { label: string; value: T }[], field: string, current: T) =>
    choices.map(({ label, value }) => (
      <Pressable
        key={value}
        style={[styles.option, { backgroundColor: current === value ? colors.primary : colors.card, borderColor: current === value ? colors.primary : colors.border }]}
        onPress={() => update(field, value)}
      >
        <Text style={[styles.optionText, { color: current === value ? "#fff" : colors.text }]}>{label}</Text>
      </Pressable>
    ));

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Let's get to know you</Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>Tell us about yourself for personalized recommendations</Text>
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Your Name</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]} placeholder="Name" placeholderTextColor={colors.mutedForeground} value={data.name} onChangeText={(v) => update("name", v)} />
              </View>
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Age</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]} placeholder="25" placeholderTextColor={colors.mutedForeground} value={data.age} onChangeText={(v) => update("age", v)} keyboardType="number-pad" />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Height (cm)</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]} placeholder="170" placeholderTextColor={colors.mutedForeground} value={data.height} onChangeText={(v) => update("height", v)} keyboardType="decimal-pad" />
                </View>
              </View>
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Weight (kg)</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]} placeholder="70" placeholderTextColor={colors.mutedForeground} value={data.weight} onChangeText={(v) => update("weight", v)} keyboardType="decimal-pad" />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Target (kg)</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]} placeholder="65" placeholderTextColor={colors.mutedForeground} value={data.targetWeight} onChangeText={(v) => update("targetWeight", v)} keyboardType="decimal-pad" />
                </View>
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Gender</Text>
                <View style={styles.optionRow}>
                  {options(GENDER_OPTIONS, "gender", data.gender)}
                </View>
              </View>
            </View>
          </View>
        );
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>What are your goals?</Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>Your AI coach will tailor everything to help you reach them</Text>
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Fitness Goal</Text>
              <View style={styles.optionGrid}>
                {options(FITNESS_GOAL_OPTIONS, "fitnessGoal", data.fitnessGoal)}
              </View>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Activity Level</Text>
              <View style={styles.optionGrid}>
                {options(ACTIVITY_LEVEL_OPTIONS, "activityLevel", data.activityLevel)}
              </View>
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Your Diet Preference</Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>We'll suggest Indian meals that fit your preferences</Text>
            <View style={styles.form}>
              <View style={styles.optionGrid}>
                {options(DIET_TYPE_OPTIONS, "dietType", data.dietType)}
              </View>
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>How will you use GymOS?</Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>Different features unlock based on your role</Text>
            <View style={styles.form}>
              <View style={styles.optionGrid}>
                {options(ROLE_OPTIONS, "role", data.role)}
              </View>
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.progressBar}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.progressDot, { backgroundColor: i <= step ? colors.primary : colors.border, flex: 1, height: 4, borderRadius: 2, marginHorizontal: 2 }]} />
          ))}
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          {renderStep()}
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {step > 0 && (
            <Pressable style={[styles.backBtn, { borderColor: colors.border }]} onPress={() => setStep(step - 1)}>
              <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.nextBtn, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }, step === 0 && { flex: 1 }]}
            onPress={step < STEPS.length - 1 ? () => setStep(step + 1) : handleFinish}
            disabled={loading}
          >
            <Text style={styles.nextText}>{step < STEPS.length - 1 ? "Continue" : "Start My Journey"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressBar: { flexDirection: "row", paddingHorizontal: 24, paddingVertical: 12 },
  progressDot: {},
  scroll: { flexGrow: 1, padding: 24 },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 26, fontWeight: "700", marginBottom: 8 },
  stepSubtitle: { fontSize: 15, marginBottom: 24, lineHeight: 22 },
  form: { gap: 16 },
  field: { gap: 6 },
  row: { flexDirection: "row", gap: 12 },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  optionRow: { flexDirection: "row", gap: 8 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  optionText: { fontSize: 14, fontWeight: "500" },
  footer: { flexDirection: "row", padding: 24, gap: 12, borderTopWidth: 1 },
  backBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  backText: { fontSize: 16, fontWeight: "600" },
  nextBtn: { flex: 2, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  nextText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
