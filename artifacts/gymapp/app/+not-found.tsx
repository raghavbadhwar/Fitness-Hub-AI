import { Stack, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export default function NotFoundScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          This screen doesn&apos;t exist.
        </Text>

        <Pressable style={styles.link} onPress={() => router.replace("/")}>
          <Text style={[styles.linkText, { color: colors.primary }]}>
            Go to home screen!
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
  },
});
