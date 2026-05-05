# Coach Transformation V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the isolated v2 Fitness Hub worktree so members get a behavior-aware AI coach and can create/save personal workout plans without changing the main app or making the workout UX confusing.

**Architecture:** First sync the isolated worktree to the latest workout assignment baseline from the source workspace so the branch inherits the current ID-based assignment contract. Then keep member-owned features local to the Expo app by extending `WorkoutContext` with saved plans and a compact behavior profile, wire those signals into the assistant and AI workout suggestion request, and surface `My Plans` inside the existing workout tab rather than creating new navigation.

**Tech Stack:** Expo React Native, Clerk Expo auth, Express routes, Gemini integration, AsyncStorage, existing workout/session context.

---

### Task 1: Sync the isolated worktree to the latest workout baseline

**Files:**

- Modify: `artifacts/gymapp/app/(tabs)/workout.tsx`
- Modify: `artifacts/api-server/src/routes/workouts.ts`
- Reference: `/Volumes/RAGHAV2/Projects/Fitness-Hub-AI/artifacts/gymapp/app/(tabs)/workout.tsx`
- Reference: `/Volumes/RAGHAV2/Projects/Fitness-Hub-AI/artifacts/api-server/src/routes/workouts.ts`

- [ ] **Step 1: Verify the current drift between source workspace and isolated worktree**

```bash
diff -u '/Volumes/RAGHAV2/Projects/Fitness-Hub-AI/artifacts/gymapp/app/(tabs)/workout.tsx' 'artifacts/gymapp/app/(tabs)/workout.tsx' | sed -n '1,220p'
diff -u '/Volumes/RAGHAV2/Projects/Fitness-Hub-AI/artifacts/api-server/src/routes/workouts.ts' 'artifacts/api-server/src/routes/workouts.ts' | sed -n '1,260p'
```

Expected: drift shows the isolated worktree still has the older name-based assignment flow while the source workspace has the newer member-ID based flow.

- [ ] **Step 2: Copy the latest source files into the isolated worktree**

```bash
cp '/Volumes/RAGHAV2/Projects/Fitness-Hub-AI/artifacts/gymapp/app/(tabs)/workout.tsx' 'artifacts/gymapp/app/(tabs)/workout.tsx'
cp '/Volumes/RAGHAV2/Projects/Fitness-Hub-AI/artifacts/api-server/src/routes/workouts.ts' 'artifacts/api-server/src/routes/workouts.ts'
```

- [ ] **Step 3: Re-run the drift check**

```bash
diff -u '/Volumes/RAGHAV2/Projects/Fitness-Hub-AI/artifacts/gymapp/app/(tabs)/workout.tsx' 'artifacts/gymapp/app/(tabs)/workout.tsx'
diff -u '/Volumes/RAGHAV2/Projects/Fitness-Hub-AI/artifacts/api-server/src/routes/workouts.ts' 'artifacts/api-server/src/routes/workouts.ts'
```

Expected: no output.

### Task 2: Add member-saved plans and behavior profiling to workout state

**Files:**

- Modify: `artifacts/gymapp/contexts/WorkoutContext.tsx`

- [ ] **Step 1: Add the failing type surface in `WorkoutContext.tsx`**

```ts
export interface SavedWorkoutPlan {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  source: "member";
  exercises: Array<{
    exerciseId: string;
    name: string;
    sets: number;
    reps: number;
    notes?: string;
  }>;
}

export interface WorkoutBehaviorProfile {
  completedSessionsLast7Days: number;
  completedSessionsLast30Days: number;
  daysSinceLastWorkout: number | null;
  averageDurationMinutes: number;
  averageWeeklyVolume: number;
  favoriteExerciseNames: string[];
  preferredWorkoutNames: string[];
  preferredTrainingWindow: "morning" | "afternoon" | "evening" | "night" | "mixed";
  consistencyLabel: "starting" | "building" | "steady" | "locked_in";
  recoveryState: "fresh" | "active" | "drifting";
}

interface WorkoutContextType {
  // existing fields...
  savedPlans: SavedWorkoutPlan[];
  behaviorProfile: WorkoutBehaviorProfile;
  savePlan: (input: {
    id?: string;
    name: string;
    exercises: SavedWorkoutPlan["exercises"];
  }) => Promise<SavedWorkoutPlan>;
  deletePlan: (planId: string) => Promise<void>;
  startPlanSession: (planId: string) => WorkoutSession | null;
}
```

