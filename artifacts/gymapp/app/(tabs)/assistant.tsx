import { useAuth, useUser } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "@/components/native-compat";
import { useColors } from "@/hooks/useColors";
import { useTypography } from "@/hooks/useTypography";
import { useApp } from "@/contexts/AppContext";
import { useNutrition } from "@/contexts/NutritionContext";
import { useWorkout } from "@/contexts/WorkoutContext";
import { getApiBase } from "@/lib/api-base";
import { impact, notifyWarning } from "@/lib/haptics";

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 80;
const CHAT_STORAGE_KEY = "@gymapp_chat_history";
const MAX_PERSISTED_MESSAGES = 50;
const SAFFRON = "#FF6B00";
const USE_NATIVE_DRIVER = Platform.OS !== "web";

type MessageRole = "user" | "assistant";

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: `Namaste! I'm your AI fitness coach powered by Gemini. I specialize in Indian nutrition, workout planning, and holistic wellness.\n\nYou can ask me about:\n• Indian meal nutrition & recipes\n• Workout plans & exercise form\n• Calorie & macro guidance\n• Weight management tips\n• Yoga & wellness advice\n\nHow can I help you today?`,
  timestamp: 0,
};

type CoachMode = "nutrition" | "training" | "recovery";

const COACH_MODES: Array<{
  id: CoachMode;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}> = [
  { id: "nutrition", label: "Nutrition", icon: "pie-chart" },
  { id: "training", label: "Training", icon: "activity" },
  { id: "recovery", label: "Recovery", icon: "moon" },
];

const QUICK_PROMPTS: Record<CoachMode, string[]> = {
  nutrition: [
    "What should I eat post-workout today?",
    "Create a 5-day Indian meal plan for muscle gain",
    "How many calories in 2 rotis with dal?",
    "Is paneer good for weight loss?",
  ],
  training: [
    "Give me a 30-minute home workout",
    "Turn my saved plan into a push day",
    "What should I train if my legs are sore?",
    "Create a beginner-friendly gym session for today",
  ],
  recovery: [
    "Build a 10-minute mobility routine",
    "How should I adjust after poor sleep?",
    "What should I do on a rest day?",
    "Explain safe warmups for shoulder tightness",
  ],
};

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function getScopedStorageKey(baseKey: string, userId?: string | null) {
  return userId ? `${baseKey}:${userId}` : baseKey;
}

