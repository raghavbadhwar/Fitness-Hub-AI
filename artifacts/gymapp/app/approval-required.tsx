import { useClerk } from "@clerk/expo";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { type AccessState, useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

type ApprovalRequiredViewProps = {
  accessState: AccessState;
  isRefreshing: boolean;
  onRefresh: () => void;
  onSwitchAccount: () => void;
};

function getApprovalCopy(accessState: AccessState) {
  const message = accessState.message?.trim();
  const isRevoked = accessState.status === "revoked";
  const isPending = accessState.status === "pending_approval";
  const isAuthExpired =
    accessState.status === "unknown" && Boolean(message?.toLowerCase().includes("session"));
  const isApiUnavailable =
    accessState.status === "unknown" &&
    Boolean(message?.toLowerCase().match(/api|network|connection|verify/));

  if (isRevoked) {
    return {
      tone: "blocked" as const,
      icon: "!",
      title: "This email is blocked",
      message: message || "Your gym team has turned off member app access for this email.",
      primaryAction: "Check access again",
      secondaryAction: "Sign in with another email",
    };
  }

  if (isPending) {
    return {
      tone: "pending" as const,
      icon: "i",
      title: "Waiting for approval",
      message:
        message || "Your gym team needs to allow this email before you can enter the member app.",
      primaryAction: "I have been approved",
      secondaryAction: "Sign in with another email",
    };
  }

  if (isAuthExpired) {
    return {
      tone: "blocked" as const,
      icon: "!",
      title: "Sign in again",
      message:
        message ||
        "Your secure session expired before we could verify access. Sign in again to continue.",
      primaryAction: "Sign in again",
      secondaryAction: "Use another email",
    };
  }

  if (isApiUnavailable) {
    return {
      tone: "pending" as const,
      icon: "...",
      title: "Unable to verify access",
      message:
        message || "We could not reach Fitness Hub services. Check your connection and try again.",
      primaryAction: "Try again",
      secondaryAction: "Sign in with another email",
    };
  }

  return {
    tone: "checking" as const,
    icon: "...",
    title: "Checking access",
    message: message || "We are verifying that your gym team has enabled this email.",
    primaryAction: "Check again",
    secondaryAction: "Sign in with another email",
  };
}

export function ApprovalRequiredView({
  accessState,
  isRefreshing,
  onRefresh,
  onSwitchAccount,
}: ApprovalRequiredViewProps) {
  const colors = useColors();
  const copy = getApprovalCopy(accessState);
  const isBlockedTone = copy.tone === "blocked";
  const handlePrimaryPress = copy.title === "Sign in again" ? onSwitchAccount : onRefresh;

  return (
    <SafeAreaView
      testID={`approval-required-${accessState.status}`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.card}>
        <View
          style={[
            styles.icon,
            {
              backgroundColor: isBlockedTone ? colors.destructive + "18" : colors.primary + "18",
            },
          ]}
        >
          <Text
            style={[
              styles.iconText,
              { color: isBlockedTone ? colors.destructive : colors.primary },
            ]}
          >
            {copy.icon}
          </Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{copy.message}</Text>
        {accessState.email ? (
          <Text style={[styles.email, { color: colors.text }]}>{accessState.email}</Text>
        ) : null}
        <View style={styles.details}>
          <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
            This screen only confirms app access for the signed-in email. It does not reveal member,
            class, workout, or gym admin data.
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            testID="approval-required-primary"
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handlePrimaryPress}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>{copy.primaryAction}</Text>
            )}
          </Pressable>
          <Pressable
            testID="approval-required-switch-account"
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={onSwitchAccount}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              {copy.secondaryAction}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function ApprovalRequired() {
  const { signOut } = useClerk();
  const { accessState, refreshProfile } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <ApprovalRequiredView
      accessState={accessState}
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
      onSwitchAccount={() => signOut()}
    />
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
  details: {
    marginTop: 18,
  },
  detailText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
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
