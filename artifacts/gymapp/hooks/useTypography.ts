import { Platform } from "react-native";
import { useColors } from "@/hooks/useColors";

const IOS_FONT = "SF Pro Display";
const ANDROID_FONT = "Roboto";
const WEB_FONT = "System";

const FONT_FAMILY = Platform.select({
  ios: IOS_FONT,
  android: ANDROID_FONT,
  default: WEB_FONT,
});

export function useTypography() {
  const colors = useColors();

  return {
    screenTitle: {
      fontFamily: FONT_FAMILY,
      fontSize: 28,
      fontWeight: "800" as const,
    },
    sectionTitle: {
      fontFamily: FONT_FAMILY,
      fontSize: 18,
      fontWeight: "700" as const,
    },
    sectionTitleUnderline: {
      height: 2,
      backgroundColor: colors.primary,
      borderRadius: 1,
      width: 32,
      marginTop: 4,
    },
    cardTitle: {
      fontFamily: FONT_FAMILY,
      fontSize: 16,
      fontWeight: "700" as const,
    },
    body: {
      fontFamily: FONT_FAMILY,
      fontSize: 15,
    },
    caption: {
      fontFamily: FONT_FAMILY,
      fontSize: 12,
    },
  };
}
