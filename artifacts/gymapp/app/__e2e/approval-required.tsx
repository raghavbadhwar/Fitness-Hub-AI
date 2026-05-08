import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";

import { ApprovalRequiredView } from "../approval-required";
import type { AccessState } from "@/contexts/AppContext";

function getPreviewAccessState(state: string): AccessState {
  if (state === "revoked") {
    return {
      status: "revoked",
      email: "member@example.com",
      role: "member",
      message: "Your gym team has turned off member app access for this email.",
    };
  }

  if (state === "auth-expired") {
    return {
      status: "unknown",
      email: "member@example.com",
      role: "member",
      message: "Your secure session expired before we could verify access. Sign in again.",
    };
  }

  if (state === "api-unavailable") {
    return {
      status: "unknown",
      email: "member@example.com",
      role: "member",
      message: "We could not reach Fitness Hub services. Check your connection and try again.",
    };
  }

  if (state === "checking") {
    return {
      status: "unknown",
      email: "member@example.com",
      role: "member",
    };
  }

  return {
    status: "pending_approval",
    email: "member@example.com",
    role: "member",
    message: "Your gym team needs to allow this email before you can enter the member app.",
  };
}

export default function ApprovalRequiredPreviewRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const state = typeof params.state === "string" ? params.state : "pending";

  return (
    <ApprovalRequiredView
      accessState={getPreviewAccessState(state)}
      isRefreshing={isRefreshing}
      onRefresh={() => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 250);
      }}
      onSwitchAccount={() => {}}
    />
  );
}
