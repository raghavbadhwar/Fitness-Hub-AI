import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
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
import type {
  FitnessGoal,
  ActivityLevel,
  DietType,
  UserRole,
  FitnessExperience,
  Equipment,
  WorkoutTime,
  MealTiming,
  Injury,
} from "@/contexts/AppContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const USE_NATIVE_DRIVER = Platform.OS !== "web";

const STEP_LABELS = ["Personal", "Experience", "Health", "Goals", "Diet", "Access", "Summary"];

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

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [{ label: "Member", value: "member" }];

const EXPERIENCE_OPTIONS: { label: string; value: FitnessExperience }[] = [
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Advanced", value: "advanced" },
];

const WORKOUT_TIME_OPTIONS: { label: string; value: WorkoutTime }[] = [
  { label: "Morning", value: "morning" },
  { label: "Afternoon", value: "afternoon" },
  { label: "Evening", value: "evening" },
  { label: "Flexible", value: "flexible" },
];

const EQUIPMENT_OPTIONS: { label: string; value: Equipment }[] = [
  { label: "Commercial Gym", value: "commercial_gym" },
  { label: "Home Gym", value: "home_gym" },
  { label: "Outdoor", value: "outdoor" },
  { label: "Minimal Equipment", value: "minimal" },
  { label: "No Equipment", value: "no_equipment" },
];

const MEAL_TIMING_OPTIONS: { label: string; value: MealTiming }[] = [
  { label: "3 Meals", value: "3_meals" },
  { label: "5 Small Meals", value: "5_small_meals" },
  { label: "Intermittent Fasting 16:8", value: "intermittent_fasting" },
  { label: "Intuitive Eating", value: "intuitive_eating" },
];

const INJURY_OPTIONS: { label: string; value: Injury }[] = [
  { label: "Knee", value: "knee" },
  { label: "Lower Back", value: "lower_back" },
  { label: "Shoulder", value: "shoulder" },
  { label: "Wrist", value: "wrist" },
  { label: "None", value: "none" },
];

function calculateTargets(data: {
  weight: string;
  height: string;
  age: string;
  gender: "male" | "female" | "other";
  activityLevel: ActivityLevel;
  fitnessGoal: FitnessGoal;
}) {
  const weight = parseFloat(data.weight) || 70;
  const height = parseFloat(data.height) || 170;
  const age = parseInt(data.age) || 25;
  const activityMultiplier: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const bmr =
    data.gender === "male"
      ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
      : 447.593 + 9.247 * weight + 3.098 * height - 4.33 * age;
  let tdee = Math.round(bmr * activityMultiplier[data.activityLevel]);
  if (data.fitnessGoal === "lose_weight") tdee -= 400;
  if (data.fitnessGoal === "build_muscle") tdee += 300;
  return {
    calories: tdee,
    protein: Math.round(weight * 2.0),
    carbs: Math.round((tdee * 0.4) / 4),
    fat: Math.round((tdee * 0.3) / 9),
  };
}

function getMotivationalMessage(goal: FitnessGoal, name: string): string {
  const firstName = name.split(" ")[0] || "Champion";
  switch (goal) {
    case "lose_weight":
      return `Ready to transform, ${firstName}! Your personalised plan will guide you step by step toward your target weight.`;
    case "build_muscle":
      return `Let's build that physique, ${firstName}! Your nutrition and training plan is calibrated for maximum muscle growth.`;
    case "maintain":
      return `Consistency is key, ${firstName}! Your plan will help you maintain your current progress and feel great every day.`;
    case "improve_fitness":
      return `Time to level up, ${firstName}! Your AI coach will push you toward peak performance and better endurance.`;
    default:
      return `Your journey starts now, ${firstName}! GymOS has you covered every step of the way.`;
  }
}

