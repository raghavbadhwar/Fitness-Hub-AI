import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export function impact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS === "web") return;
  void Haptics.impactAsync(style).catch(() => undefined);
}

export function notify(type: Haptics.NotificationFeedbackType) {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(type).catch(() => undefined);
}

export function notifySuccess() {
  notify(Haptics.NotificationFeedbackType.Success);
}

export function notifyWarning() {
  notify(Haptics.NotificationFeedbackType.Warning);
}
