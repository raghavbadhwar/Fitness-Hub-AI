import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { useDebounce } from "@/hooks/useDebounce";
import { useApp } from "@/contexts/AppContext";
import {
  type SaveWorkoutPlanInput,
  type SavedWorkoutPlan,
  useWorkout,
} from "@/contexts/WorkoutContext";
import { EXERCISES, searchExercises } from "@/constants/exercises";
import { useAuth } from "@clerk/expo";
import { getApiBase } from "@/lib/api-base";

const MUSCLE_FILTER_CHIPS = [
  "All",
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
  "Cardio",
  "Yoga",
];

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 80;

const QUICK_STARTS = [
  {
    name: "Push Day",
    exercises: [
      "bench_press",
      "incline_press",
      "cable_crossover",
      "overhead_press",
      "lateral_raise",
      "tricep_pushdown",
    ],
  },
  {
    name: "Pull Day",
    exercises: ["pullup", "bent_row", "lat_pulldown", "seated_row", "bicep_curl", "hammer_curl"],
  },
  {
    name: "Leg Day",
    exercises: ["squat", "leg_press", "lunges", "leg_curl", "calf_raise", "rdl"],
  },
  {
    name: "Full Body",
    exercises: ["deadlift", "bench_press", "pullup", "squat", "overhead_press", "plank"],
  },
  {
    name: "Cardio & Core",
    exercises: ["burpee", "mountain_climber", "plank", "crunches", "jumping_jacks", "leg_raises"],
  },
  {
    name: "Upper Body",
    exercises: ["bench_press", "bent_row", "overhead_press", "lat_pulldown", "bicep_curl", "dips"],
  },
];

interface TemplateExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  notes?: string;
}

interface WorkoutTemplate {
  id: number;
  trainerId: string;
  trainerName: string;
  name: string;
  exercises: TemplateExercise[];
  createdAt: string;
}

interface AssignedWorkout {
  id: number;
  templateId: number;
  trainerId: string;
  memberName: string;
  assignedAt: string;
  completedAt: string | null;
  templateName: string;
  trainerName: string;
  exercises: TemplateExercise[];
}

interface AssignableMember {
  id: string;
  name: string;
  email: string;
}

interface AISuggestedExercise {
  name?: string;
  sets?: number | string;
  reps?: string | number;
  restSeconds?: number | string;
  notes?: string;
}