- [ ] **Step 2: Add storage keys and default profile**

```ts
const SESSIONS_STORAGE_KEY = "@gymapp_sessions";
const PRS_STORAGE_KEY = "@gymapp_prs";
const SAVED_PLANS_STORAGE_KEY = "@gymapp_saved_plans";

const DEFAULT_BEHAVIOR_PROFILE: WorkoutBehaviorProfile = {
  completedSessionsLast7Days: 0,
  completedSessionsLast30Days: 0,
  daysSinceLastWorkout: null,
  averageDurationMinutes: 0,
  averageWeeklyVolume: 0,
  favoriteExerciseNames: [],
  preferredWorkoutNames: [],
  preferredTrainingWindow: "mixed",
  consistencyLabel: "starting",
  recoveryState: "fresh",
};
```

- [ ] **Step 3: Load and persist saved plans**

```ts
const [savedPlans, setSavedPlans] = useState<SavedWorkoutPlan[]>([]);

useEffect(() => {
  const load = async () => {
    const [storedSessions, storedPRs, storedPlans] = await Promise.all([
      AsyncStorage.getItem(SESSIONS_STORAGE_KEY),
      AsyncStorage.getItem(PRS_STORAGE_KEY),
      AsyncStorage.getItem(SAVED_PLANS_STORAGE_KEY),
    ]);
    if (storedSessions) setSessions(JSON.parse(storedSessions));
    if (storedPRs) setPersonalRecords(JSON.parse(storedPRs));
    if (storedPlans) setSavedPlans(JSON.parse(storedPlans));
    setIsLoading(false);
  };
  load().catch((e) => {
    console.error("Failed to load workouts", e);
    setIsLoading(false);
  });
}, []);

const persistPlans = useCallback(async (nextPlans: SavedWorkoutPlan[]) => {
  setSavedPlans(nextPlans);
  await AsyncStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify(nextPlans));
}, []);
```

- [ ] **Step 4: Derive a compact behavior profile from completed sessions**

```ts
const behaviorProfile = useMemo<WorkoutBehaviorProfile>(() => {
  const completed = sessions.filter((session) => session.completed);
  if (completed.length === 0) return DEFAULT_BEHAVIOR_PROFILE;

  const now = new Date();
  const last7 = new Date(now);
  last7.setDate(now.getDate() - 7);
  const last30 = new Date(now);
  last30.setDate(now.getDate() - 30);

  const recent7 = completed.filter((session) => new Date(session.date) >= last7);
  const recent30 = completed.filter((session) => new Date(session.date) >= last30);
  const latest = completed[0];
  const latestDate = latest ? new Date(latest.date) : null;
  const daysSinceLastWorkout = latestDate
    ? Math.max(0, Math.floor((now.getTime() - latestDate.getTime()) / 86400000))
    : null;

  const averageDurationMinutes = Math.round(
    completed.reduce((sum, session) => sum + (session.duration ?? 0), 0) / completed.length,
  );
  const averageWeeklyVolume = Math.round(
    recent30.reduce((sum, session) => sum + session.totalVolume, 0) /
      Math.max(1, Math.ceil(30 / 7)),
  );

  const exerciseCounts = new Map<string, number>();
  const workoutCounts = new Map<string, number>();
  const windowCounts = new Map<WorkoutBehaviorProfile["preferredTrainingWindow"], number>([
    ["morning", 0],
    ["afternoon", 0],
    ["evening", 0],
    ["night", 0],
    ["mixed", 0],
  ]);

  for (const session of completed) {
    workoutCounts.set(session.name, (workoutCounts.get(session.name) ?? 0) + 1);
    const hour = new Date(session.startTime).getHours();
    const window =
      hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
    windowCounts.set(window, (windowCounts.get(window) ?? 0) + 1);
    for (const exercise of session.exercises) {
      exerciseCounts.set(exercise.name, (exerciseCounts.get(exercise.name) ?? 0) + 1);
    }
  }

  const favoriteExerciseNames = [...exerciseCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name);
  const preferredWorkoutNames = [...workoutCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const topWindow = [...windowCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "mixed";
  const consistencyLabel =
    recent7.length >= 4
      ? "locked_in"
      : recent7.length >= 3
        ? "steady"
        : recent7.length >= 1
          ? "building"
          : "starting";
  const recoveryState =
    daysSinceLastWorkout === null || daysSinceLastWorkout <= 1
      ? "active"
      : daysSinceLastWorkout <= 4
        ? "fresh"
        : "drifting";

  return {
    completedSessionsLast7Days: recent7.length,
    completedSessionsLast30Days: recent30.length,
    daysSinceLastWorkout,
    averageDurationMinutes,
    averageWeeklyVolume,
    favoriteExerciseNames,
    preferredWorkoutNames,
    preferredTrainingWindow: topWindow,
    consistencyLabel,
    recoveryState,
  };
}, [sessions]);
```