export default function Onboarding() {
  const { user } = useUser();
  const { completeOnboarding } = useApp();
  const router = useRouter();
  const colors = useColors();

  const [showWelcome, setShowWelcome] = useState(true);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const slideAnim = useRef(new Animated.Value(0)).current;

  const [data, setData] = useState({
    name: user?.firstName || "",
    age: "25",
    gender: "male" as "male" | "female" | "other",
    height: "170",
    weight: "70",
    targetWeight: "65",
    fitnessExperience: "beginner" as FitnessExperience,
    workoutTime: "flexible" as WorkoutTime,
    equipment: "commercial_gym" as Equipment,
    injuries: [] as Injury[],
    fitnessGoal: "build_muscle" as FitnessGoal,
    activityLevel: "moderate" as ActivityLevel,
    dietType: "non_veg" as DietType,
    mealTiming: "3_meals" as MealTiming,
    role: "member" as UserRole,
    gymName: "",
    numTrainers: "",
  });

  const update = (key: string, value: string) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const toggleInjury = (injury: Injury) => {
    setData((d) => {
      if (injury === "none") {
        return { ...d, injuries: d.injuries.includes("none") ? [] : ["none"] };
      }
      const without = d.injuries.filter((i) => i !== "none");
      if (without.includes(injury)) {
        return { ...d, injuries: without.filter((i) => i !== injury) };
      }
      return { ...d, injuries: [...without, injury] };
    });
  };

  const animateToStep = (nextStep: number) => {
    const direction = nextStep > step ? 1 : -1;
    slideAnim.setValue(direction * SCREEN_WIDTH);
    setStep(nextStep);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 0) {
      if (!data.name.trim()) newErrors.name = "Name is required";
      const h = parseFloat(data.height);
      if (isNaN(h) || h < 100 || h > 250) newErrors.height = "Height must be between 100–250 cm";
      const w = parseFloat(data.weight);
      if (isNaN(w) || w < 20 || w > 300) newErrors.weight = "Weight must be between 20–300 kg";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    animateToStep(step + 1);
  };

  const handleBack = () => {
    animateToStep(step - 1);
  };

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
        fitnessExperience: data.fitnessExperience,
        equipment: data.equipment,
        injuries: data.injuries,
        workoutTime: data.workoutTime,
        mealTiming: data.mealTiming,
        gymName: data.gymName,
        numTrainers: data.numTrainers,
      });
      router.replace("/");
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderOption = <T extends string>(
    choices: { label: string; value: T }[],
    field: string,
    current: T,
  ) =>
    choices.map(({ label, value }) => (
      <Pressable
        key={value}
        style={[
          styles.option,
          {
            backgroundColor: current === value ? colors.primary : colors.card,
            borderColor: current === value ? colors.primary : colors.border,
          },
        ]}
        onPress={() => update(field, value)}
      >
        <Text style={[styles.optionText, { color: current === value ? "#fff" : colors.text }]}>
          {label}
        </Text>
      </Pressable>
    ));

  const renderInjuryChip = (injury: Injury, label: string) => {
    const selected = data.injuries.includes(injury);
    return (
      <Pressable
        key={injury}
        style={[
          styles.option,
          {
            backgroundColor: selected ? colors.primary : colors.card,
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}
        onPress={() => toggleInjury(injury)}
      >
        <Text style={[styles.optionText, { color: selected ? "#fff" : colors.text }]}>{label}</Text>
      </Pressable>
    );
  };

  const summary = calculateTargets(data);
  const motivationalMsg = getMotivationalMessage(data.fitnessGoal, data.name);

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Let's get to know you</Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
              Tell us about yourself for personalised recommendations
            </Text>
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Your Name</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      borderColor: errors.name ? colors.destructive : colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Name"
                  placeholderTextColor={colors.mutedForeground}
                  value={data.name}
                  onChangeText={(v) => update("name", v)}
                />
                {errors.name ? (
                  <Text style={[styles.errorText, { color: colors.destructive }]}>
                    {errors.name}
                  </Text>
                ) : null}
              </View>
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Age</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    placeholder="25"
                    placeholderTextColor={colors.mutedForeground}
                    value={data.age}
                    onChangeText={(v) => update("age", v)}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Height (cm)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.card,
                        borderColor: errors.height ? colors.destructive : colors.border,
                        color: colors.text,
                      },
                    ]}
                    placeholder="170"
                    placeholderTextColor={colors.mutedForeground}
                    value={data.height}
                    onChangeText={(v) => update("height", v)}
                    keyboardType="decimal-pad"
                  />
                  {errors.height ? (
                    <Text style={[styles.errorText, { color: colors.destructive }]}>
                      {errors.height}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Weight (kg)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.card,
                        borderColor: errors.weight ? colors.destructive : colors.border,
                        color: colors.text,
                      },
                    ]}
                    placeholder="70"
                    placeholderTextColor={colors.mutedForeground}
                    value={data.weight}
                    onChangeText={(v) => update("weight", v)}
                    keyboardType="decimal-pad"
                  />
                  {errors.weight ? (
                    <Text style={[styles.errorText, { color: colors.destructive }]}>
                      {errors.weight}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Target (kg)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    placeholder="65"
                    placeholderTextColor={colors.mutedForeground}
                    value={data.targetWeight}
                    onChangeText={(v) => update("targetWeight", v)}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Gender</Text>
                <View style={styles.optionRow}>
                  {renderOption(GENDER_OPTIONS, "gender", data.gender)}
                </View>
              </View>
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Your Fitness Background</Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
              Help us tailor workouts to your experience and schedule
            </Text>
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Experience Level
              </Text>
              <View style={styles.optionGrid}>
                {renderOption(EXPERIENCE_OPTIONS, "fitnessExperience", data.fitnessExperience)}
              </View>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Preferred Workout Time
              </Text>
              <View style={styles.optionGrid}>
                {renderOption(WORKOUT_TIME_OPTIONS, "workoutTime", data.workoutTime)}
              </View>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Equipment Access
              </Text>
              <View style={styles.optionGrid}>
                {renderOption(EQUIPMENT_OPTIONS, "equipment", data.equipment)}
              </View>
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>
              Any Injuries or Limitations?
            </Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
              Select all that apply — your AI coach will avoid exercises that could aggravate them
            </Text>
            <View style={styles.form}>
              <View style={styles.optionGrid}>
                {INJURY_OPTIONS.map(({ label, value }) => renderInjuryChip(value, label))}
              </View>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>What are your goals?</Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
              Your AI coach will tailor everything to help you reach them
            </Text>
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Fitness Goal</Text>
              <View style={styles.optionGrid}>
                {renderOption(FITNESS_GOAL_OPTIONS, "fitnessGoal", data.fitnessGoal)}
              </View>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Activity Level</Text>
              <View style={styles.optionGrid}>
                {renderOption(ACTIVITY_LEVEL_OPTIONS, "activityLevel", data.activityLevel)}
              </View>
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Your Diet Preference</Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
              We'll suggest Indian meals that fit your preferences
            </Text>
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Diet Type</Text>
              <View style={styles.optionGrid}>
                {renderOption(DIET_TYPE_OPTIONS, "dietType", data.dietType)}
              </View>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Meal Timing Preference
              </Text>
              <View style={styles.optionGrid}>
                {renderOption(MEAL_TIMING_OPTIONS, "mealTiming", data.mealTiming)}
              </View>
            </View>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>How will you use GymOS?</Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
              Your gym team controls which email can enter the app and which tools each person sees.
            </Text>
            <View style={styles.form}>
              <View style={styles.optionGrid}>{renderOption(ROLE_OPTIONS, "role", data.role)}</View>
              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.summaryCardTitle, { color: colors.text }]}>Access model</Text>
                <Text style={[styles.summaryNote, { color: colors.mutedForeground }]}>
                  This account starts with member app access. If you need trainer tools later, your
                  gym team can turn them on for this email.
                </Text>
              </View>
            </View>
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>You're all set!</Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
              {motivationalMsg}
            </Text>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.summaryCardTitle, { color: colors.text }]}>
                Your Daily Targets
              </Text>
              <View style={styles.calorieRow}>
                <Text style={[styles.calorieValue, { color: colors.primary }]}>
                  {summary.calories}
                </Text>
                <Text style={[styles.calorieUnit, { color: colors.mutedForeground }]}>
                  kcal / day
                </Text>
              </View>
              <View style={styles.macroRow}>
                <View style={styles.macroItem}>
                  <View style={[styles.macroDot, { backgroundColor: "#ef4444" }]} />
                  <Text style={[styles.macroValue, { color: colors.text }]}>
                    {summary.protein}g
                  </Text>
                  <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>
                    Protein
                  </Text>
                </View>
                <View style={styles.macroItem}>
                  <View style={[styles.macroDot, { backgroundColor: "#f59e0b" }]} />
                  <Text style={[styles.macroValue, { color: colors.text }]}>{summary.carbs}g</Text>
                  <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>Carbs</Text>
                </View>
                <View style={styles.macroItem}>
                  <View style={[styles.macroDot, { backgroundColor: "#3b82f6" }]} />
                  <Text style={[styles.macroValue, { color: colors.text }]}>{summary.fat}g</Text>
                  <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>Fat</Text>
                </View>
              </View>
            </View>
            <View
              style={[
                styles.summaryDetails,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <SummaryRow
                label="Goal"
                value={FITNESS_GOAL_OPTIONS.find((o) => o.value === data.fitnessGoal)?.label || ""}
                textColor={colors.text}
                mutedColor={colors.mutedForeground}
              />
              <SummaryRow
                label="Experience"
                value={
                  EXPERIENCE_OPTIONS.find((o) => o.value === data.fitnessExperience)?.label || ""
                }
                textColor={colors.text}
                mutedColor={colors.mutedForeground}
              />
              <SummaryRow
                label="Diet"
                value={DIET_TYPE_OPTIONS.find((o) => o.value === data.dietType)?.label || ""}
                textColor={colors.text}
                mutedColor={colors.mutedForeground}
              />
              <SummaryRow
                label="Equipment"
                value={EQUIPMENT_OPTIONS.find((o) => o.value === data.equipment)?.label || ""}
                textColor={colors.text}
                mutedColor={colors.mutedForeground}
              />
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  if (showWelcome) {
    return (
      <SafeAreaView style={[styles.welcomeContainer, { backgroundColor: colors.background }]}>
        <View style={styles.welcomeContent}>
          <View style={[styles.welcomeLogo, { backgroundColor: colors.primary }]}>
            <Text style={styles.welcomeLogoText}>G</Text>
          </View>
          <Text style={[styles.welcomeTitle, { color: colors.text }]}>GymOS</Text>
          <Text style={[styles.welcomeTagline, { color: colors.primary }]}>
            Train Smarter. Live Better.
          </Text>
          <Text style={[styles.welcomeDesc, { color: colors.mutedForeground }]}>
            AI-powered gym companion for Indian athletes. Get personalised workouts, nutrition
            plans, and a coach that knows your goals.
          </Text>
        </View>
        <Pressable
          style={[styles.getStartedBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowWelcome(false)}
        >
          <Text style={styles.getStartedText}>Get Started</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isLastStep = step === STEP_LABELS.length - 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.progressBar}>
          {STEP_LABELS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                {
                  backgroundColor: i <= step ? colors.primary : colors.border,
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  marginHorizontal: 2,
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.stepIndicator, { color: colors.mutedForeground }]}>
          Step {step + 1} of {STEP_LABELS.length}
        </Text>
        <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: slideAnim }] }]}>
          <ScrollView contentContainerStyle={styles.scroll}>{renderStep()}</ScrollView>
        </Animated.View>
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {step > 0 && (
            <Pressable
              style={[styles.backBtn, { borderColor: colors.border }]}
              onPress={handleBack}
            >
              <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
            </Pressable>
          )}
          <Pressable
            style={[
              styles.nextBtn,
              { backgroundColor: colors.primary },
              loading && { opacity: 0.7 },
              step === 0 && { flex: 1 },
            ]}
            onPress={isLastStep ? handleFinish : handleNext}
            disabled={loading}
          >
            <Text style={styles.nextText}>{isLastStep ? "Start My Journey" : "Continue"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  textColor,
  mutedColor,
}: {
  label: string;
  value: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryRowLabel, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.summaryRowValue, { color: textColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  welcomeContainer: { flex: 1, padding: 32, justifyContent: "space-between" },
  welcomeContent: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  welcomeLogo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  welcomeLogoText: { fontSize: 40, fontWeight: "900", color: "#fff" },
  welcomeTitle: { fontSize: 40, fontWeight: "900", letterSpacing: -1 },
  welcomeTagline: { fontSize: 18, fontWeight: "600" },
  welcomeDesc: { fontSize: 15, textAlign: "center", lineHeight: 24, paddingHorizontal: 8 },
  getStartedBtn: { borderRadius: 16, paddingVertical: 18, alignItems: "center", marginTop: 16 },
  getStartedText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  container: { flex: 1 },
  progressBar: { flexDirection: "row", paddingHorizontal: 24, paddingVertical: 12 },
  progressDot: {},
  stepIndicator: { fontSize: 12, fontWeight: "600", textAlign: "center", marginBottom: 4 },
  scroll: { flexGrow: 1, padding: 24 },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 26, fontWeight: "700", marginBottom: 8 },
  stepSubtitle: { fontSize: 15, marginBottom: 24, lineHeight: 22 },
  form: { gap: 16 },
  field: { gap: 6 },
  row: { flexDirection: "row", gap: 12 },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  errorText: { fontSize: 12, marginTop: 2 },
  optionRow: { flexDirection: "row", gap: 8 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  optionText: { fontSize: 14, fontWeight: "500" },
  footer: { flexDirection: "row", padding: 24, gap: 12, borderTopWidth: 1 },
  backBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  backText: { fontSize: 16, fontWeight: "600" },
  nextBtn: { flex: 2, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  nextText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  summaryCard: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 16, marginBottom: 12 },
  summaryCardTitle: { fontSize: 16, fontWeight: "700" },
  summaryNote: { fontSize: 14, lineHeight: 20 },
  calorieRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  calorieValue: { fontSize: 48, fontWeight: "900" },
  calorieUnit: { fontSize: 16 },
  macroRow: { flexDirection: "row", gap: 24 },
  macroItem: { alignItems: "center", gap: 4 },
  macroDot: { width: 10, height: 10, borderRadius: 5 },
  macroValue: { fontSize: 18, fontWeight: "700" },
  macroLabel: { fontSize: 12 },
  summaryDetails: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryRowLabel: { fontSize: 14 },
  summaryRowValue: { fontSize: 14, fontWeight: "600" },
});
