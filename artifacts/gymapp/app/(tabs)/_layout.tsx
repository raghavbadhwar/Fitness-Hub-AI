import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "@/components/native-compat";
import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const tabBarStyle = {
    position: "absolute",
    backgroundColor: isIOS ? "transparent" : colors.tabBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    elevation: 0,
    height: isWeb ? 84 : 80,
  } as any;
  const tabBarLabelStyle = {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  } as any;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        headerShown: false,
        tabBarStyle,
        tabBarLabelStyle,
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBackground }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: "Nutrition",
          tabBarIcon: ({ color }) => <Feather name="coffee" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: "Workout",
          tabBarIcon: ({ color }) => <Feather name="activity" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color }) => <Feather name="calendar" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "AI Coach",
          tabBarIcon: ({ color }) => <Feather name="cpu" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
