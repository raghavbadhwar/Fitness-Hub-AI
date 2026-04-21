import { useSSO } from "@clerk/expo";
import { useSignInWithGoogle } from "@clerk/expo/google";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text } from "react-native";

import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS === "web") return;

    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

function errorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (!error || typeof error !== "object") {
    return "Unable to sign in with Google right now.";
  }

  const record = error as { message?: unknown; errors?: unknown };
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  if (Array.isArray(record.errors)) {
    const firstError = record.errors[0];
    if (
      firstError &&
      typeof firstError === "object" &&
      "message" in firstError &&
      typeof firstError.message === "string" &&
      firstError.message.trim()
    ) {
      return firstError.message;
    }
  }

  return "Unable to sign in with Google right now.";
}

type GoogleAuthButtonProps = {
  label?: string;
  disabled?: boolean;
  onComplete?: () => void;
};

export function GoogleAuthButton({
  label = "Continue with Google",
  disabled = false,
  onComplete,
}: GoogleAuthButtonProps) {
  const colors = useColors();
  const router = useRouter();
  const { startSSOFlow } = useSSO();
  const { startGoogleAuthenticationFlow } = useSignInWithGoogle();
  const [isLoading, setIsLoading] = useState(false);

  useWarmUpBrowser();

  const redirectUrl = useMemo(() => Linking.createURL("/sign-in", { scheme: "gymapp" }), []);

  const hasNativeGoogleConfig = useMemo(() => {
    const hasWebClient = Boolean(process.env.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID);
    if (!hasWebClient) return false;

    if (Platform.OS === "ios") {
      return Boolean(process.env.EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID);
    }

    if (Platform.OS === "android") {
      return Boolean(process.env.EXPO_PUBLIC_CLERK_GOOGLE_ANDROID_CLIENT_ID);
    }

    return false;
  }, []);

  const activateSession = useCallback(
    async (
      createdSessionId: string | null,
      setActive?: ((params: { session: string }) => Promise<void>) | undefined,
    ) => {
      if (!createdSessionId || !setActive) {
        return false;
      }

      await setActive({ session: createdSessionId });
      if (onComplete) {
        onComplete();
      } else {
        router.replace("/" as Href);
      }
      return true;
    },
    [onComplete, router],
  );

  const handlePress = useCallback(async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    try {
      if (Platform.OS !== "web" && hasNativeGoogleConfig) {
        try {
          const nativeResult = await startGoogleAuthenticationFlow();
          const nativeComplete = await activateSession(
            nativeResult.createdSessionId,
            nativeResult.setActive as ((params: { session: string }) => Promise<void>) | undefined,
          );

          if (nativeComplete) {
            return;
          }
        } catch (nativeError) {
          const code =
            nativeError && typeof nativeError === "object" && "code" in nativeError
              ? String(nativeError.code)
              : "";

          if (code === "SIGN_IN_CANCELLED" || code === "-5") {
            return;
          }

          console.warn("Native Google sign-in failed, falling back to OAuth", nativeError);
        }
      }

      const oauthResult = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
      });

      const oauthComplete = await activateSession(
        oauthResult.createdSessionId,
        oauthResult.setActive as ((params: { session: string }) => Promise<void>) | undefined,
      );

      if (!oauthComplete) {
        throw new Error("Google authentication did not complete. Please try again.");
      }
    } catch (error) {
      console.error("Google authentication failed", error);
      Alert.alert("Google sign-in failed", errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [
    activateSession,
    disabled,
    hasNativeGoogleConfig,
    isLoading,
    redirectUrl,
    startGoogleAuthenticationFlow,
    startSSOFlow,
  ]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        (disabled || isLoading) && styles.buttonDisabled,
        pressed && !(disabled || isLoading) && styles.buttonPressed,
      ]}
      onPress={handlePress}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={[styles.buttonText, { color: colors.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
