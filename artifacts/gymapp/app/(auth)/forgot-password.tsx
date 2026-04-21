import { useSignIn } from "@clerk/expo";
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
  return typeof candidateRecord.message === "string"
    ? candidateRecord.message
    : undefined;
}

export default function ForgotPassword() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const colors = useColors();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [resetCodeSent, setResetCodeSent] = useState(false);

  const isLoading = fetchStatus === "fetching";

  function fieldError(field: string): string | undefined {
    return fieldErrorMessage(errors, field);
  }

  const finalizeSignIn = async () => {
    await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) return;
        router.replace(decorateUrl("/") as Href);
      },
    });
  };

  const startOver = () => {
    signIn.reset();
    setCode("");
    setPassword("");
    setResetCodeSent(false);
  };

  const sendResetCode = async () => {
    if (!email) return;

    const { error: createError } = await signIn.create({
      identifier: email,
    });
    if (createError) return;

    const { error: sendCodeError } =
      await signIn.resetPasswordEmailCode.sendCode();
    if (sendCodeError) return;

    setCode("");
    setPassword("");
    setResetCodeSent(true);
  };

  const verifyResetCode = async () => {
    const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code });
    if (error) return;
  };

  const submitNewPassword = async () => {
    const { error } = await signIn.resetPasswordEmailCode.submitPassword({
      password,
    });
    if (error) return;

    if (signIn.status === "complete") {
      await finalizeSignIn();
    } else if (signIn.status === "needs_client_trust") {
      await signIn.mfa.sendEmailCode();
      setCode("");
    }
  };

  const verifyTrustedDevice = async () => {
    await signIn.mfa.verifyEmailCode({ code });
    if (signIn.status === "complete") {
      await finalizeSignIn();
    }
  };

  if (signIn.status === "needs_client_trust") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={[styles.logo, { color: colors.primary }]}>GymOS</Text>
            <Text style={[styles.title, { color: colors.text }]}>
              Verify your recovery
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Enter the email code to finish signing back in
            </Text>
          </View>
          <View style={styles.form}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Verification code"
              placeholderTextColor={colors.mutedForeground}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoFocus
            />
            {fieldError("code") && (
              <Text style={[styles.errorText, { color: colors.error }]}>
                {fieldError("code")}
              </Text>
            )}
            <Pressable
              style={[
                styles.button,
                { backgroundColor: colors.primary },
                isLoading && styles.buttonDisabled,
              ]}
              onPress={verifyTrustedDevice}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify & Continue</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => signIn.mfa.sendEmailCode()}
              style={styles.secondaryAction}
            >
              <Text style={[styles.secondaryLink, { color: colors.primary }]}>
                Resend code
              </Text>
            </Pressable>
            <Pressable onPress={startOver} style={styles.secondaryAction}>
              <Text
                style={[
                  styles.secondaryLink,
                  { color: colors.mutedForeground },
                ]}
              >
                Start over
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (signIn.status === "needs_second_factor") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={[styles.logo, { color: colors.primary }]}>GymOS</Text>
            <Text style={[styles.title, { color: colors.text }]}>
              Additional verification needed
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Your password was reset, but this account still needs a second
              factor. Finish sign-in from the main login screen.
            </Text>
          </View>
          <View style={styles.form}>
            <Pressable
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => router.replace("/sign-in")}
            >
              <Text style={styles.buttonText}>Back to Sign In</Text>
            </Pressable>
            <Pressable onPress={startOver} style={styles.secondaryAction}>
              <Text
                style={[
                  styles.secondaryLink,
                  { color: colors.mutedForeground },
                ]}
              >
                Reset another password
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (signIn.status === "needs_new_password") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={[styles.logo, { color: colors.primary }]}>GymOS</Text>
              <Text style={[styles.title, { color: colors.text }]}>
                Set a new password
              </Text>
              <Text
                style={[styles.subtitle, { color: colors.mutedForeground }]}
              >
                Choose a new password for your member account
              </Text>
            </View>
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  New Password
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Enter a new password"
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
                  (!password || isLoading) && styles.buttonDisabled,
                ]}
                onPress={submitNewPassword}
                disabled={!password || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Save new password</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (resetCodeSent) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={[styles.logo, { color: colors.primary }]}>GymOS</Text>
              <Text style={[styles.title, { color: colors.text }]}>
                Verify reset code
              </Text>
              <Text
                style={[styles.subtitle, { color: colors.mutedForeground }]}
              >
                Enter the password reset code sent to {email}
              </Text>
            </View>
            <View style={styles.form}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Enter verification code"
                placeholderTextColor={colors.mutedForeground}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              {fieldError("code") && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {fieldError("code")}
                </Text>
              )}
              <Pressable
                style={[
                  styles.button,
                  { backgroundColor: colors.primary },
                  (!code || isLoading) && styles.buttonDisabled,
                ]}
                onPress={verifyResetCode}
                disabled={!code || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify code</Text>
                )}
              </Pressable>
              <Pressable
                onPress={sendResetCode}
                style={styles.secondaryAction}
                disabled={isLoading}
              >
                <Text style={[styles.secondaryLink, { color: colors.primary }]}>
                  Resend reset code
                </Text>
              </Pressable>
              <Pressable onPress={startOver} style={styles.secondaryAction}>
                <Text
                  style={[
                    styles.secondaryLink,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Start over
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={[styles.logo, { color: colors.primary }]}>GymOS</Text>
            <Text style={[styles.title, { color: colors.text }]}>
              Forgot password?
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Recover your member account without affecting the existing profile
              sync and onboarding checks.
            </Text>
          </View>
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Email
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.text,
                  },
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
            <Pressable
              style={[
                styles.button,
                { backgroundColor: colors.primary },
                (!email || isLoading) && styles.buttonDisabled,
              ]}
              onPress={sendResetCode}
              disabled={!email || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send reset code</Text>
              )}
            </Pressable>
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
                Remembered it?
              </Text>
              <Pressable onPress={() => router.push("/sign-in")}>
                <Text style={[styles.secondaryLink, { color: colors.primary }]}>
                  Back to Sign In
                </Text>
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
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  header: { alignItems: "center", marginBottom: 40 },
  logo: { fontSize: 36, fontWeight: "800", letterSpacing: -1 },
  title: { fontSize: 26, fontWeight: "700", marginTop: 16, textAlign: "center" },
  subtitle: { fontSize: 15, marginTop: 8, textAlign: "center" },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500" },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  button: { borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  errorText: { fontSize: 13, marginTop: 2 },
  secondaryAction: { alignItems: "center", paddingVertical: 8 },
  secondaryLink: { fontSize: 14, fontWeight: "600" },
  footer: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 8 },
  footerText: { fontSize: 14 },
});
