import { useClerk } from "@clerk/expo";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function ApprovalRequired() {
  const colors = useColors();
  const { signOut } = useClerk();
  const { accessState, refreshProfile } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isChecking = accessState.status === "unknown";
  const isRevoked = accessState.status === "revoked";
  const title = isChecking
    ? "Checking access"
    : isRevoked
      ? "This email is blocked"
      : "Waiting for approval";
  const message =
    accessState.message ||
    (isChecking
      ? "We are verifying that your gym team has enabled this email for the member app."
      : isRevoked
        ? "Your gym team has turned off member app access for this email."
        : "Your gym team needs to allow this email before you can enter the member app.");

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.card}>
        <View
          style={[
            styles.icon,
            {
              backgroundColor: isRevoked ? colors.destructive + "18" : colors.primary + "18",
            },
          ]}
        >
          <Text
            style={[styles.iconText, { color: isRevoked ? colors.destructive : colors.primary }]}
          >
            {isRevoked ? "!" : isChecking ? "..." : "i"}
          </Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{message}</Text>
        {accessState.email ? (
          <Text style={[styles.email, { color: colors.text }]}>{accessState.email}</Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isChecking ? "Check again" : "I have been approved"}
              </Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={() => signOut()}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              Sign in with another email
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    alignItems: "center",
    maxWidth: 420,
    width: "100%",
  },
  icon: {
    alignItems: "center",
    borderRadius: 32,
    height: 64,
    justifyContent: "center",
    marginBottom: 24,
    width: 64,
  },
  iconText: {
    fontSize: 28,
    fontWeight: "800",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    marginTop: 12,
    textAlign: "center",
  },
  email: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 16,
  },
  actions: {
    gap: 12,
    marginTop: 28,
    width: "100%",
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 12,
    minHeight: 52,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
