import { useSignIn } from "@clerk/expo";
import { useRouter, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
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

function fieldErrorMessage(source: unknown, field: string): string | undefined {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  const fields = "fields" in source ? source.fields : undefined;
  if (!fields || typeof fields !== "object") {
    return undefined;
  }

  const candidate = (fields as Record<string, unknown>)[field];
  if (!candidate || typeof candidate !== "object") {
    return undefined;
  }

  const candidateRecord = candidate as { message?: unknown };
  return typeof candidateRecord.message === "string" ? candidateRecord.message : undefined;
}

export default function SignIn() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const colors = useColors();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [hasRequestedVerificationCode, setHasRequestedVerificationCode] = useState(false);

  const isLoading = fetchStatus === "fetching";
  const needsEmailCodeVerification =
    signIn.status === "needs_client_trust" || signIn.status === "needs_second_factor";

  function fieldError(field: string): string | undefined {
    return fieldErrorMessage(errors, field);
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

  const finalizeSignIn = async () => {
    await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) return;
        router.replace(decorateUrl("/") as Href);
      },
    });
  };

  const handleSignIn = async () => {
    if (!email || !password) return;
    const { error } = await signIn.password({ emailAddress: email, password });
    if (error) return;

    if (signIn.status === "complete") {
      await finalizeSignIn();
    }
  };

  const handleVerify = async () => {
    await signIn.mfa.verifyEmailCode({ code });
    if (signIn.status === "complete") {
      await finalizeSignIn();
    }
  };

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
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </Pressable>
            <Pressable onPress={() => signIn.mfa.sendEmailCode()} style={styles.resend}>
              <Text style={[styles.resendText, { color: colors.primary }]}>Resend code</Text>
            </Pressable>
            <Pressable onPress={() => signIn.reset()} style={styles.resend}>
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
                placeholder="your@email.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {fieldError("identifier") && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {fieldError("identifier")}
                </Text>
              )}
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="Your password"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              {fieldError("password") && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {fieldError("password")}
                </Text>
              )}
            </View>
            <Pressable
              style={[
                styles.button,
                { backgroundColor: colors.primary },
                (!email || !password || isLoading) && styles.buttonDisabled,
              ]}
              onPress={handleSignIn}
              disabled={!email || !password || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </Pressable>
            <View style={styles.secondaryActions}>
              <Pressable onPress={() => router.push("/forgot-password")}>
                <Text style={[styles.secondaryLink, { color: colors.primary }]}>
                  Forgot password?
                </Text>
              </Pressable>
            </View>
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
                Don't have an account?{" "}
              </Text>
              <Pressable onPress={() => router.push("/sign-up")}>
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
  resend: { alignItems: "center", paddingVertical: 8 },
  resendText: { fontSize: 14, fontWeight: "500" },
});
