import { useSignUp } from "@clerk/expo";
import { useRouter, type Href } from "expo-router";
import React, { useState } from "react";
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

export default function SignUp() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const router = useRouter();
  const colors = useColors();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const isLoading = fetchStatus === "fetching";

  function fieldError(field: string): string | undefined {
    return fieldErrorMessage(errors, field);
  }

  const handleSignUp = async () => {
    if (!email || !password) return;
    const { error } = await signUp.password({
      emailAddress: email,
      password,
    });
    if (error) return;
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          router.replace(decorateUrl("/") as Href);
        },
      });
    }
  };

  if (
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0
  ) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={[styles.logo, { color: colors.primary }]}>GymOS</Text>
            <Text style={[styles.title, { color: colors.text }]}>Check your email</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              We sent a verification code to {email}
            </Text>
          </View>
          <View style={styles.form}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
              ]}
              placeholder="Enter 6-digit code"
              placeholderTextColor={colors.mutedForeground}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
              autoFocus
            />
            {fieldError("code") && (
              <Text style={[styles.errorText, { color: colors.error }]}>{fieldError("code")}</Text>
            )}
            <Pressable
              style={[
                styles.button,
                { backgroundColor: colors.primary },
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleVerify}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify Email</Text>
              )}
            </Pressable>
            <Pressable onPress={() => signUp.verifications.sendEmailCode()} style={styles.resend}>
              <Text style={[styles.resendText, { color: colors.primary }]}>Resend code</Text>
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
            <Text style={[styles.title, { color: colors.text }]}>Create account</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Start your AI-powered fitness journey
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
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Full Name</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="Your full name"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
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
              {fieldError("emailAddress") && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {fieldError("emailAddress")}
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
                placeholder="Min. 8 characters"
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
              onPress={handleSignUp}
              disabled={!email || !password || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </Pressable>
            {errors && <Text style={styles.debugText}>{JSON.stringify(errors, null, 2)}</Text>}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
                Already have an account?{" "}
              </Text>
              <Pressable onPress={() => router.push("/sign-in")}>
                <Text style={[styles.link, { color: colors.primary }]}>Sign In</Text>
              </Pressable>
            </View>
          </View>
          <View nativeID="clerk-captcha" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 32 },
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
  errorText: { fontSize: 13, marginTop: 2 },
  resend: { alignItems: "center", paddingVertical: 8 },
  resendText: { fontSize: 14, fontWeight: "500" },
  debugText: { fontSize: 10, color: "#666", display: "none" },
});