function formatTimestamp(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m} ${ampm}`;
}

function TypingDots({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const makePulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.delay(600),
        ]),
      );

    const a1 = makePulse(dot1, 0);
    const a2 = makePulse(dot2, 200);
    const a3 = makePulse(dot3, 400);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, []);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4 }}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: dot }}
        />
      ))}
    </View>
  );
}

function PulsingStatusDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.5, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        transform: [{ scale }],
      }}
    />
  );
}

export default function AssistantScreen() {
  const { getToken, userId, isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { profile } = useApp();
  const { todayLog } = useNutrition();
  const { sessions, behaviorProfile, savedPlans } = useWorkout();
  const router = useRouter();
  const colors = useColors();
  const typography = useTypography();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [activeMode, setActiveMode] = useState<CoachMode>("nutrition");
  const storageKey = getScopedStorageKey(CHAT_STORAGE_KEY, userId);

  useEffect(() => {
    if (!authLoaded) {
      return;
    }

    const loadHistory = async () => {
      try {
        if (isSignedIn && userId) {
          const token = await getToken();
          if (token) {
            const response = await fetch(`${getApiBase()}/api/ai/history`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (response.ok) {
              const payload = (await response.json()) as {
                messages?: Array<{ role?: MessageRole; content?: string; timestamp?: string }>;
              };
              const serverMessages = Array.isArray(payload.messages)
                ? payload.messages
                    .map((message) => {
                      if (
                        (message.role !== "user" && message.role !== "assistant") ||
                        typeof message.content !== "string"
                      ) {
                        return null;
                      }

                      return {
                        id: generateId(),
                        role: message.role,
                        content: message.content,
                        timestamp: message.timestamp
                          ? new Date(message.timestamp).getTime()
                          : Date.now(),
                      } satisfies Message;
                    })
                    .filter((message): message is Message => Boolean(message))
                : [];

              if (serverMessages.length > 0) {
                setMessages([WELCOME_MESSAGE, ...serverMessages]);
                await AsyncStorage.setItem(storageKey, JSON.stringify(serverMessages));
                return;
              }
            }
          }
        }

        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const parsed: Message[] = JSON.parse(stored);
          if (parsed.length > 0) {
            setMessages([WELCOME_MESSAGE, ...parsed]);
          }
        }
      } catch {
        // silently keep default welcome message
      } finally {
        setHistoryLoaded(true);
      }
    };
    void loadHistory();
  }, [authLoaded, getToken, isSignedIn, storageKey, userId]);

  const persistMessages = useCallback(
    async (msgs: Message[]) => {
      try {
        const userAndAssistant = msgs.filter((m) => m.id !== "welcome");
        const trimmed = userAndAssistant.slice(-MAX_PERSISTED_MESSAGES);
        await AsyncStorage.setItem(storageKey, JSON.stringify(trimmed));
      } catch {
        // non-critical: storage write failure doesn't break chat
      }
    },
    [storageKey],
  );

  const todayCalories = todayLog.entries.reduce((sum, e) => sum + e.calories, 0);
  const recentWorkouts = sessions.slice(0, 3).map((s) => ({ name: s.name, date: s.date }));
  const savedPlanSummaries = savedPlans.slice(0, 4).map((plan) => ({
    name: plan.name,
    focus: plan.focus,
    exerciseCount: plan.exercises.length,
    exercises: plan.exercises.slice(0, 5).map((exercise) => exercise.name),
  }));

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      impact();

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: text.trim(),
        timestamp: Date.now(),
      };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInputText("");
      setIsLoading(true);

      const assistantId = generateId();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: Date.now() },
      ]);

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Authentication required");
        }

        const chatHistory = updatedMessages
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));
        const userProfile = {
          name: profile.name,
          goal: profile.fitnessGoal,
          diet: profile.dietType,
          weight: profile.weight,
          height: profile.height,
          fitnessExperience: profile.fitnessExperience,
          equipment: profile.equipment,
          injuries: profile.injuries,
          workoutTime: profile.workoutTime,
          mealTiming: profile.mealTiming,
          gymName: profile.gymName,
          role: profile.role,
        };
        const todayStats = {
          calories: todayCalories,
          target: profile.dailyCalorieTarget,
          recentWorkouts,
          behaviorProfile,
          savedPlans: savedPlanSummaries,
        };

        const response = await fetch(`${getApiBase()}/api/ai/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: chatHistory,
            userProfile,
            todayStats,
            behaviorProfile,
            savedPlans: savedPlanSummaries,
          }),
        });

        if (!response.ok) throw new Error("Failed to get response");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No stream available");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data) as { text?: string };
                if (parsed.text) {
                  accumulated += parsed.text;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
                  );
                }
              } catch {
                // skip malformed SSE chunk
              }
            }
          }
        }

        const finalContent =
          accumulated || "I apologize, I couldn't generate a response. Please try again.";
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === assistantId ? { ...m, content: finalContent } : m,
          );
          persistMessages(updated);
          return updated;
        });
      } catch {
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    "Sorry, I'm having trouble connecting right now. Please check your internet connection and try again.",
                }
              : m,
          );
          persistMessages(updated);
          return updated;
        });
      } finally {
        setIsLoading(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    [
      messages,
      isLoading,
      profile,
      todayCalories,
      recentWorkouts,
      persistMessages,
      getToken,
      behaviorProfile,
      savedPlans,
    ],
  );

  const handleClearHistory = useCallback(() => {
    const clear = async () => {
      setMessages([WELCOME_MESSAGE]);
      try {
        if (isSignedIn && userId) {
          const token = await getToken();
          if (token) {
            await fetch(`${getApiBase()}/api/ai/history`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
          }
        }
      } finally {
        await AsyncStorage.removeItem(storageKey);
        notifyWarning();
      }
    };

    impact();
    Alert.alert("Clear AI history?", "This removes local chat history and any synced messages.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          void clear();
        },
      },
    ]);
  }, [getToken, isSignedIn, storageKey, userId]);

  const handleQuickPrompt = useCallback(
    (prompt: string) => {
      impact();
      void sendMessage(prompt);
    },
    [sendMessage],
  );

  const handleModeChange = useCallback((mode: CoachMode) => {
    impact();
    setActiveMode(mode);
  }, []);

  const openProfile = useCallback(() => {
    impact();
    router.push("/profile");
  }, [router]);

  const trustedContextItems = [
    { label: "Goal", value: profile.fitnessGoal.replace("_", " ") },
    { label: "Diet", value: profile.dietType.replace("_", " ") },
    { label: "Recent workouts", value: String(behaviorProfile.completedSessionsLast30Days) },
    { label: "Saved plans", value: String(savedPlans.length) },
    { label: "Injury notes", value: String(profile.injuries.length) },
    { label: "Today", value: `${todayCalories}/${profile.dailyCalorieTarget} cal` },
  ];

  const handleMessageContentSizeChange = useCallback(() => {
    if (messages.length > 1) {
      flatListRef.current?.scrollToEnd({ animated: false });
    }
  }, [messages.length]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    const isStreaming = isLoading && item.content === "" && item.role === "assistant";
    const tsLabel = item.timestamp ? formatTimestamp(item.timestamp) : null;

    return (
      <View style={[styles.messageWrapper, isUser && styles.userWrapper]}>
        {!isUser && (
          <View
            style={[styles.avatar, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Feather name="cpu" size={14} color={colors.primary} />
          </View>
        )}
        <View style={styles.bubbleCol}>
          <View
            style={[
              styles.bubble,
              isUser
                ? [styles.userBubble, { backgroundColor: SAFFRON }]
                : [styles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border }],
            ]}
          >
            {isStreaming ? (
              <TypingDots color={colors.mutedForeground} />
            ) : (
              <Text style={[styles.bubbleText, { color: isUser ? "#fff" : colors.text }]}>
                {item.content}
              </Text>
            )}
          </View>
          {tsLabel ? (
            <Text
              style={[
                styles.timestamp,
                { color: colors.mutedForeground },
                isUser && styles.tsRight,
              ]}
            >
              {tsLabel}
            </Text>
          ) : null}
        </View>
        {isUser && (
          <View
            style={[
              styles.avatar,
              { backgroundColor: SAFFRON + "22", borderColor: SAFFRON + "44" },
            ]}
          >
            <Feather name="user" size={14} color={SAFFRON} />
          </View>
        )}
      </View>
    );
  };

  if (!historyLoaded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <View style={[styles.topBar, styles.webFrame, { borderBottomColor: colors.border }]}>
        <View style={[styles.botAvatar, { backgroundColor: colors.primary }]}>
          <Feather name="cpu" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.botName, typography.cardTitle, { color: colors.text }]}>
            GymOS AI Coach
          </Text>
          <View style={styles.statusRow}>
            <PulsingStatusDot color={isLoading ? SAFFRON : colors.success} />
            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
              {isLoading ? "Thinking..." : "Powered by Gemini"}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={handleClearHistory}
          style={[styles.clearBtn, { borderColor: colors.border }]}
        >
          <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={TAB_BAR_HEIGHT}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.messageList, styles.webFrame, { paddingBottom: 16 }]}
          onContentSizeChange={handleMessageContentSizeChange}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            messages.length <= 1 ? (
              <View style={styles.quickPromptsContainer}>
                <View
                  style={[
                    styles.trustPanel,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.trustPanelHeader}>
                    <View style={[styles.trustPanelIcon, { backgroundColor: colors.primaryMuted }]}>
                      <Feather name="shield" size={16} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.trustPanelTitle, { color: colors.text }]}>
                        Advisory AI, bounded by your profile
                      </Text>
                      <Text style={[styles.trustPanelBody, { color: colors.mutedForeground }]}>
                        Gemini receives goals, recent logs, saved plans, and injury notes. It does
                        not make automatic changes.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.trustChipGrid}>
                    {trustedContextItems.map((item) => (
                      <View
                        key={item.label}
                        style={[styles.trustChip, { backgroundColor: colors.surface }]}
                      >
                        <Text style={[styles.trustChipLabel, { color: colors.mutedForeground }]}>
                          {item.label}
                        </Text>
                        <Text
                          style={[styles.trustChipValue, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {item.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Pressable
                    style={[styles.reviewProfileBtn, { borderColor: colors.border }]}
                    onPress={openProfile}
                  >
                    <Feather name="edit-2" size={13} color={colors.primary} />
                    <Text style={[styles.reviewProfileText, { color: colors.text }]}>
                      Review source profile
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.modeRow}>
                  {COACH_MODES.map((mode) => {
                    const selected = activeMode === mode.id;
                    return (
                      <Pressable
                        key={mode.id}
                        style={[
                          styles.modeChip,
                          {
                            backgroundColor: selected ? colors.primary : colors.card,
                            borderColor: selected ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => handleModeChange(mode.id)}
                      >
                        <Feather
                          name={mode.icon}
                          size={13}
                          color={selected ? "#fff" : colors.primary}
                        />
                        <Text
                          style={[styles.modeChipText, { color: selected ? "#fff" : colors.text }]}
                        >
                          {mode.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.quickPromptsTitle, { color: colors.mutedForeground }]}>
                  Quick questions
                </Text>
                <View style={styles.quickPrompts}>
                  {QUICK_PROMPTS[activeMode].map((p) => (
                    <Pressable
                      key={p}
                      style={[
                        styles.quickPrompt,
                        { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                      onPress={() => handleQuickPrompt(p)}
                    >
                      <Text style={[styles.quickPromptText, { color: colors.text }]}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
        />

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: TAB_BAR_HEIGHT + 4,
            },
          ]}
        >
          <View
            style={[
              styles.inputRow,
              styles.webFrame,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Ask your AI coach anything..."
              placeholderTextColor={colors.mutedForeground}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              onSubmitEditing={() => sendMessage(inputText)}
            />
            <Pressable
              style={[
                styles.sendBtn,
                { backgroundColor: inputText.trim() && !isLoading ? SAFFRON : colors.muted },
              ]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="send" size={16} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webFrame: {
    width: "100%",
    maxWidth: 980,
    alignSelf: "center",
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  botAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  botName: { fontSize: 16, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  statusText: { fontSize: 12 },
  clearBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messageList: { paddingHorizontal: 16, gap: 12, paddingTop: 12 },
  messageWrapper: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  userWrapper: { justifyContent: "flex-end" },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderWidth: 1,
  },
  bubbleCol: { maxWidth: "75%", gap: 3 },
  bubble: { borderRadius: 18, padding: 13 },
  userBubble: { borderBottomRightRadius: 4 },
  aiBubble: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  timestamp: { fontSize: 11, paddingHorizontal: 4 },
  tsRight: { textAlign: "right" },
  quickPromptsContainer: { paddingBottom: 16, gap: 10 },
  trustPanel: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  trustPanelHeader: {
    flexDirection: "row",
    gap: 11,
    alignItems: "flex-start",
  },
  trustPanelIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  trustPanelTitle: { fontSize: 15, fontWeight: "800" },
  trustPanelBody: { marginTop: 4, fontSize: 12, lineHeight: 17 },
  trustChipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  trustChip: {
    minWidth: 112,
    flexGrow: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  trustChipLabel: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  trustChipValue: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  reviewProfileBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  reviewProfileText: { fontSize: 12, fontWeight: "800" },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  modeChipText: { fontSize: 13, fontWeight: "800" },
  quickPromptsTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
    marginBottom: 4,
  },
  quickPrompts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickPrompt: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  quickPromptText: { fontSize: 13 },
  inputContainer: { borderTopWidth: 1, padding: 12 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    paddingLeft: 14,
  },
  input: { flex: 1, fontSize: 15, maxHeight: 100, paddingVertical: 4 },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