- [ ] **Step 5: Add save/delete/start helpers for personal plans**

```ts
const savePlan = useCallback(
  async (input: { id?: string; name: string; exercises: SavedWorkoutPlan["exercises"] }) => {
    const timestamp = new Date().toISOString();
    const nextPlan: SavedWorkoutPlan = {
      id: input.id ?? generateId(),
      name: input.name.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
      source: "member",
      exercises: input.exercises,
    };

    const nextPlans = input.id
      ? savedPlans.map((plan) =>
          plan.id === input.id ? { ...nextPlan, createdAt: plan.createdAt } : plan,
        )
      : [nextPlan, ...savedPlans];

    await persistPlans(nextPlans);
    return nextPlan;
  },
  [savedPlans, persistPlans],
);

const deletePlan = useCallback(
  async (planId: string) => {
    await persistPlans(savedPlans.filter((plan) => plan.id !== planId));
  },
  [savedPlans, persistPlans],
);

const startPlanSession = useCallback(
  (planId: string) => {
    const plan = savedPlans.find((entry) => entry.id === planId);
    if (!plan) return null;
    return startSession(
      plan.name,
      plan.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        notes: exercise.notes,
        sets: Array.from({ length: exercise.sets }, () => ({
          weight: 0,
          reps: exercise.reps,
          completed: false,
        })),
      })),
    );
  },
  [savedPlans, startSession],
);
```

- [ ] **Step 6: Run a focused typecheck**

```bash
pnpm typecheck
```

Expected: existing baseline type errors may still remain, but no new `WorkoutContext` syntax/type regressions should appear in changed files.

### Task 3: Add My Plans to the member workout experience

**Files:**

- Modify: `artifacts/gymapp/app/(tabs)/workout.tsx`

- [ ] **Step 1: Update the workout screen to consume the new context fields**

```ts
const {
  sessions,
  personalRecords,
  startSession,
  getWeeklyVolume,
  savedPlans,
  behaviorProfile,
  savePlan,
  deletePlan,
  startPlanSession,
} = useWorkout();
```

- [ ] **Step 2: Add member-only plan composer state**

```ts
const [showMyPlanModal, setShowMyPlanModal] = useState(false);
const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
```

- [ ] **Step 3: Add a member-only `My Plans` section above the AI generator**

