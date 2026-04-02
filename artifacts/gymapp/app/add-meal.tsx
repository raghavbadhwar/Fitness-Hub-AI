import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useNutrition, MealType } from "@/contexts/NutritionContext";

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "snacks", label: "Snacks" },
  { value: "dinner", label: "Dinner" },
  { value: "pre_workout", label: "Pre-Workout" },
  { value: "post_workout", label: "Post-Workout" },
];

export default function AddMealScreen() {
  const router = useRouter();
  const { mealType: initialMealType } = useLocalSearchParams<{ mealType?: string }>();
  const { addFoodEntry } = useNutrition();
  const colors = useColors();

  const [mealType, setMealType] = useState<MealType>((initialMealType as MealType) || "lunch");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [servings, setServings] = useState("1");
  const [mode, setMode] = useState<"photo" | "manual">("photo");

  const [manualFood, setManualFood] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    servingSize: "1 serving",
  });

  const pickImage = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission Required", "Please grant permission to access your " + (fromCamera ? "camera" : "photo library"));
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setAnalysisResult(null);
      if (asset.base64) {
        analyzeFood(asset.base64);
      }
    }
  };

  const analyzeFood = async (base64: string) => {
    setAnalyzing(true);
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const apiBase = domain ? `https://${domain}` : "";
      const response = await fetch(`${apiBase}/api/ai/analyze-food`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg" }),
      });
      if (!response.ok) throw new Error("Analysis failed");
      const result = await response.json();
      setAnalysisResult(result);
    } catch (err) {
      Alert.alert("Analysis Failed", "Couldn't analyze the food. Please enter details manually.");
      setMode("manual");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddFromPhoto = async () => {
    if (!analysisResult) return;
    const s = parseFloat(servings) || 1;
    await addFoodEntry({
      foodId: "photo_" + Date.now(),
      name: analysisResult.dishName,
      mealType,
      servings: s,
      servingSize: analysisResult.servingSize,
      calories: Math.round(analysisResult.calories * s),
      protein: Math.round(analysisResult.protein * s * 10) / 10,
      carbs: Math.round(analysisResult.carbs * s * 10) / 10,
      fat: Math.round(analysisResult.fat * s * 10) / 10,
      fiber: Math.round((analysisResult.fiber || 0) * s * 10) / 10,
      fromPhoto: true,
      photoUri: imageUri || undefined,
    });
    router.back();
  };

  const handleAddManual = async () => {
    if (!manualFood.name || !manualFood.calories) {
      Alert.alert("Missing Info", "Please enter at least the food name and calories.");
      return;
    }
    await addFoodEntry({
      foodId: "manual_" + Date.now(),
      name: manualFood.name,
      mealType,
      servings: 1,
      servingSize: manualFood.servingSize,
      calories: parseInt(manualFood.calories) || 0,
      protein: parseFloat(manualFood.protein) || 0,
      carbs: parseFloat(manualFood.carbs) || 0,
      fat: parseFloat(manualFood.fat) || 0,
      fiber: 0,
    });
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.modeToggle}>
            <Pressable style={[styles.modeBtn, mode === "photo" && { backgroundColor: colors.primary }]} onPress={() => setMode("photo")}>
              <Feather name="camera" size={16} color={mode === "photo" ? "#fff" : colors.mutedForeground} />
              <Text style={[styles.modeBtnText, { color: mode === "photo" ? "#fff" : colors.mutedForeground }]}>AI Photo</Text>
            </Pressable>
            <Pressable style={[styles.modeBtn, mode === "manual" && { backgroundColor: colors.primary }]} onPress={() => setMode("manual")}>
              <Feather name="edit-3" size={16} color={mode === "manual" ? "#fff" : colors.mutedForeground} />
              <Text style={[styles.modeBtnText, { color: mode === "manual" ? "#fff" : colors.mutedForeground }]}>Manual</Text>
            </Pressable>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Log to</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mealTypePicker}>
            {MEAL_TYPES.map((m) => (
              <Pressable key={m.value} style={[styles.mealTypeChip, { backgroundColor: mealType === m.value ? colors.primary : colors.card, borderColor: mealType === m.value ? colors.primary : colors.border }]} onPress={() => setMealType(m.value)}>
                <Text style={[styles.mealTypeChipText, { color: mealType === m.value ? "#fff" : colors.text }]}>{m.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {mode === "photo" && (
            <>
              {!imageUri ? (
                <View style={styles.photoPlaceholder}>
                  <View style={[styles.photoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Feather name="image" size={48} color={colors.mutedForeground} />
                    <Text style={[styles.photoHint, { color: colors.mutedForeground }]}>Take a photo or choose from gallery</Text>
                    <View style={styles.photoButtons}>
                      {Platform.OS !== "web" && (
                        <Pressable style={[styles.photoBtn, { backgroundColor: colors.primary }]} onPress={() => pickImage(true)}>
                          <Feather name="camera" size={18} color="#fff" />
                          <Text style={styles.photoBtnText}>Camera</Text>
                        </Pressable>
                      )}
                      <Pressable style={[styles.photoBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} onPress={() => pickImage(false)}>
                        <Feather name="image" size={18} color={colors.text} />
                        <Text style={[styles.photoBtnText, { color: colors.text }]}>Gallery</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: imageUri }} style={styles.foodImage as any} resizeMode="cover" />
                  <Pressable style={[styles.retakeBtn, { backgroundColor: colors.card }]} onPress={() => { setImageUri(null); setAnalysisResult(null); }}>
                    <Feather name="refresh-cw" size={16} color={colors.text} />
                    <Text style={[styles.retakeBtnText, { color: colors.text }]}>Retake</Text>
                  </Pressable>
                </View>
              )}

              {analyzing && (
                <View style={[styles.analyzingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={[styles.analyzingText, { color: colors.text }]}>Analyzing with Gemini AI...</Text>
                  <Text style={[styles.analyzingSubtext, { color: colors.mutedForeground }]}>Identifying dish & calculating nutrition</Text>
                </View>
              )}

              {analysisResult && !analyzing && (
                <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.resultHeader}>
                    <View>
                      <Text style={[styles.dishName, { color: colors.text }]}>{analysisResult.dishName}</Text>
                      <Text style={[styles.cuisine, { color: colors.mutedForeground }]}>{analysisResult.cuisine} · {analysisResult.servingSize}</Text>
                    </View>
                    <View style={[styles.confidenceBadge, { backgroundColor: analysisResult.confidence === "high" ? colors.success + "20" : colors.warning + "20" }]}>
                      <Text style={[styles.confidenceText, { color: analysisResult.confidence === "high" ? colors.success : colors.warning }]}>
                        {analysisResult.confidence === "high" ? "✓ Confident" : "~ Estimated"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.macrosGrid}>
                    <View style={[styles.macroItem, { backgroundColor: colors.primary + "15" }]}>
                      <Text style={[styles.macroVal, { color: colors.primary }]}>{analysisResult.calories}</Text>
                      <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>kcal</Text>
                    </View>
                    <View style={[styles.macroItem, { backgroundColor: colors.protein + "15" }]}>
                      <Text style={[styles.macroVal, { color: colors.protein }]}>{analysisResult.protein}g</Text>
                      <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>Protein</Text>
                    </View>
                    <View style={[styles.macroItem, { backgroundColor: colors.carbs + "15" }]}>
                      <Text style={[styles.macroVal, { color: colors.carbs }]}>{analysisResult.carbs}g</Text>
                      <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>Carbs</Text>
                    </View>
                    <View style={[styles.macroItem, { backgroundColor: colors.fat + "15" }]}>
                      <Text style={[styles.macroVal, { color: colors.fat }]}>{analysisResult.fat}g</Text>
                      <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>Fat</Text>
                    </View>
                  </View>
                  {analysisResult.healthTip && (
                    <View style={[styles.tipBox, { backgroundColor: colors.primaryMuted }]}>
                      <Feather name="cpu" size={12} color={colors.primary} />
                      <Text style={[styles.tipText, { color: colors.text }]}>{analysisResult.healthTip}</Text>
                    </View>
                  )}
                  <View style={styles.servingRow}>
                    <Text style={[styles.servingLabel, { color: colors.mutedForeground }]}>Servings:</Text>
                    <TextInput
                      style={[styles.servingInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                      value={servings}
                      onChangeText={setServings}
                      keyboardType="decimal-pad"
                    />
                    <Text style={[styles.totalCals, { color: colors.text }]}>
                      = {Math.round(analysisResult.calories * (parseFloat(servings) || 1))} kcal
                    </Text>
                  </View>
                  <Pressable style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={handleAddFromPhoto}>
                    <Feather name="plus" size={18} color="#fff" />
                    <Text style={styles.addBtnText}>Add to {mealType.replace("_", " ")}</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}

          {mode === "manual" && (
            <View style={[styles.manualCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Food Name *</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="e.g. Dal Makhani" placeholderTextColor={colors.mutedForeground} value={manualFood.name} onChangeText={(v) => setManualFood({ ...manualFood, name: v })} />
              </View>
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Serving Size</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="1 bowl (200g)" placeholderTextColor={colors.mutedForeground} value={manualFood.servingSize} onChangeText={(v) => setManualFood({ ...manualFood, servingSize: v })} />
              </View>
              <View style={styles.macroInputs}>
                {[["calories", "kcal *"], ["protein", "Protein (g)"], ["carbs", "Carbs (g)"], ["fat", "Fat (g)"]].map(([key, label]) => (
                  <View key={key} style={[styles.macroInput, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
                    <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="0" placeholderTextColor={colors.mutedForeground} value={(manualFood as any)[key]} onChangeText={(v) => setManualFood({ ...manualFood, [key]: v })} keyboardType="decimal-pad" />
                  </View>
                ))}
              </View>
              <Pressable style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={handleAddManual}>
                <Feather name="plus" size={18} color="#fff" />
                <Text style={styles.addBtnText}>Add Food</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 16 },
  modeToggle: { flexDirection: "row", gap: 8 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: "transparent" },
  modeBtnText: { fontSize: 14, fontWeight: "600" },
  sectionLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  mealTypePicker: { gap: 8, paddingVertical: 4 },
  mealTypeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  mealTypeChipText: { fontSize: 13, fontWeight: "500" },
  photoPlaceholder: {},
  photoBox: { borderRadius: 16, padding: 40, borderWidth: 1, borderStyle: "dashed", alignItems: "center", gap: 12 },
  photoHint: { fontSize: 14, textAlign: "center" },
  photoButtons: { flexDirection: "row", gap: 12, marginTop: 8 },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  photoBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  imageContainer: { position: "relative" },
  foodImage: { width: "100%", height: 220, borderRadius: 16 },
  retakeBtn: { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  retakeBtnText: { fontSize: 13, fontWeight: "600" },
  analyzingCard: { borderRadius: 16, padding: 20, borderWidth: 1, alignItems: "center", gap: 8 },
  analyzingText: { fontSize: 15, fontWeight: "600" },
  analyzingSubtext: { fontSize: 13 },
  resultCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 14 },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  dishName: { fontSize: 20, fontWeight: "700" },
  cuisine: { fontSize: 13, marginTop: 2 },
  confidenceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  confidenceText: { fontSize: 12, fontWeight: "600" },
  macrosGrid: { flexDirection: "row", gap: 8 },
  macroItem: { flex: 1, borderRadius: 10, padding: 10, alignItems: "center" },
  macroVal: { fontSize: 18, fontWeight: "700" },
  macroLabel: { fontSize: 11, marginTop: 2 },
  tipBox: { flexDirection: "row", gap: 8, borderRadius: 10, padding: 10, alignItems: "flex-start" },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
  servingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  servingLabel: { fontSize: 14 },
  servingInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, width: 70, textAlign: "center" },
  totalCals: { fontSize: 14, fontWeight: "600" },
  addBtn: { borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  addBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  manualCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 14 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  macroInputs: { flexDirection: "row", gap: 10 },
  macroInput: { gap: 6 },
});
