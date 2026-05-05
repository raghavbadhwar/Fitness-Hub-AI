import { Platform, useColorScheme } from "react-native";
import colors from "@/constants/colors";

export function useColors() {
  const scheme = useColorScheme();
  if (Platform.OS === "web") {
    return { ...colors.light, radius: colors.radius };
  }
  const palette = scheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