interface AIWorkoutSuggestion {
  workoutName?: string;
  focus?: string;
  duration?: number;
  exercises?: AISuggestedExercise[];
  warmup?: string;
  cooldown?: string;
  motivationalTip?: string;
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
  }

  const parsed = parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default function WorkoutScreen() {
  const { profile, refreshProfile } = useApp();
  const {
    sessions,
    personalRecords,
    savedPlans,
    behaviorProfile,
    startSession,
    startPlanSession,
    savePlan,
    deletePlan,
    getWeeklyVolume,
  } = useWorkout();
  const router = useRouter();
  const colors = useColors();
  const { getToken, userId } = useAuth();
  const [loadingAI, setLoadingAI] = useState(false);
  const isTrainerOrOwner = profile.role === "trainer" || profile.role === "owner";
  const isMemberView = !isTrainerOrOwner;

  const tabOptions = isTrainerOrOwner
    ? (["workouts", "exercises", "records", "templates"] as const)
    : (["workouts", "exercises", "records"] as const);
  type TabOption = (typeof tabOptions)[number];

  const [activeTab, setActiveTab] = useState<TabOption>("workouts");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const debouncedExerciseSearch = useDebounce(exerciseSearch, 300);
  const [selectedMuscle, setSelectedMuscle] = useState("All");

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [assignableMembers, setAssignableMembers] = useState<AssignableMember[]>([]);
  const [loadingAssignableMembers, setLoadingAssignableMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const debouncedMemberSearch = useDebounce(memberSearch, 300);
  const [selectedMember, setSelectedMember] = useState<AssignableMember | null>(null);
  const [assigningWorkout, setAssigningWorkout] = useState(false);

  const [assignedWorkouts, setAssignedWorkouts] = useState<AssignedWorkout[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SavedWorkoutPlan | null>(null);

  const weeklyVolume = getWeeklyVolume();
  const thisWeekVolume = weeklyVolume.reduce((sum, d) => sum + d.volume, 0);
  const recentSessions = sessions.slice(0, 10);
  const savedPlanSummaries = useMemo(
    () =>
      savedPlans.slice(0, 4).map((plan) => ({
        name: plan.name,
        focus: plan.focus,
        exerciseCount: plan.exercises.length,
        exercises: plan.exercises.slice(0, 6).map((exercise) => exercise.name),
      })),
    [savedPlans],
  );
  const aiCoachSubtitle = useMemo(() => {
    if (!isMemberView || behaviorProfile.completedSessionsLast30Days === 0) {
      return "Personalized plan based on your history & goals";
    }

    const cadence =
      behaviorProfile.consistencyLabel === "locked_in"
        ? "Locked-in rhythm"
        : behaviorProfile.consistencyLabel === "steady"
          ? "Steady momentum"
          : behaviorProfile.consistencyLabel === "building"
            ? "Building consistency"
            : "Fresh start";
    const trainingWindow =
      behaviorProfile.preferredTrainingWindow === "mixed"
        ? "with flexible training times"
        : `for your ${behaviorProfile.preferredTrainingWindow} sessions`;

    return savedPlans.length > 0
      ? `${cadence} ${trainingWindow}. AI can build from your saved plans.`
      : `${cadence} ${trainingWindow}. AI keeps the plan easy to execute.`;
  }, [
    behaviorProfile.completedSessionsLast30Days,
    behaviorProfile.consistencyLabel,
    behaviorProfile.preferredTrainingWindow,
    isMemberView,
    savedPlans.length,
  ]);
  const myPlansSummary = useMemo(() => {
    if (behaviorProfile.completedSessionsLast30Days === 0) {
      return "Save one custom routine so your next workout is always one tap away.";
    }

    const intro =
      behaviorProfile.consistencyLabel === "locked_in"
        ? "Keep your best repeatable routines ready."
        : "Save routines you can repeat without overthinking.";
    const timing =
      behaviorProfile.preferredTrainingWindow === "mixed"
        ? "varied workout times"
        : `${behaviorProfile.preferredTrainingWindow} sessions`;

    return `${intro} Best flow so far: ${timing}.`;
  }, [
    behaviorProfile.completedSessionsLast30Days,
    behaviorProfile.consistencyLabel,
    behaviorProfile.preferredTrainingWindow,
  ]);

  const filteredExercises = useMemo(() => {
    return searchExercises(
      debouncedExerciseSearch,
      selectedMuscle === "All" ? undefined : selectedMuscle,
    );
  }, [debouncedExerciseSearch, selectedMuscle]);

  const filteredAssignableMembers = useMemo(() => {
    const query = debouncedMemberSearch.trim().toLowerCase();
    if (!query) return assignableMembers;
    return assignableMembers.filter((member) => {
      return (
        member.name.toLowerCase().includes(query) || member.email.toLowerCase().includes(query)
      );
    });
  }, [assignableMembers, debouncedMemberSearch]);

  const fetchTemplates = useCallback(async () => {
    if (!isTrainerOrOwner) return;
    setLoadingTemplates(true);
    try {
      const token = await getToken();
      const resp = await fetch(`${getApiBase()}/api/workouts/templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error("Failed to fetch templates", err);
    } finally {
      setLoadingTemplates(false);
    }
  }, [isTrainerOrOwner, getToken]);

  const fetchAssignableMembers = useCallback(async () => {
    if (!isTrainerOrOwner) return;
    setLoadingAssignableMembers(true);
    try {
      const token = await getToken();
      const resp = await fetch(`${getApiBase()}/api/workouts/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = (await resp.json()) as AssignableMember[];
        setAssignableMembers(data);
      } else {
        const err = await resp.json().catch(() => ({ error: "Failed to fetch members" }));
        Alert.alert("Error", err.error || "Failed to fetch members");
      }
    } catch (err) {
      console.error("Failed to fetch assignable members", err);
      Alert.alert("Error", "Failed to fetch members");
    } finally {
      setLoadingAssignableMembers(false);
    }
  }, [isTrainerOrOwner, getToken]);

  const fetchAssignedWorkouts = useCallback(async () => {
    if (isTrainerOrOwner || !userId) return;
    setLoadingAssigned(true);
    try {
      const token = await getToken();
      const resp = await fetch(
        `${getApiBase()}/api/workouts/assigned?memberId=${encodeURIComponent(userId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (resp.ok) {
        const data = await resp.json();
        setAssignedWorkouts(data);
      }
    } catch (err) {
      console.error("Failed to fetch assigned workouts", err);
    } finally {
      setLoadingAssigned(false);
    }
  }, [isTrainerOrOwner, userId, getToken]);

  useEffect(() => {
    if (isTrainerOrOwner && activeTab === "templates") {
      fetchTemplates();
    }
  }, [activeTab, isTrainerOrOwner, fetchTemplates]);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
      if (!isTrainerOrOwner && userId) {
        fetchAssignedWorkouts();
      }
    }, [fetchAssignedWorkouts, isTrainerOrOwner, refreshProfile, userId]),
  );

  const handleQuickStart = (template: (typeof QUICK_STARTS)[0]) => {
    const exercises = template.exercises.map((id) => {
      const ex = EXERCISES.find((e) => e.id === id)!;
      return {
        exerciseId: ex.id,
        name: ex.name,
        sets: Array.from({ length: ex.defaultSets }, (_, i) => ({
          id: Date.now().toString() + i,
          weight: 0,
          reps: parseInt(ex.defaultReps) || 10,
          completed: false,
        })),
      };
    });
    const session = startSession(template.name, exercises);
    router.push({
      pathname: "/workout-session",
      params: { sessionId: session.id },
    });
  };

  const handleStartAssignedWorkout = (assigned: AssignedWorkout) => {
    const exercises = assigned.exercises.map((te, i) => ({
      exerciseId: te.exerciseId,
      name: te.name,
      sets: Array.from({ length: te.sets }, (_, j) => ({
        id: Date.now().toString() + i + j,
        weight: 0,
        reps: te.reps,
        completed: false,
      })),
      notes: te.notes,
    }));
    const session = startSession(assigned.templateName, exercises);
    router.push({
      pathname: "/workout-session",
      params: {
        sessionId: session.id,
        assignedWorkoutId: assigned.id.toString(),
      },
    });
  };

  const handleStartSavedPlan = useCallback(
    (planId: string) => {
      const session = startPlanSession(planId);
      if (!session) {
        Alert.alert("Error", "We couldn't start that saved plan.");
        return;
      }

      router.push({
        pathname: "/workout-session",
        params: { sessionId: session.id },
      });
    },
    [router, startPlanSession],
  );

  const handleAIWorkout = async () => {
    setLoadingAI(true);
    try {
      const token = await getToken();
      const apiBase = getApiBase();
      const recentData = recentSessions.slice(0, 3).map((s) => ({
        name: s.name,
        exercises: s.exercises.map((e) => e.name),
      }));
      const response = await fetch(`${apiBase}/api/ai/workout-suggestion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recentWorkouts: recentData,
          goals: profile.fitnessGoal,
          fitnessLevel: "intermediate",
          availableTime: 45,
          behaviorProfile,
          savedPlans: savedPlanSummaries,
        }),
      });
      if (!response.ok) throw new Error("Failed to get workout");
      const suggestion: AIWorkoutSuggestion = await response.json();

      const exercises = (suggestion.exercises || []).map((ex) => {
        const exName = typeof ex.name === "string" ? ex.name : "Custom Exercise";
        const setCount = parsePositiveInteger(ex.sets, 3);
        const reps = parsePositiveInteger(ex.reps, 10);
        const found = EXERCISES.find((e) =>
          e.name.toLowerCase().includes(exName.toLowerCase().split(" ")[0]),
        );
        return {
          exerciseId: found?.id || "custom",
          name: exName,
          sets: Array.from({ length: setCount }, (_, i) => ({
            id: Date.now().toString() + i,
            weight: 0,
            reps,
            completed: false,
          })),
          notes: typeof ex.notes === "string" ? ex.notes : undefined,
        };
      });

      const session = startSession(suggestion.workoutName || "AI Workout", exercises);
      router.push({
        pathname: "/workout-session",
        params: { sessionId: session.id },
      });
    } catch (err) {
      Alert.alert("Error", "Failed to generate AI workout. Please try again.");
    } finally {
      setLoadingAI(false);
    }
  };

  const handleSaveCustomPlan = useCallback(
    async (planInput: SaveWorkoutPlanInput) => {
      try {
        await savePlan(planInput);
        setShowPlanModal(false);
        setEditingPlan(null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to save your custom workout plan.";
        Alert.alert("Error", message);
      }
    },
    [savePlan],
  );

  const handleDeleteSavedPlan = useCallback(
    (plan: SavedWorkoutPlan) => {
      Alert.alert("Delete plan", `Remove "${plan.name}" from My Plans?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePlan(plan.id);
            } catch {
              Alert.alert("Error", "Failed to delete this saved plan.");
            }
          },
        },
      ]);
    },
    [deletePlan],
  );

  const handleAssignWorkout = async () => {
    if (!selectedTemplate || !selectedMember) return;
    setAssigningWorkout(true);
    try {
      const token = await getToken();
      const resp = await fetch(`${getApiBase()}/api/workouts/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          memberId: selectedMember.id,
        }),
      });
      if (resp.ok) {
        Alert.alert("Success", `Workout assigned to ${selectedMember.name}!`);
        setShowAssignModal(false);
        setMemberSearch("");
        setSelectedMember(null);
        setSelectedTemplate(null);
      } else {
        const err = await resp.json();
        Alert.alert("Error", err.error || "Failed to assign workout");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to assign workout");
    } finally {
      setAssigningWorkout(false);
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    Alert.alert("Delete Template", "Are you sure you want to delete this template?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await getToken();
            await fetch(`${getApiBase()}/api/workouts/templates/${templateId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            setTemplates((prev) => prev.filter((t) => t.id !== templateId));
          } catch {
            Alert.alert("Error", "Failed to delete template");
          }
        },
      },
    ]);
  };

  const prs = Object.values(personalRecords);

  const tabLabel = (tab: TabOption) => {
    if (tab === "workouts") return "Workouts";
    if (tab === "exercises") return "Exercises";
    if (tab === "records") return "Records";
    if (tab === "templates") return "Templates";
    return tab;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>Workout</Text>
        <Pressable
          style={[styles.startBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            const session = startSession("Custom Workout");
            router.push({
              pathname: "/workout-session",
              params: { sessionId: session.id },
            });
          }}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.startBtnText}>Start</Text>
        </Pressable>
      </View>

      <View style={styles.weekStats}>
        <View
          style={[
            styles.weekStatCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.weekStatVal, { color: colors.primary }]}>
            {
              sessions.filter((s) => {
                const today = new Date();
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 7);
                return new Date(s.date) >= weekAgo && s.completed;
              }).length
            }
          </Text>
          <Text style={[styles.weekStatLabel, { color: colors.mutedForeground }]}>This Week</Text>
        </View>
        <View
          style={[
            styles.weekStatCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.weekStatVal, { color: colors.text }]}>
            {Math.round(thisWeekVolume / 1000)}k
          </Text>
          <Text style={[styles.weekStatLabel, { color: colors.mutedForeground }]}>Volume (kg)</Text>
        </View>
        <View
          style={[
            styles.weekStatCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.weekStatVal, { color: colors.success }]}>{prs.length}</Text>
          <Text style={[styles.weekStatLabel, { color: colors.mutedForeground }]}>Total PRs</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {tabOptions.map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && {
                borderBottomColor: colors.primary,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === tab ? colors.primary : colors.mutedForeground,
                },
              ]}
            >
              {tabLabel(tab)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "workouts" && (
          <>
            {!isTrainerOrOwner && assignedWorkouts.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Assigned by Trainer
                </Text>
                {assignedWorkouts.map((assigned) => (
                  <View
                    key={assigned.id}
                    style={[
                      styles.assignedCard,
                      {
                        backgroundColor: assigned.completedAt ? colors.card : colors.primaryMuted,
                        borderColor: assigned.completedAt ? colors.border : colors.primary + "60",
                        opacity: assigned.completedAt ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View style={styles.assignedCardHeader}>
                      <View
                        style={[
                          styles.assignedIcon,
                          {
                            backgroundColor: assigned.completedAt ? colors.border : colors.primary,
                          },
                        ]}
                      >
                        <Feather
                          name={assigned.completedAt ? "check-circle" : "user-check"}
                          size={18}
                          color="#fff"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.assignedTitle, { color: colors.text }]}>
                          {assigned.templateName}
                        </Text>
                        <Text style={[styles.assignedMeta, { color: colors.mutedForeground }]}>
                          By {assigned.trainerName} · {assigned.exercises.length} exercises
                        </Text>
                        {assigned.completedAt && (
                          <Text style={[styles.assignedCompleted, { color: colors.success }]}>
                            Completed {new Date(assigned.completedAt).toLocaleDateString()}
                          </Text>
                        )}
                      </View>
                    </View>
                    {!assigned.completedAt && (
                      <Pressable
                        style={[styles.startAssignedBtn, { backgroundColor: colors.primary }]}
                        onPress={() => handleStartAssignedWorkout(assigned)}
                      >
                        <Text style={styles.startAssignedBtnText}>Start Workout →</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </>
            )}

            {!isTrainerOrOwner && loadingAssigned && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  Loading assigned workouts...
                </Text>
              </View>
            )}

            {isMemberView && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>My Plans</Text>
                  <Pressable
                    style={[styles.planHeaderBtn, { borderColor: colors.primary }]}
                    onPress={() => {
                      setEditingPlan(null);
                      setShowPlanModal(true);
                    }}
                  >
                    <Feather name="plus" size={14} color={colors.primary} />
                    <Text style={[styles.planHeaderBtnText, { color: colors.primary }]}>
                      New Plan
                    </Text>
                  </Pressable>
                </View>
                <Text style={[styles.sectionHelperText, { color: colors.mutedForeground }]}>
                  {myPlansSummary}
                </Text>

                {savedPlans.length === 0 ? (
                  <View
                    style={[
                      styles.memberPlanEmptyCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.memberPlanEmptyTitle, { color: colors.text }]}>
                      No saved plans yet
                    </Text>
                    <Text style={[styles.memberPlanEmptyBody, { color: colors.mutedForeground }]}>
                      Build one routine you like, save it here, and reuse it on busy days.
                    </Text>
                  </View>
                ) : (
                  savedPlans.map((plan) => (
                    <View
                      key={plan.id}
                      style={[
                        styles.memberPlanCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View style={styles.memberPlanHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.memberPlanName, { color: colors.text }]}>
                            {plan.name}
                          </Text>
                          <Text style={[styles.memberPlanMeta, { color: colors.mutedForeground }]}>
                            {plan.focus ? `${plan.focus} · ` : ""}
                            {plan.exercises.length} exercises
                          </Text>
                        </View>
                        <View
                          style={[styles.memberPlanPill, { backgroundColor: colors.primaryMuted }]}
                        >
                          <Text style={[styles.memberPlanPillText, { color: colors.primary }]}>
                            Saved
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[
                          styles.memberPlanExercisePreview,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {plan.exercises
                          .slice(0, 3)
                          .map((exercise) => exercise.name)
                          .join(" · ")}
                        {plan.exercises.length > 3 ? ` · +${plan.exercises.length - 3} more` : ""}
                      </Text>

                      <View style={styles.memberPlanActions}>
                        <Pressable
                          style={[styles.memberPlanPrimaryBtn, { backgroundColor: colors.primary }]}
                          onPress={() => handleStartSavedPlan(plan.id)}
                        >
                          <Text style={styles.memberPlanPrimaryBtnText}>Start</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.memberPlanSecondaryBtn, { borderColor: colors.border }]}
                          onPress={() => {
                            setEditingPlan(plan);
                            setShowPlanModal(true);
                          }}
                        >
                          <Text style={[styles.memberPlanSecondaryBtnText, { color: colors.text }]}>
                            Edit
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.memberPlanIconBtn, { borderColor: colors.border }]}
                          onPress={() => handleDeleteSavedPlan(plan)}
                        >
                          <Feather name="trash-2" size={14} color={colors.destructive} />
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}

            <Pressable
              style={[
                styles.aiWorkoutCard,
                {
                  backgroundColor: colors.primaryMuted,
                  borderColor: colors.primary + "50",
                },
              ]}
              onPress={handleAIWorkout}
              disabled={loadingAI}
            >
              <View style={styles.aiWorkoutInner}>
                <View style={[styles.aiWorkoutIcon, { backgroundColor: colors.primary }]}>
                  {loadingAI ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Feather name="cpu" size={20} color="#fff" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.aiWorkoutTitle, { color: colors.text }]}>
                    AI Workout Generator
                  </Text>
                  <Text style={[styles.aiWorkoutSubtitle, { color: colors.mutedForeground }]}>
                    {aiCoachSubtitle}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.primary} />
              </View>
            </Pressable>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Start Templates</Text>
            <View style={styles.templateGrid}>
              {QUICK_STARTS.map((t) => (
                <Pressable
                  key={t.name}
                  style={[
                    styles.templateCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => handleQuickStart(t)}
                >
                  <Text style={[styles.templateName, { color: colors.text }]}>{t.name}</Text>
                  <Text style={[styles.templateCount, { color: colors.mutedForeground }]}>
                    {t.exercises.length} exercises
                  </Text>
                </Pressable>
              ))}
            </View>

            {recentSessions.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>History</Text>
                {recentSessions.map((s) => (
                  <View
                    key={s.id}
                    style={[
                      styles.sessionCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.sessionHeader}>
                      <Text style={[styles.sessionName, { color: colors.text }]}>{s.name}</Text>
                      <Text style={[styles.sessionDate, { color: colors.mutedForeground }]}>
                        {s.date}
                      </Text>
                    </View>
                    <View style={styles.sessionStats}>
                      <Text style={[styles.sessionStat, { color: colors.mutedForeground }]}>
                        <Text style={{ color: colors.text, fontWeight: "600" }}>{s.duration}</Text>{" "}
                        min
                      </Text>
                      <Text style={[styles.sessionStat, { color: colors.mutedForeground }]}>
                        <Text style={{ color: colors.text, fontWeight: "600" }}>
                          {s.exercises.length}
                        </Text>{" "}
                        exercises
                      </Text>
                      <Text style={[styles.sessionStat, { color: colors.mutedForeground }]}>
                        <Text style={{ color: colors.text, fontWeight: "600" }}>
                          {s.totalVolume.toLocaleString()}
                        </Text>{" "}
                        kg vol
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {recentSessions.length === 0 && !loadingAssigned && (
              <View style={styles.empty}>
                <Feather name="activity" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No workouts yet. Start your first session!
                </Text>
              </View>
            )}
          </>
        )}

        {activeTab === "exercises" && (
          <View>
            <View
              style={[
                styles.searchBar,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search exercises..."
                placeholderTextColor={colors.mutedForeground}
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
              {exerciseSearch.length > 0 && (
                <Pressable onPress={() => setExerciseSearch("")}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipContainer}
            >
              {MUSCLE_FILTER_CHIPS.map((chip) => (
                <Pressable
                  key={chip}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedMuscle === chip ? colors.primary : colors.card,
                      borderColor: selectedMuscle === chip ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedMuscle(chip)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: selectedMuscle === chip ? "#fff" : colors.mutedForeground,
                      },
                    ]}
                  >
                    {chip}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {filteredExercises.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="search" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No exercises found. Try a different search or filter.
                </Text>
              </View>
            ) : (
              <View style={styles.exerciseList}>
                {filteredExercises.map((ex) => (
                  <View
                    key={ex.id}
                    style={[styles.exerciseItem, { borderBottomColor: colors.border }]}
                  >
                    <View style={[styles.exCategory, { backgroundColor: colors.primary + "20" }]}>
                      <Text style={[styles.exCategoryText, { color: colors.primary }]}>
                        {ex.muscleGroup[0]}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.exName, { color: colors.text }]}>{ex.name}</Text>
                      <Text style={[styles.exMeta, { color: colors.mutedForeground }]}>
                        {ex.muscleGroup} · {ex.equipment} · {ex.defaultSets}×{ex.defaultReps}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === "records" && (
          <View>
            {prs.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="award" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No personal records yet. Complete workouts to set PRs!
                </Text>
              </View>
            ) : (
              prs.map((pr) => (
                <View
                  key={pr.exerciseId}
                  style={[
                    styles.prCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Feather name="award" size={20} color={colors.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.prName, { color: colors.text }]}>{pr.name}</Text>
                    <Text style={[styles.prDate, { color: colors.mutedForeground }]}>
                      {pr.date}
                    </Text>
                  </View>
                  <Text style={[styles.prValue, { color: colors.primary }]}>
                    {pr.weight}kg × {pr.reps}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "templates" && isTrainerOrOwner && (
          <View>
            <Pressable
              style={[styles.createTemplateBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowCreateTemplate(true)}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.createTemplateBtnText}>Create Template</Text>
            </Pressable>

            {loadingTemplates && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  Loading templates...
                </Text>
              </View>
            )}

            {!loadingTemplates && templates.length === 0 && (
              <View style={styles.empty}>
                <Feather name="clipboard" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No templates yet. Create one to assign workouts to members.
                </Text>
              </View>
            )}

            {templates.map((template) => (
              <View
                key={template.id}
                style={[
                  styles.trainerTemplateCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.trainerTemplateHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trainerTemplateName, { color: colors.text }]}>
                      {template.name}
                    </Text>
                    <Text style={[styles.trainerTemplateMeta, { color: colors.mutedForeground }]}>
                      {template.exercises.length} exercises · Created{" "}
                      {new Date(template.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <View style={styles.trainerTemplateExercises}>
                  {template.exercises.slice(0, 3).map((ex, idx) => (
                    <Text
                      key={idx}
                      style={[styles.trainerTemplateExercise, { color: colors.mutedForeground }]}
                    >
                      {ex.name} — {ex.sets}×{ex.reps}
                    </Text>
                  ))}
                  {template.exercises.length > 3 && (
                    <Text
                      style={[styles.trainerTemplateExercise, { color: colors.mutedForeground }]}
                    >
                      +{template.exercises.length - 3} more
                    </Text>
                  )}
                </View>
                <View style={styles.trainerTemplateActions}>
                  <Pressable
                    style={[styles.assignBtn, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      setSelectedTemplate(template);
                      setSelectedMember(null);
                      setMemberSearch("");
                      setShowAssignModal(true);
                      void fetchAssignableMembers();
                    }}
                  >
                    <Feather name="user-plus" size={14} color="#fff" />
                    <Text style={styles.assignBtnText}>Assign to Member</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.deleteTemplateBtn, { borderColor: colors.border }]}
                    onPress={() => handleDeleteTemplate(template.id)}
                  >
                    <Feather name="trash-2" size={14} color={colors.destructive} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {showCreateTemplate && (
        <CreateTemplateModal
          visible={showCreateTemplate}
          onClose={() => setShowCreateTemplate(false)}
          onCreated={(template) => {
            setTemplates((prev) => [...prev, template]);
            setShowCreateTemplate(false);
          }}
          colors={colors}
          trainerName={profile.name}
          getToken={getToken}
        />
      )}

      {showPlanModal && (
        <MemberPlanModal
          visible={showPlanModal}
          initialPlan={editingPlan}
          onClose={() => {
            setShowPlanModal(false);
            setEditingPlan(null);
          }}
          onSaved={handleSaveCustomPlan}
          colors={colors}
        />
      )}

      <Modal
        visible={showAssignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.assignModal,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.assignModalTitle, { color: colors.text }]}>Assign to Member</Text>
            {selectedTemplate && (
              <Text style={[styles.assignModalSubtitle, { color: colors.mutedForeground }]}>
                "{selectedTemplate.name}"
              </Text>
            )}
            <TextInput
              style={[
                styles.assignInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Search members by name or email"
              placeholderTextColor={colors.mutedForeground}
              value={memberSearch}
              onChangeText={setMemberSearch}
              autoCapitalize="none"
            />
            {loadingAssignableMembers ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  Loading members...
                </Text>
              </View>
            ) : filteredAssignableMembers.length === 0 ? (
              <Text style={[styles.assignEmptyText, { color: colors.mutedForeground }]}>
                No members available to assign yet.
              </Text>
            ) : (
              <ScrollView
                style={[styles.assignMemberList, { borderColor: colors.border }]}
                contentContainerStyle={styles.assignMemberListContent}
                keyboardShouldPersistTaps="handled"
              >
                {filteredAssignableMembers.map((member) => {
                  const isSelected = selectedMember?.id === member.id;
                  return (
                    <Pressable
                      key={member.id}
                      style={[
                        styles.assignMemberItem,
                        {
                          backgroundColor: isSelected ? colors.primaryMuted : colors.background,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedMember(member)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.assignMemberName, { color: colors.text }]}>
                          {member.name}
                        </Text>
                        <Text style={[styles.assignMemberEmail, { color: colors.mutedForeground }]}>
                          {member.email || member.id}
                        </Text>
                      </View>
                      {isSelected && <Feather name="check" size={18} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <View style={styles.assignModalActions}>
              <Pressable
                style={[styles.assignModalCancelBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setShowAssignModal(false);
                  setMemberSearch("");
                  setSelectedMember(null);
                  setSelectedTemplate(null);
                }}
              >
                <Text style={[styles.assignModalCancelText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.assignModalConfirmBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: assigningWorkout ? 0.7 : 1,
                  },
                ]}
                onPress={handleAssignWorkout}
                disabled={assigningWorkout || !selectedMember}
              >
                {assigningWorkout ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.assignModalConfirmText}>Assign</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type ColorsType = ReturnType<typeof useColors>;

function CreateTemplateModal({
  visible,
  onClose,
  onCreated,
  colors,
  trainerName,
  getToken,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (template: WorkoutTemplate) => void;
  colors: ColorsType;
  trainerName: string;
  getToken: () => Promise<string | null>;
}) {
  const [templateName, setTemplateName] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<TemplateExercise[]>([]);
  const [saving, setSaving] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const debouncedExerciseSearch = useDebounce(exerciseSearch, 300);
  const [showPicker, setShowPicker] = useState(false);

  const filteredForPicker = useMemo(
    () => searchExercises(debouncedExerciseSearch),
    [debouncedExerciseSearch],
  );

  const addExercise = (exId: string) => {
    const ex = EXERCISES.find((e) => e.id === exId);
    if (!ex) return;
    setSelectedExercises((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        name: ex.name,
        sets: ex.defaultSets,
        reps: parseInt(ex.defaultReps) || 10,
        notes: "",
      },
    ]);
    setShowPicker(false);
    setExerciseSearch("");
  };

  const updateExercise = (idx: number, updates: Partial<TemplateExercise>) => {
    setSelectedExercises((prev) => prev.map((e, i) => (i === idx ? { ...e, ...updates } : e)));
  };

  const removeExercise = (idx: number) => {
    setSelectedExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!templateName.trim() || selectedExercises.length === 0) {
      Alert.alert("Error", "Please add a title and at least one exercise");
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      const resp = await fetch(`${getApiBase()}/api/workouts/templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: templateName.trim(),
          exercises: selectedExercises,
          trainerName,
        }),
      });
      if (resp.ok) {
        const template = await resp.json();
        onCreated(template);
        setTemplateName("");
        setSelectedExercises([]);
      } else {
        const err = await resp.json();
        Alert.alert("Error", err.error || "Failed to create template");
      }
    } catch {
      Alert.alert("Error", "Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[{ flex: 1, backgroundColor: colors.background }]}>
        <View style={[createStyles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose}>
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>
          <Text style={[createStyles.headerTitle, { color: colors.text }]}>Create Template</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={[createStyles.saveBtn, { color: colors.primary }]}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={createStyles.scroll}>
          <Text style={[createStyles.label, { color: colors.text }]}>Workout Title</Text>
          <TextInput
            style={[
              createStyles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="e.g. Upper Body Strength"
            placeholderTextColor={colors.mutedForeground}
            value={templateName}
            onChangeText={setTemplateName}
          />

          <Text style={[createStyles.label, { color: colors.text }]}>Exercises</Text>

          {selectedExercises.map((ex, idx) => (
            <View
              key={idx}
              style={[
                createStyles.exCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={createStyles.exCardHeader}>
                <Text style={[createStyles.exCardName, { color: colors.text }]}>{ex.name}</Text>
                <Pressable onPress={() => removeExercise(idx)}>
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </Pressable>
              </View>
              <View style={createStyles.exCardRow}>
                <View style={createStyles.exCardField}>
                  <Text style={[createStyles.exCardFieldLabel, { color: colors.mutedForeground }]}>
                    Sets
                  </Text>
                  <TextInput
                    style={[
                      createStyles.exCardFieldInput,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    keyboardType="number-pad"
                    value={ex.sets.toString()}
                    onChangeText={(v) => updateExercise(idx, { sets: parseInt(v) || 1 })}
                  />
                </View>
                <View style={createStyles.exCardField}>
                  <Text style={[createStyles.exCardFieldLabel, { color: colors.mutedForeground }]}>
                    Reps
                  </Text>
                  <TextInput
                    style={[
                      createStyles.exCardFieldInput,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    keyboardType="number-pad"
                    value={ex.reps.toString()}
                    onChangeText={(v) => updateExercise(idx, { reps: parseInt(v) || 1 })}
                  />
                </View>
              </View>
              <TextInput
                style={[
                  createStyles.notesInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Coaching notes (optional)"
                placeholderTextColor={colors.mutedForeground}
                value={ex.notes || ""}
                onChangeText={(v) => updateExercise(idx, { notes: v })}
                multiline
              />
            </View>
          ))}

          <Pressable
            style={[createStyles.addExBtn, { borderColor: colors.primary }]}
            onPress={() => setShowPicker(true)}
          >
            <Feather name="plus" size={16} color={colors.primary} />
            <Text style={[createStyles.addExBtnText, { color: colors.primary }]}>Add Exercise</Text>
          </Pressable>

          {showPicker && (
            <View
              style={[
                createStyles.picker,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <TextInput
                style={[
                  createStyles.pickerSearch,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Search exercises..."
                placeholderTextColor={colors.mutedForeground}
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
                autoFocus
              />
              <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
                {filteredForPicker.slice(0, 30).map((ex) => (
                  <Pressable
                    key={ex.id}
                    style={[createStyles.pickerItem, { borderBottomColor: colors.border }]}
                    onPress={() => addExercise(ex.id)}
                  >
                    <Text style={[createStyles.pickerItemName, { color: colors.text }]}>
                      {ex.name}
                    </Text>
                    <Text style={[createStyles.pickerItemMeta, { color: colors.mutedForeground }]}>
                      {ex.muscleGroup}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable onPress={() => setShowPicker(false)} style={createStyles.pickerCancel}>
                <Text style={[createStyles.pickerCancelText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function MemberPlanModal({
  visible,
  onClose,
  onSaved,
  colors,
  initialPlan,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: (plan: SaveWorkoutPlanInput) => Promise<void>;
  colors: ColorsType;
  initialPlan: SavedWorkoutPlan | null;
}) {
  const [planName, setPlanName] = useState("");
  const [planFocus, setPlanFocus] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<SaveWorkoutPlanInput["exercises"]>([]);
  const [saving, setSaving] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const debouncedExerciseSearch = useDebounce(exerciseSearch, 300);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPlanName(initialPlan?.name ?? "");
    setPlanFocus(initialPlan?.focus ?? "");
    setSelectedExercises(initialPlan?.exercises ?? []);
    setExerciseSearch("");
    setShowPicker(false);
    setSaving(false);
  }, [initialPlan, visible]);

  const filteredForPicker = useMemo(
    () => searchExercises(debouncedExerciseSearch),
    [debouncedExerciseSearch],
  );

  const addExercise = (exerciseId: string) => {
    const exercise = EXERCISES.find((item) => item.id === exerciseId);
    if (!exercise) return;

    setSelectedExercises((prev) => [
      ...prev,
      {
        exerciseId: exercise.id,
        name: exercise.name,
        sets: exercise.defaultSets,
        reps: parseInt(exercise.defaultReps, 10) || 10,
        notes: "",
      },
    ]);
    setShowPicker(false);
    setExerciseSearch("");
  };

  const updateExercise = (
    idx: number,
    updates: Partial<SaveWorkoutPlanInput["exercises"][number]>,
  ) => {
    setSelectedExercises((prev) =>
      prev.map((exercise, index) => (index === idx ? { ...exercise, ...updates } : exercise)),
    );
  };

  const removeExercise = (idx: number) => {
    setSelectedExercises((prev) => prev.filter((_, index) => index !== idx));
  };

  const handleSave = async () => {
    if (!planName.trim() || selectedExercises.length === 0) {
      Alert.alert("Error", "Please add a title and at least one exercise");
      return;
    }

    setSaving(true);
    try {
      await onSaved({
        id: initialPlan?.id,
        name: planName.trim(),
        focus: planFocus.trim(),
        exercises: selectedExercises,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[{ flex: 1, backgroundColor: colors.background }]}>
        <View style={[createStyles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose}>
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>
          <Text style={[createStyles.headerTitle, { color: colors.text }]}>
            {initialPlan ? "Edit Plan" : "Save Custom Plan"}
          </Text>
          <Pressable onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={[createStyles.saveBtn, { color: colors.primary }]}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={createStyles.scroll}>
          <Text style={[createStyles.label, { color: colors.text }]}>Plan Title</Text>
          <TextInput
            style={[
              createStyles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="e.g. Busy Day Full Body"
            placeholderTextColor={colors.mutedForeground}
            value={planName}
            onChangeText={setPlanName}
          />

          <Text style={[createStyles.label, { color: colors.text }]}>Focus</Text>
          <TextInput
            style={[
              createStyles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="e.g. Push / Lower / Recovery"
            placeholderTextColor={colors.mutedForeground}
            value={planFocus}
            onChangeText={setPlanFocus}
          />

          <Text style={[createStyles.label, { color: colors.text }]}>Exercises</Text>

          {selectedExercises.map((exercise, idx) => (
            <View
              key={`${exercise.exerciseId}-${idx}`}
              style={[
                createStyles.exCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={createStyles.exCardHeader}>
                <Text style={[createStyles.exCardName, { color: colors.text }]}>
                  {exercise.name}
                </Text>
                <Pressable onPress={() => removeExercise(idx)}>
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </Pressable>
              </View>

              <View style={createStyles.exCardRow}>
                <View style={createStyles.exCardField}>
                  <Text style={[createStyles.exCardFieldLabel, { color: colors.mutedForeground }]}>
                    Sets
                  </Text>
                  <TextInput
                    style={[
                      createStyles.exCardFieldInput,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    keyboardType="number-pad"
                    value={exercise.sets.toString()}
                    onChangeText={(value) =>
                      updateExercise(idx, { sets: parseInt(value, 10) || 1 })
                    }
                  />
                </View>
                <View style={createStyles.exCardField}>
                  <Text style={[createStyles.exCardFieldLabel, { color: colors.mutedForeground }]}>
                    Reps
                  </Text>
                  <TextInput
                    style={[
                      createStyles.exCardFieldInput,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    keyboardType="number-pad"
                    value={exercise.reps.toString()}
                    onChangeText={(value) =>
                      updateExercise(idx, { reps: parseInt(value, 10) || 1 })
                    }
                  />
                </View>
              </View>

              <TextInput
                style={[
                  createStyles.notesInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Notes for this exercise (optional)"
                placeholderTextColor={colors.mutedForeground}
                value={exercise.notes || ""}
                onChangeText={(value) => updateExercise(idx, { notes: value })}
                multiline
              />
            </View>
          ))}

          <Pressable
            style={[createStyles.addExBtn, { borderColor: colors.primary }]}
            onPress={() => setShowPicker(true)}
          >
            <Feather name="plus" size={16} color={colors.primary} />
            <Text style={[createStyles.addExBtnText, { color: colors.primary }]}>Add Exercise</Text>
          </Pressable>

          {showPicker && (
            <View
              style={[
                createStyles.picker,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <TextInput
                style={[
                  createStyles.pickerSearch,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Search exercises..."
                placeholderTextColor={colors.mutedForeground}
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
                autoFocus
              />
              <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
                {filteredForPicker.slice(0, 30).map((exercise) => (
                  <Pressable
                    key={exercise.id}
                    style={[createStyles.pickerItem, { borderBottomColor: colors.border }]}
                    onPress={() => addExercise(exercise.id)}
                  >
                    <Text style={[createStyles.pickerItemName, { color: colors.text }]}>
                      {exercise.name}
                    </Text>
                    <Text style={[createStyles.pickerItemMeta, { color: colors.mutedForeground }]}>
                      {exercise.muscleGroup}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable onPress={() => setShowPicker(false)} style={createStyles.pickerCancel}>
                <Text style={[createStyles.pickerCancelText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingBottom: 8,
  },
  screenTitle: { fontSize: 28, fontWeight: "800" },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  startBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  weekStats: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 4,
  },
  weekStatCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  weekStatVal: { fontSize: 24, fontWeight: "700" },
  weekStatLabel: { fontSize: 11, marginTop: 2 },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    marginHorizontal: 16,
    marginBottom: 8,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center" },
  tabText: { fontSize: 13, fontWeight: "600" },
  scroll: { paddingHorizontal: 16, gap: 12 },
  aiWorkoutCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  aiWorkoutInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  aiWorkoutIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  aiWorkoutTitle: { fontSize: 16, fontWeight: "700" },
  aiWorkoutSubtitle: { fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 4 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionHelperText: { fontSize: 13, lineHeight: 19, marginTop: -4 },
  planHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  planHeaderBtnText: { fontSize: 13, fontWeight: "700" },
  memberPlanEmptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  memberPlanEmptyTitle: { fontSize: 15, fontWeight: "700" },
  memberPlanEmptyBody: { fontSize: 13, lineHeight: 19 },
  memberPlanCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  memberPlanHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  memberPlanName: { fontSize: 16, fontWeight: "700" },
  memberPlanMeta: { fontSize: 13, marginTop: 3 },
  memberPlanPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  memberPlanPillText: { fontSize: 11, fontWeight: "700" },
  memberPlanExercisePreview: { fontSize: 13, lineHeight: 19 },
  memberPlanActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  memberPlanPrimaryBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  memberPlanPrimaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  memberPlanSecondaryBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  memberPlanSecondaryBtnText: { fontSize: 13, fontWeight: "700" },
  memberPlanIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  templateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  templateCard: { width: "47%", borderRadius: 12, padding: 14, borderWidth: 1 },
  templateName: { fontSize: 14, fontWeight: "600" },
  templateCount: { fontSize: 12, marginTop: 4 },
  sessionCard: { borderRadius: 12, padding: 14, borderWidth: 1 },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sessionName: { fontSize: 15, fontWeight: "600" },
  sessionDate: { fontSize: 12 },
  sessionStats: { flexDirection: "row", gap: 16 },
  sessionStat: { fontSize: 13 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  chipScroll: { marginBottom: 10 },
  chipContainer: { flexDirection: "row", gap: 8, paddingRight: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  exerciseList: {},
  exerciseItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  exCategory: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  exCategoryText: { fontSize: 14, fontWeight: "700" },
  exName: { fontSize: 15, fontWeight: "500" },
  exMeta: { fontSize: 12, marginTop: 2 },
  prCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  prName: { fontSize: 15, fontWeight: "600" },
  prDate: { fontSize: 12 },
  prValue: { fontSize: 16, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 30,
    lineHeight: 22,
  },
  assignedCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  assignedCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  assignedIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  assignedTitle: { fontSize: 16, fontWeight: "700" },
  assignedMeta: { fontSize: 13, marginTop: 2 },
  assignedCompleted: { fontSize: 12, marginTop: 4, fontWeight: "600" },
  startAssignedBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  startAssignedBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: { fontSize: 14 },
  createTemplateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    padding: 14,
    justifyContent: "center",
  },
  createTemplateBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  trainerTemplateCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  trainerTemplateHeader: { flexDirection: "row", alignItems: "flex-start" },
  trainerTemplateName: { fontSize: 16, fontWeight: "700" },
  trainerTemplateMeta: { fontSize: 12, marginTop: 4 },
  trainerTemplateExercises: { gap: 2 },
  trainerTemplateExercise: { fontSize: 13 },
  trainerTemplateActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  assignBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
  },
  assignBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  deleteTemplateBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#00000080",
    justifyContent: "flex-end",
  },
  assignModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  assignModalTitle: { fontSize: 20, fontWeight: "800" },
  assignModalSubtitle: { fontSize: 14, marginTop: -8 },
  assignInput: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15 },
  assignMemberList: { maxHeight: 280, borderWidth: 1, borderRadius: 14 },
  assignMemberListContent: { padding: 10, gap: 8 },
  assignMemberItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  assignMemberName: { fontSize: 15, fontWeight: "700" },
  assignMemberEmail: { fontSize: 12, marginTop: 2 },
  assignEmptyText: { fontSize: 14, lineHeight: 20 },
  assignModalActions: { flexDirection: "row", gap: 10 },
  assignModalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  assignModalCancelText: { fontSize: 15, fontWeight: "600" },
  assignModalConfirmBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  assignModalConfirmText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

const createStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  saveBtn: { fontSize: 16, fontWeight: "700" },
  scroll: { padding: 16, gap: 12 },
  label: { fontSize: 15, fontWeight: "600", marginBottom: -4 },
  input: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15 },
  exCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  exCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  exCardName: { fontSize: 15, fontWeight: "600", flex: 1 },
  exCardRow: { flexDirection: "row", gap: 12 },
  exCardField: { flex: 1, gap: 4 },
  exCardFieldLabel: { fontSize: 12 },
  exCardFieldInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    fontSize: 15,
    textAlign: "center",
  },
  notesInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    minHeight: 60,
  },
  addExBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 14,
  },
  addExBtnText: { fontSize: 15, fontWeight: "600" },
  picker: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  pickerSearch: { borderBottomWidth: 1, padding: 12, fontSize: 14 },
  pickerItem: { padding: 14, borderBottomWidth: 1 },
  pickerItemName: { fontSize: 14, fontWeight: "500" },
  pickerItemMeta: { fontSize: 12, marginTop: 2 },
  pickerCancel: { padding: 14, alignItems: "center" },
  pickerCancelText: { fontSize: 14, fontWeight: "600" },
});
