import { useSignIn } from "@clerk/expo";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { useColors } from "@/hooks/useColors";
import { authFieldErrorMessage, authFormErrorMessage } from "@/lib/auth-error-message";
import { impact, notifyError, notifySuccess, selection } from "@/lib/haptics";

function firstStringParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function SignIn() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const params = useLocalSearchParams<{ __clerk_ticket?: string | string[] }>();
  const router = useRouter();
  const colors = useColors();
  const ticket = firstStringParam(params.__clerk_ticket).trim();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [hasRequestedVerificationCode, setHasRequestedVerificationCode] = useState(false);
  const [isTicketSignIn, setIsTicketSignIn] = useState(Boolean(ticket));
  const [ticketError, setTicketError] = useState("");

  const isLoading = fetchStatus === "fetching";
  const needsEmailCodeVerification =
    signIn.status === "needs_client_trust" || signIn.status === "needs_second_factor";

  function fieldError(field: string): string | undefined {
    return authFieldErrorMessage(errors, field);
  }

  useEffect(() => {
    if (!needsEmailCodeVerification) {
      setHasRequestedVerificationCode(false);
      return;
    }

    if (hasRequestedVerificationCode) {
      return;
    }

    let isActive = true;

    void signIn.mfa.sendEmailCode().then(() => {
      if (isActive) {
        setHasRequestedVerificationCode(true);
      }
    });

    return () => {
      isActive = false;
    };
  }, [hasRequestedVerificationCode, needsEmailCodeVerification, signIn]);

  const finalizeSignIn = useCallback(async () => {
    await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) return;
        router.replace(decorateUrl("/") as Href);
      },
    });
  }, [router, signIn]);

  useEffect(() => {
    if (!ticket) {
      setIsTicketSignIn(false);
      setTicketError("");
      return;
    }

    let isActive = true;

    const completeTicketSignIn = async () => {
      setIsTicketSignIn(true);
      setTicketError("");

      try {
        const { error } = await signIn.create({
          strategy: "ticket",
          ticket,
        } as unknown as Parameters<typeof signIn.create>[0]);
        if (error) {
          if (isActive) {
            setTicketError("This sign-in link could not be used. Please sign in again.");
            setIsTicketSignIn(false);
          }
          return;
        }

        await finalizeSignIn();
      } catch {
        if (isActive) {
          setTicketError("This sign-in link could not be used. Please sign in again.");
          setIsTicketSignIn(false);
        }
      }
    };

    void completeTicketSignIn();

    return () => {
      isActive = false;
    };
  }, [finalizeSignIn, signIn, ticket]);

  const handleSignIn = async () => {
    if (!email || !password) return;
    impact();
    const { error } = await signIn.password({ emailAddress: email, password });
    if (error) {
      notifyError();
      return;
    }

    if (signIn.status === "complete") {
      notifySuccess();
      await finalizeSignIn();
    }
  };

  const handleVerify = async () => {
    impact();
    await signIn.mfa.verifyEmailCode({ code });
    if (signIn.status === "complete") {
      notifySuccess();
      await finalizeSignIn();
    }
  };

  const emailError = fieldError("identifier") ?? fieldError("emailAddress");
  const passwordError = fieldError("password");
  const formError = authFormErrorMessage(errors);
  const generalError = formError && formError !== emailError && formError !== passwordError ? formError : "";

  if (isTicketSignIn) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.ticketLoading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.title, { color: colors.text }]}>Signing you in</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (needsEmailCodeVerification) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={[styles.logo, { color: colors.primary }]}>GymOS</Text>
            <Text style={[styles.title, { color: colors.text }]}>Verify your account</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Enter the code sent to your email
            </Text>
          </View>
          <View style={styles.form}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
              ]}
              accessibilityLabel="Verification code"
              placeholder="Verification code"
              placeholderTextColor={colors.mutedForeground}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoFocus
            />
            {fieldError("code") && (
              <Text style={[styles.errorText, { color: colors.error }]}>{fieldError("code")}</Text>
            )}
            <Pressable
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={handleVerify}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityState={{ busy: isLoading, disabled: isLoading }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                selection();
                void signIn.mfa.sendEmailCode();
              }}
              style={styles.resend}
              accessibilityRole="button"
            >
              <Text style={[styles.resendText, { color: colors.primary }]}>Resend code</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                selection();
                signIn.reset();
              }}
              style={styles.resend}
              accessibilityRole="button"
            >
              <Text style={[styles.resendText, { color: colors.mutedForeground }]}>Start over</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={[styles.logo, { color: colors.primary }]}>GymOS</Text>
            <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Sign in to continue your fitness journey
            </Text>
          </View>
          <View style={styles.form}>
            {ticketError ? (
              <Text style={[styles.errorText, styles.ticketErrorText, { color: colors.error }]}>
                {ticketError}
              </Text>
            ) : null}
            <GoogleAuthButton />
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                accessibilityLabel="Email"
                placeholder="your@email.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {emailError && <Text style={[styles.errorText, { color: colors.error }]}>{emailError}</Text>}
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                accessibilityLabel="Password"
                placeholder="Your password"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              {passwordError && (
                <Text style={[styles.errorText, { color: colors.error }]}>{passwordError}</Text>
              )}
            </View>
            {generalError ? (
              <Text style={[styles.errorText, styles.formErrorText, { color: colors.error }]}>
                {generalError}
              </Text>
            ) : null}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: colors.primary },
                (!email || !password || isLoading) && styles.buttonDisabled,
                pressed && email && password && !isLoading && styles.buttonPressed,
              ]}
              onPress={handleSignIn}
              disabled={!email || !password || isLoading}
              accessibilityRole="button"
              accessibilityState={{ busy: isLoading, disabled: !email || !password || isLoading }}
              testID="sign-in-submit"
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </Pressable>
            <View style={styles.secondaryActions}>
              <Pressable
                onPress={() => {
                  selection();
                  router.push("/forgot-password");
                }}
                accessibilityRole="link"
              >
                <Text style={[styles.secondaryLink, { color: colors.primary }]}>
                  Forgot password?
                </Text>
              </Pressable>
            </View>
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
                Don't have an account?{" "}
              </Text>
              <Pressable
                onPress={() => {
                  selection();
                  router.push("/sign-up");
                }}
                accessibilityRole="link"
              >
                <Text style={[styles.link, { color: colors.primary }]}>Sign Up</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 40 },
  logo: { fontSize: 36, fontWeight: "800", letterSpacing: -1 },
  title: { fontSize: 26, fontWeight: "700", marginTop: 16 },
  subtitle: { fontSize: 15, marginTop: 8, textAlign: "center" },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500" },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  button: { borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85, transform: [{ translateY: 1 }] },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  divider: { alignItems: "center", flexDirection: "row", gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontWeight: "600", textTransform: "uppercase" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  footerText: { fontSize: 14 },
  link: { fontSize: 14, fontWeight: "600" },
  secondaryActions: { alignItems: "flex-end" },
  secondaryLink: { fontSize: 14, fontWeight: "600" },
  errorText: { fontSize: 13, marginTop: 2 },
  formErrorText: { textAlign: "center" },
  ticketErrorText: { textAlign: "center" },
  ticketLoading: { alignItems: "center", flex: 1, justifyContent: "center", padding: 24 },
  resend: { alignItems: "center", paddingVertical: 8 },
  resendText: { fontSize: 14, fontWeight: "500" },
});
