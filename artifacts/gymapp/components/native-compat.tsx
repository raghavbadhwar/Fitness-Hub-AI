import React, { type ReactNode } from "react";
import { BlurView as NativeBlurView } from "expo-blur";
import { LinearGradient as NativeLinearGradient } from "expo-linear-gradient";
import { GestureHandlerRootView as NativeGestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider as NativeSafeAreaProvider,
  SafeAreaView as NativeSafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type StyleLike = unknown;
type Edge = "top" | "right" | "bottom" | "left";
type EdgeRecord = Partial<Record<Edge, "off" | "additive" | "maximum">>;

type SafeAreaProviderProps = {
  children?: ReactNode;
  style?: StyleLike;
};

type SafeAreaViewProps = {
  children?: ReactNode;
  style?: StyleLike;
  mode?: "padding" | "margin";
  edges?: readonly Edge[] | Readonly<EdgeRecord>;
};

type GestureHandlerRootViewProps = {
  children?: ReactNode;
  style?: StyleLike;
};

type BlurViewProps = {
  children?: ReactNode;
  style?: StyleLike;
  tint?:
    | "light"
    | "dark"
    | "default"
    | "extraLight"
    | "regular"
    | "prominent"
    | "systemUltraThinMaterial"
    | "systemThinMaterial"
    | "systemMaterial"
    | "systemThickMaterial"
    | "systemChromeMaterial"
    | "systemUltraThinMaterialLight"
    | "systemThinMaterialLight"
    | "systemMaterialLight"
    | "systemThickMaterialLight"
    | "systemChromeMaterialLight"
    | "systemUltraThinMaterialDark"
    | "systemThinMaterialDark"
    | "systemMaterialDark"
    | "systemThickMaterialDark"
    | "systemChromeMaterialDark";
  intensity?: number;
  blurReductionFactor?: number;
  experimentalBlurMethod?: "none" | "dimezisBlurView";
};

type LinearGradientPoint = { x: number; y: number } | readonly [number, number];
type LinearGradientProps = {
  children?: ReactNode;
  style?: StyleLike;
  colors: readonly unknown[];
  locations?: readonly number[] | null;
  start?: LinearGradientPoint | null;
  end?: LinearGradientPoint | null;
  dither?: boolean;
};

const SafeAreaProviderBase =
  NativeSafeAreaProvider as unknown as React.ComponentType<SafeAreaProviderProps>;
const SafeAreaViewBase = NativeSafeAreaView as unknown as React.ComponentType<SafeAreaViewProps>;
const GestureHandlerRootViewBase =
  NativeGestureHandlerRootView as unknown as React.ComponentType<GestureHandlerRootViewProps>;
const BlurViewBase = NativeBlurView as unknown as React.ComponentType<BlurViewProps>;
const LinearGradientBase =
  NativeLinearGradient as unknown as React.ComponentType<LinearGradientProps>;

export function SafeAreaProvider(props: SafeAreaProviderProps) {
  return <SafeAreaProviderBase {...props} />;
}

export function SafeAreaView(props: SafeAreaViewProps) {
  return <SafeAreaViewBase {...props} />;
}

export function GestureHandlerRootView(props: GestureHandlerRootViewProps) {
  return <GestureHandlerRootViewBase {...props} />;
}

export function BlurView(props: BlurViewProps) {
  return <BlurViewBase {...props} />;
}

export function LinearGradient(props: LinearGradientProps) {
  return <LinearGradientBase {...props} />;
}

export { useSafeAreaInsets };
