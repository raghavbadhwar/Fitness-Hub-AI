import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "@/components/native-compat";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
import { useNutrition } from "@/contexts/NutritionContext";
import { useWorkout } from "@/contexts/WorkoutContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { MacroRing } from "@/components/MacroRing";
import { MacroBar } from "@/components/MacroBar";
import { StatCard } from "@/components/StatCard";

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 80;
const STAGGER_MS = 150;
const USE_NATIVE_DRIVER = Platform.OS !== "web";

type TimeOfDay = "morning" | "afternoon" | "evening";

interface TipBucket {
  morning: string[];
  afternoon: string[];
  evening: string[];
}

const TIP_POOL: Record<string, TipBucket> = {
  lose_weight: {
    morning: [
      "Start with a high-protein breakfast (eggs or paneer) — it reduces hunger hormones for the rest of the day.",
      "Drink a full glass of water first thing in the morning before anything else. It kick-starts metabolism.",
      "Every healthy choice today compounds. You are building a new version of yourself — one morning at a time.",
      "Swap maida rotis for whole wheat and cut refined carbs without giving up your favourite foods.",
      "Morning habit: weigh yourself after using the bathroom for the most consistent tracking data.",
      "Try intermittent fasting: skip breakfast and eat within an 8-hour window to cut 200–300 calories effortlessly.",
      "Prep a high-volume, low-calorie breakfast: a large omelette with veggies is under 250 calories and very filling.",
    ],
    afternoon: [
      "Swap your afternoon chai biscuits for a handful of roasted chana — same crunch, double the protein.",
      "Afternoon slump? A green tea instead of a sugary drink saves 120+ calories and adds antioxidants.",
      "Drink a full glass of water before your lunch — it naturally reduces portion size by 13% on average.",
      "Eat your meals in this order: vegetables first, protein second, carbs last — it lowers blood sugar spikes.",
      "Add a salad before your biggest meal — the fibre fills you up and reduces total calorie intake by ~11%.",
      "Afternoon reset: a 10-minute walk after lunch clears your head and boosts afternoon fat oxidation.",
      "Replace fruit juice with whole fruit at your afternoon snack — you get the fibre and feel fuller longer.",
    ],
    evening: [
      "Evening wind-down: log everything you ate today. Tracking consistently is the #1 predictor of weight loss success.",
      "Evening walk of 20 minutes can burn 80–100 calories AND lower cortisol, which drives belly fat storage.",
      "Late-night cravings? Try a small bowl of low-fat curd with a pinch of jeera — satisfying and under 80 calories.",
      "A 10-minute walk after dinner can boost fat oxidation by up to 30%. Even a short stroll counts!",
      "Mindful eating at dinner: put your phone down. Distracted eating leads to 25% more calories consumed.",
      "Celebrate non-scale victories — better sleep, more energy, fitting into old clothes. Progress is progress!",
      "Chew your food slowly at dinner — it takes 20 minutes for your brain to register fullness. Savour each bite!",
    ],
  },
  build_muscle: {
    morning: [
      "A protein-rich breakfast (3 eggs or 200g paneer) sets the anabolic tone for the whole day.",
      "Morning pump: even a 20-minute session with compound movements triggers muscle protein synthesis.",
      "Expose yourself to sunlight within 30 minutes of waking — it regulates cortisol, protecting your muscle.",
      "Creatine monohydrate (3–5g/day) — take it with breakfast for consistent dosing and maximum benefit.",
      "Eat in a slight caloric surplus (200–300 kcal above maintenance) for lean muscle gain without excess fat.",
      "Warm up properly: 5 minutes of mobility work reduces injury risk and improves your working set performance.",
      "Morning mindset: progressive overload is king — try to add 2.5kg or 1–2 reps to one exercise today.",
    ],
    afternoon: [
      "Post-workout, have paneer or eggs within 30 mins. Your muscles are primed for protein synthesis right now.",
      "Dal chawal post-workout is underrated — a complete amino acid profile plus fast-digesting carbs.",
      "Hydration matters for muscle: even 2% dehydration reduces strength output significantly. Drink up!",
      "Compound lifts first (squat, deadlift, bench, row), isolation work second. Build the foundation.",
      "Don't skip leg day — your legs are 50% of your muscle mass and release the most anabolic hormones.",
      "Mind-muscle connection: slow down your reps and feel the target muscle working. Quality beats quantity.",
      "Track your lifts every session. You can't improve what you don't measure.",
    ],
    evening: [
      "A slow-digesting protein like curd or cottage cheese before bed feeds your muscles overnight.",
      "Evening recovery: foam roll your quads, lats, and chest for 5 minutes to clear lactate and reduce soreness.",
      "Sleep is when muscles grow. Aim for 7–9 hours — it's as important as your training and nutrition.",
      "Periodise your training — 4 weeks of volume, then 1 week of deload. Your joints and CNS will thank you.",
      "Rest days are growth days — muscle is built during recovery, not during the workout.",
      "Aim for 1.6–2.2g of protein per kg of bodyweight. Dal, paneer, eggs, and chicken are your best allies.",
      "Consistency over perfection — showing up 4 times a week for a year beats a perfect program for a month.",
    ],
  },
  maintain: {
    morning: [
      "A glass of warm water with lemon kick-starts digestion and hydrates you after a night's sleep.",
      "Morning habit: a 5-minute body scan to check in with how you feel — energy, soreness, and mood all matter.",
      "Strength training 3x/week preserves muscle mass, which keeps your metabolism elevated at maintenance.",
      "Don't fear carbs — whole grain carbs like oats, brown rice, and roti fuel your workouts and mood.",
      "Vary your protein sources — alternate between eggs, dal, fish, chicken, and paneer for a full amino spectrum.",
      "A maintenance mindset: health is a lifestyle, not a destination. Every good choice reinforces the habit.",
      "Set a weekly intention: what one habit will you reinforce this week to stay on track?",
    ],
    afternoon: [
      "Focus on eating mostly whole foods today — dals, sabzis, and roti. Avoid processed snacks.",
      "Afternoon reset: a 10-minute walk clears your head, resets posture, and burns a modest 40–50 calories.",
      "Social eating tip: you can enjoy a meal out and still maintain — just eat lighter the next meal.",
      "Seasonal eating is smart — fresh, local produce is cheaper, more nutritious, and tastes better.",
      "At maintenance, nutrient quality matters more than ever. Prioritise micronutrients: iron, zinc, vitamin D.",
      "Eat mindfully — savour your food, eat without screens, and stop at 80% fullness (hara hachi bu).",
      "Try a new physical activity this week: swimming, cycling, or a yoga class keeps things interesting.",
    ],
    evening: [
      "Evening wind-down: a 10-minute stretching routine improves sleep quality and reduces next-day stiffness.",
      "Weekly check-in: review your food logs, workouts, and sleep. Small tweaks keep you on track long-term.",
      "Celebrate what your body can do — lift heavier, run longer, feel better. Maintenance is a win.",
      "Track your energy levels weekly. If you're consistently tired, check sleep and iron levels.",
      "Your maintenance calorie needs shift with activity — on rest days, eat a little less; on training days, more.",
      "Maintenance is an active process — keep tracking and stay consistent with your workout schedule.",
      "Staying active throughout the day matters — take the stairs, walk to the store, stand while working.",
    ],
  },
  improve_fitness: {
    morning: [
      "Dynamic warm-ups (leg swings, arm circles, hip rotations) prime your nervous system for a great session.",
      "Expose yourself to sunlight within 30 minutes of waking — it anchors your circadian rhythm and energy levels.",
      "Fuel for performance — eat a banana or a small bowl of poha 45–60 minutes before a tough workout.",
      "Morning VO2 max boost: a Zone 2 run (conversational pace) for 20 minutes builds aerobic base effectively.",
      "Set a performance goal, not just a body goal — run a 5K, do 10 pull-ups, or hold a plank for 2 minutes.",
      "A strong core underpins every fitness goal. Add planks, dead bugs, and hollow holds to every session.",
      "Track your resting heart rate weekly — as fitness improves, it should trend lower (under 60 bpm is excellent).",
    ],
    afternoon: [
      "Mix cardio and strength today. Try a 20-min run followed by compound lifts. Your body adapts to variety!",
      "Afternoon tip: a short 15-minute walk after lunch improves insulin sensitivity and afternoon energy.",
      "HIIT for 20 minutes burns as many calories as a 45-minute steady run — and boosts VO2 max faster.",
      "Focus on functional movements: squats, lunges, push-ups, rows — they improve real-world strength.",
      "Cross-train: cycling one day, swimming another, lifting on a third. Reduces overuse injuries significantly.",
      "Breathing technique: exhale on exertion to engage your core and protect your spine during lifts.",
      "Fitness plateaus are normal. Change your routine every 4–6 weeks to keep adapting.",
    ],
    evening: [
      "Even 20 minutes of yoga or stretching on rest days accelerates overall recovery significantly.",
      "Sleep is the #1 performance enhancer. Athletes who sleep 9 hours outperform those sleeping 6 in all metrics.",
      "Recovery nutrition: a 3:1 carb-to-protein ratio meal within 45 minutes of training maximises adaptation.",
      "Flexibility and mobility training improves your strength lifts by increasing joint range of motion.",
      "Join a class or a running group — social accountability doubles adherence to fitness routines.",
      "Consistency beats intensity — three moderate sessions a week outperform one brutal session in the long run.",
      "Evening reflection: did you move your body today? Even a short walk counts toward your fitness journey.",
    ],
  },
};

