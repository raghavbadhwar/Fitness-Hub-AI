import { useSignIn } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function SignIn() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const colors = useColors();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const isLoading = fetchStatus === "fetching";

  const handleSignIn = async () => {
    if (!email || !password) return;
    const { error } = await signIn.password({ emailAddress: email, password });
    if (error) return;

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          const url = decorateUrl("/");
          router.replace(url as any);
        },
      });
    } else if (signIn.status === "needs_client_trust") {
      await signIn.mfa.sendEmailCode();
    }
  };

  const handleVerify = async () => {
    await signIn.mfa.verifyEmailCode({ code });
    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          const url = decorateUrl("/");
          router.replace(url as any);
        },
      });
    }
  };

  if (signIn.status === "needs_client_trust") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={[styles.logo, { color: colors.primary }]}>GymOS</Text>
            <Text style={[styles.title, { color: colors.text }]}>Verify your account</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Enter the code sent to your email</Text>
          </View>
          <View style={styles.form}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="Verification code"
              placeholderTextColor={colors.mutedForeground}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoFocus
            />
            {errors?.fields?.code && <Text style={[styles.errorText, { color: colors.error }]}>{(errors.fields as any).code.message}</Text>}
            <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleVerify} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={[styles.logo, { color: colors.primary }]}>GymOS</Text>
            <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sign in to continue your fitness journey</Text>
          </View>
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                placeholder="your@email.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors?.fields?.identifier && <Text style={[styles.errorText, { color: colors.error }]}>{(errors.fields as any).identifier.message}</Text>}
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                placeholder="Your password"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              {errors?.fields?.password && <Text style={[styles.errorText, { color: colors.error }]}>{(errors.fields as any).password.message}</Text>}
            </View>
            <Pressable
              style={[styles.button, { backgroundColor: colors.primary }, (!email || !password || isLoading) && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={!email || !password || isLoading}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
            </Pressable>
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Don't have an account? </Text>
              <Link href="/(auth)/sign-up" asChild>
                <Pressable>
                  <Text style={[styles.link, { color: colors.primary }]}>Sign Up</Text>
                </Pressable>
              </Link>
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
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  button: { borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  footerText: { fontSize: 14 },
  link: { fontSize: 14, fontWeight: "600" },
  errorText: { fontSize: 13, marginTop: 2 },
  resend: { alignItems: "center", paddingVertical: 8 },
  resendText: { fontSize: 14, fontWeight: "500" },
});