```tsx
{
  !isTrainerOrOwner && (
    <>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>My Plans</Text>
        <Pressable
          style={[styles.linkActionBtn, { borderColor: colors.border }]}
          onPress={() => {
            setEditingPlanId(null);
            setShowMyPlanModal(true);
          }}
        >
          <Feather name="plus" size={14} color={colors.primary} />
          <Text style={[styles.linkActionText, { color: colors.primary }]}>Create</Text>
        </Pressable>
      </View>

      {savedPlans.length === 0 ? (
        <View
          style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.infoCardTitle, { color: colors.text }]}>Build your own routine</Text>
          <Text style={[styles.infoCardBody, { color: colors.mutedForeground }]}>
            Save your favorite custom split once and start it anytime.
          </Text>
        </View>
      ) : (
        savedPlans.map((plan) => (
          <View
            key={plan.id}
            style={[
              styles.assignedCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.assignedCardHeader}>
              <View style={[styles.assignedIcon, { backgroundColor: colors.primary }]}>
                <Feather name="bookmark" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.assignedTitle, { color: colors.text }]}>{plan.name}</Text>
                <Text style={[styles.assignedMeta, { color: colors.mutedForeground }]}>
                  {plan.exercises.length} exercises · Updated{" "}
                  {new Date(plan.updatedAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
            <View style={styles.inlineActionRow}>
              <Pressable
                style={[styles.startAssignedBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  const session = startPlanSession(plan.id);
                  if (session) {
                    router.push({
                      pathname: "/workout-session",
                      params: { sessionId: session.id },
                    });
                  }
                }}
              >
                <Text style={styles.startAssignedBtnText}>Start Plan</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryActionBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setEditingPlanId(plan.id);
                  setShowMyPlanModal(true);
                }}
              >
                <Text style={[styles.secondaryActionText, { color: colors.text }]}>Edit</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryActionBtn, { borderColor: colors.border }]}
                onPress={() => deletePlan(plan.id)}
              >
                <Text style={[styles.secondaryActionText, { color: colors.destructive }]}>
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </>
  );
}
```

- [ ] **Step 4: Make the AI workout card reflect behavior without adding clutter**

```tsx
<Text style={[styles.aiWorkoutSubtitle, { color: colors.mutedForeground }]}>
  {behaviorProfile.recoveryState === "drifting"
    ? "Comeback session tuned to your recent consistency"
    : `Built around your ${behaviorProfile.preferredTrainingWindow} training pattern and current goals`}
</Text>
```

- [ ] **Step 5: Add a member personal-plan modal by reusing the existing template builder shape**

```tsx
{
  showMyPlanModal && (
    <MemberPlanModal
      visible={showMyPlanModal}
      onClose={() => {
        setShowMyPlanModal(false);
        setEditingPlanId(null);
      }}
      onSave={async (payload) => {
        await savePlan(payload);
        setShowMyPlanModal(false);
        setEditingPlanId(null);
      }}
      colors={colors}
      initialPlan={savedPlans.find((plan) => plan.id === editingPlanId) ?? null}
    />
  );
}
```

- [ ] **Step 6: Keep trainer flow untouched**

```bash
rg -n "api/workouts/members|memberId|assigned/bind|Assign to Member" 'artifacts/gymapp/app/(tabs)/workout.tsx' 'artifacts/api-server/src/routes/workouts.ts'
```

Expected: trainer/member assignment remains ID-based and member personal plans do not call trainer template APIs.

### Task 4: Make the assistant and AI routes behavior-aware

**Files:**

- Modify: `artifacts/gymapp/app/(tabs)/assistant.tsx`
- Modify: `artifacts/api-server/src/routes/ai.ts`

- [ ] **Step 1: Pass the behavior profile and saved plans from the assistant screen**

```ts
const { sessions, behaviorProfile, savedPlans } = useWorkout();

const compactSavedPlans = savedPlans.slice(0, 3).map((plan) => ({
  name: plan.name,
  exerciseNames: plan.exercises.map((exercise) => exercise.name),
}));

body: JSON.stringify({
  messages: chatHistory,
  userProfile,
  todayStats,
  behaviorProfile,
  savedPlans: compactSavedPlans,
}),
```

- [ ] **Step 2: Extend the AI route request shape**