function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

async function getNextTip(goal: string): Promise<string> {
  const bucket = TIP_POOL[goal] ?? TIP_POOL.maintain;
  const timeOfDay = getTimeOfDay();
  const pool = bucket[timeOfDay];
  const key = `@gymapp_tip_index_${goal}_${timeOfDay}`;
  try {
    const stored = await AsyncStorage.getItem(key);
    const lastIndex = stored !== null ? parseInt(stored, 10) : -1;
    const nextIndex = (lastIndex + 1) % pool.length;
    await AsyncStorage.setItem(key, String(nextIndex));
    return pool[nextIndex];
  } catch {
    return pool[0];
  }
}

function AnimatedCard({
  children,
  delay,
  style,
}: {
  children: React.ReactNode;
  delay: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        delay,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        delay,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { user } = useUser();
  const { profile } = useApp();
  const { todayLog, updateWaterIntake } = useNutrition();
  const { sessions, getRecentSessions } = useWorkout();
  const { getTodayClasses, isEnrolled } = useSchedule();
  const router = useRouter();
  const colors = useColors();

  const [aiTip, setAiTip] = useState<string>("Loading your personalised tip...");

  useEffect(() => {
    getNextTip(profile.fitnessGoal).then(setAiTip);
  }, [profile.fitnessGoal]);

  const todayNutrition = useMemo(() => {
    return todayLog.entries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fat: acc.fat + e.fat,
        fiber: acc.fiber + e.fiber,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    );
  }, [todayLog.entries]);

  const todayClasses = getTodayClasses();
  const recentSessions = getRecentSessions(3);

  const streak = useMemo(() => {
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      if (sessions.some((s) => s.date === dateKey && s.completed)) {
        count++;
      } else if (i > 0) break;
    }
    return count;
  }, [sessions]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = profile.name?.split(" ")[0] || user?.firstName || "there";

  const handleAddWater = async (glasses: number) => {
    const newTotal = Math.min(todayLog.waterIntake + glasses, 20);
    await updateWaterIntake(newTotal);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedCard delay={0}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting()}</Text>
              <Text style={[styles.name, { color: colors.text }]}>{firstName} 💪</Text>
            </View>
            <Pressable
              onPress={() => router.push("/profile")}
              style={[
                styles.avatar,
                { backgroundColor: colors.primary + "20", borderColor: colors.primary },
              ]}
            >
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {firstName[0]?.toUpperCase()}
              </Text>
            </Pressable>
          </View>
        </AnimatedCard>

        <AnimatedCard delay={STAGGER_MS * 1}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Calories</Text>
            <View style={styles.calorieSection}>
              <MacroRing
                calories={todayNutrition.calories}
                target={profile.dailyCalorieTarget}
                protein={todayNutrition.protein}
                carbs={todayNutrition.carbs}
                fat={todayNutrition.fat}
                size={160}
              />
              <View style={styles.calorieMeta}>
                <View style={styles.calorieStat}>
                  <Text style={[styles.calorieStatVal, { color: colors.primary }]}>
                    {profile.dailyCalorieTarget}
                  </Text>
                  <Text style={[styles.calorieStatLabel, { color: colors.mutedForeground }]}>
                    Goal
                  </Text>
                </View>
                <View style={styles.calorieStat}>
                  <Text style={[styles.calorieStatVal, { color: colors.text }]}>
                    {todayNutrition.calories}
                  </Text>
                  <Text style={[styles.calorieStatLabel, { color: colors.mutedForeground }]}>
                    Eaten
                  </Text>
                </View>
                <View style={styles.calorieStat}>
                  <Text style={[styles.calorieStatVal, { color: colors.success }]}>
                    {Math.max(0, profile.dailyCalorieTarget - todayNutrition.calories)}
                  </Text>
                  <Text style={[styles.calorieStatLabel, { color: colors.mutedForeground }]}>
                    Left
                  </Text>
                </View>
              </View>
            </View>
            <MacroBar
              protein={todayNutrition.protein}
              carbs={todayNutrition.carbs}
              fat={todayNutrition.fat}
              proteinTarget={profile.dailyProteinTarget}
              carbTarget={profile.dailyCarbTarget}
              fatTarget={profile.dailyFatTarget}
            />
          </View>
        </AnimatedCard>

        <AnimatedCard delay={STAGGER_MS * 2}>
          <View style={styles.statsGrid}>
            <View style={{ flex: 1 }}>
              <StatCard
                title="Streak"
                value={streak}
                unit="days"
                subtitle={streak > 0 ? "Keep it up!" : "Start today!"}
                icon={<Feather name="zap" size={16} color={colors.warning} />}
                color={colors.warning}
              />
            </View>
            <View style={{ flex: 1 }}>
              <StatCard
                title="Water"
                value={todayLog.waterIntake}
                unit="/ 8 glasses"
                subtitle="Stay hydrated"
                icon={<Feather name="droplet" size={16} color={colors.info} />}
                color={colors.info}
                progress={todayLog.waterIntake / 8}
              />
            </View>
          </View>
        </AnimatedCard>

        <AnimatedCard delay={STAGGER_MS * 3}>
          <View
            style={[
              styles.waterWidget,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.waterWidgetHeader}>
              <Feather name="droplet" size={16} color={colors.info} />
              <Text style={[styles.waterWidgetTitle, { color: colors.text }]}>Quick Add Water</Text>
              <Text style={[styles.waterWidgetCount, { color: colors.info }]}>
                {todayLog.waterIntake}/8 glasses
              </Text>
            </View>
            <View style={styles.waterBtnRow}>
              {[1, 2, 3, 4].map((n) => (
                <Pressable
                  key={n}
                  style={[
                    styles.waterBtn,
                    { backgroundColor: colors.info + "20", borderColor: colors.info + "40" },
                  ]}
                  onPress={() => handleAddWater(n)}
                >
                  <Text style={[styles.waterBtnText, { color: colors.info }]}>+{n}</Text>
                  <Text style={[styles.waterBtnLabel, { color: colors.mutedForeground }]}>
                    {n === 1 ? "glass" : "glasses"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </AnimatedCard>

        <AnimatedCard delay={STAGGER_MS * 4}>
          {todayClasses.length > 0 ? (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Classes</Text>
                <Pressable onPress={() => router.push("/(tabs)/schedule")}>
                  <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
                </Pressable>
              </View>
              {todayClasses.slice(0, 2).map((cls) => (
                <View
                  key={cls.id}
                  style={[
                    styles.classCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderLeftColor: cls.color,
                      borderLeftWidth: 3,
                    },
                  ]}
                >
                  <View>
                    <Text style={[styles.className, { color: colors.text }]}>{cls.name}</Text>
                    <Text style={[styles.classInfo, { color: colors.mutedForeground }]}>
                      {cls.startTime} · {cls.duration}min · {cls.trainer}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.classBadge,
                      { backgroundColor: isEnrolled(cls.id) ? colors.success + "20" : colors.card },
                    ]}
                  >
                    <Text
                      style={[
                        styles.classBadgeText,
                        { color: isEnrolled(cls.id) ? colors.success : colors.mutedForeground },
                      ]}
                    >
                      {isEnrolled(cls.id)
                        ? "Enrolled"
                        : `${cls.enrolledCount}/${cls.maxParticipants}`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={[styles.emptyIconBg, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="calendar" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No classes today</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Explore our schedule and book your next class
              </Text>
              <Pressable
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/(tabs)/schedule")}
              >
                <Text style={styles.emptyBtnText}>Browse classes →</Text>
              </Pressable>
            </View>
          )}
        </AnimatedCard>

        <AnimatedCard delay={STAGGER_MS * 5}>
          {recentSessions.length > 0 ? (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Workouts</Text>
                <Pressable onPress={() => router.push("/(tabs)/workout")}>
                  <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
                </Pressable>
              </View>
              {recentSessions.map((s) => (
                <View
                  key={s.id}
                  style={[
                    styles.workoutCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.workoutIcon, { backgroundColor: colors.primary + "20" }]}>
                    <Feather name="activity" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.workoutName, { color: colors.text }]}>{s.name}</Text>
                    <Text style={[styles.workoutMeta, { color: colors.mutedForeground }]}>
                      {s.duration}min · {s.exercises.length} exercises ·{" "}
                      {s.totalVolume.toLocaleString()}kg vol
                    </Text>
                  </View>
                  <Text style={[styles.workoutDate, { color: colors.mutedForeground }]}>
                    {s.date.slice(5)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={[styles.emptyIconBg, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="activity" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No workouts yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Start your fitness journey today — every rep counts!
              </Text>
              <Pressable
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/(tabs)/workout")}
              >
                <Text style={styles.emptyBtnText}>Log your first workout →</Text>
              </Pressable>
            </View>
          )}
        </AnimatedCard>

        <AnimatedCard delay={STAGGER_MS * 6}>
          <View
            style={[
              styles.aiTipCard,
              { backgroundColor: colors.primaryMuted, borderColor: colors.primary + "40" },
            ]}
          >
            <View style={styles.aiTipHeader}>
              <Feather name="cpu" size={16} color={colors.primary} />
              <Text style={[styles.aiTipTitle, { color: colors.primary }]}>AI Coach Tip</Text>
              <Text style={[styles.aiTipTime, { color: colors.mutedForeground }]}>
                {getTimeOfDay()}
              </Text>
            </View>
            <Text style={[styles.aiTipText, { color: colors.text }]}>{aiTip}</Text>
            <Pressable onPress={() => router.push("/(tabs)/assistant")}>
              <Text style={[styles.aiTipBtnText, { color: colors.primary }]}>
                Ask your AI Coach →
              </Text>
            </Pressable>
          </View>
        </AnimatedCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  greeting: { fontSize: 14 },
  name: { fontSize: 24, fontWeight: "700" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  avatarText: { fontSize: 18, fontWeight: "700" },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 16 },
  calorieSection: { flexDirection: "row", alignItems: "center", gap: 24 },
  calorieMeta: { flex: 1, gap: 16 },
  calorieStat: { alignItems: "center" },
  calorieStatVal: { fontSize: 22, fontWeight: "700" },
  calorieStatLabel: { fontSize: 11, marginTop: 2 },
  statsGrid: { flexDirection: "row", gap: 12 },
  waterWidget: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 12 },
  waterWidgetHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  waterWidgetTitle: { fontSize: 14, fontWeight: "600", flex: 1 },
  waterWidgetCount: { fontSize: 13, fontWeight: "600" },
  waterBtnRow: { flexDirection: "row", gap: 8 },
  waterBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    paddingVertical: 10,
    gap: 2,
  },
  waterBtnText: { fontSize: 16, fontWeight: "700" },
  waterBtnLabel: { fontSize: 10 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  seeAll: { fontSize: 14, fontWeight: "600" },
  classCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  className: { fontSize: 15, fontWeight: "600" },
  classInfo: { fontSize: 12, marginTop: 2 },
  classBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  classBadgeText: { fontSize: 12, fontWeight: "600" },
  workoutCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  workoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  workoutName: { fontSize: 15, fontWeight: "600" },
  workoutMeta: { fontSize: 12, marginTop: 2 },
  workoutDate: { fontSize: 12 },
  emptyState: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    alignItems: "center",
    gap: 10,
  },
  emptyIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  emptyBtn: { marginTop: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  emptyBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  aiTipCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  aiTipHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  aiTipTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flex: 1,
  },
  aiTipTime: { fontSize: 11, textTransform: "capitalize" },
  aiTipText: { fontSize: 14, lineHeight: 20 },
  aiTipBtnText: { fontSize: 14, fontWeight: "600" },
});