```ts
const { messages, userProfile, todayStats, behaviorProfile, savedPlans } = req.body as {
  messages?: Array<{ role: string; content: string }>;
  userProfile?: Record<string, unknown>;
  todayStats?: Record<string, unknown>;
  behaviorProfile?: Record<string, unknown>;
  savedPlans?: Array<Record<string, unknown>>;
};
```

- [ ] **Step 3: Upgrade the system prompt so the coach adapts instead of sounding generic**

```ts
const systemContext = `You are GymOS AI, a coach-led fitness guide inside a gym app.

Use the member context below to personalize advice:
- User Profile: ${JSON.stringify(userProfile ?? {})}
- Today's Stats: ${JSON.stringify(todayStats ?? {})}
- Behavior Profile: ${JSON.stringify(behaviorProfile ?? {})}
- Saved Plans: ${JSON.stringify(savedPlans ?? [])}

Rules:
- Sound like one consistent coach, not a chatbot.
- Reference behavior patterns only when they improve the advice.
- If consistency is drifting, reduce friction and suggest a simpler next step.
- If the user is steady or locked in, reinforce momentum and progression.
- Keep the answer concise, warm, and specific.
- Prefer Indian food examples where relevant.
`;
```

- [ ] **Step 4: Make AI workout suggestions behavior-aware too**

```ts
const { recentWorkouts, goals, fitnessLevel, availableTime, behaviorProfile, savedPlans } =
  req.body as {
    recentWorkouts?: unknown[];
    goals?: string;
    fitnessLevel?: string;
    availableTime?: number;
    behaviorProfile?: Record<string, unknown>;
    savedPlans?: unknown[];
  };

const prompt = `You are a professional fitness coach.

Use these inputs to create the best next workout:
- Recent Workouts: ${JSON.stringify(recentWorkouts ?? [])}
- Goals: ${goals ?? "general fitness"}
- Fitness Level: ${fitnessLevel ?? "intermediate"}
- Available Time: ${availableTime ?? 45} minutes
- Behavior Profile: ${JSON.stringify(behaviorProfile ?? {})}
- Saved Plans: ${JSON.stringify(savedPlans ?? [])}

Favor the lowest-friction next best workout when consistency is drifting.
Favor progression when consistency is steady.
Return ONLY valid JSON.`;
```

- [ ] **Step 5: Update the workout screen AI call site**

```ts
body: JSON.stringify({
  recentWorkouts: recentData,
  goals: profile.fitnessGoal,
  fitnessLevel: "intermediate",
  availableTime: 45,
  behaviorProfile,
  savedPlans: savedPlans.slice(0, 3).map((plan) => ({
    name: plan.name,
    exerciseNames: plan.exercises.map((exercise) => exercise.name),
  })),
}),
```

### Task 5: Verification and review

**Files:**

- Review: `artifacts/gymapp/contexts/WorkoutContext.tsx`
- Review: `artifacts/gymapp/app/(tabs)/workout.tsx`
- Review: `artifacts/gymapp/app/(tabs)/assistant.tsx`
- Review: `artifacts/api-server/src/routes/ai.ts`
- Review: `artifacts/api-server/src/routes/workouts.ts`

- [ ] **Step 1: Run typecheck**

```bash
pnpm typecheck
```

Expected: report the existing baseline failures separately from any new regressions in touched files.

- [ ] **Step 2: Inspect git diff for scope control**

```bash
git status --short
git diff -- 'artifacts/gymapp/contexts/WorkoutContext.tsx' 'artifacts/gymapp/app/(tabs)/workout.tsx' 'artifacts/gymapp/app/(tabs)/assistant.tsx' 'artifacts/api-server/src/routes/ai.ts' 'artifacts/api-server/src/routes/workouts.ts'
```

Expected: only the isolated-v2 files above plus the plan document changed.

- [ ] **Step 3: Sanity-check key strings**

```bash
rg -n "My Plans|behaviorProfile|savedPlans|drifting|locked_in" 'artifacts/gymapp' 'artifacts/api-server/src/routes/ai.ts'
```

Expected: all new coach/personal-plan behavior is discoverable in the changed files.
